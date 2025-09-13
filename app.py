import os, time, requests, sys, signal, subprocess, hashlib, json, uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

# ====== CONFIG ======
UPLOAD_ENDPOINT = os.getenv("BASE_UPLOAD_ENDPOINT", "https://swikle.com/api/upload-csv")
PUBLIC_BASE = os.getenv("PUBLIC_BASE", "https://1b0s3gmik3fqhcvt.public.blob.vercel-storage.com/")

def _int_env(name, default):
    try:
        v = int(os.getenv(name, str(default)))
        return v if v >= 1 else default
    except Exception:
        return default

GAMEDAY_INTERVAL = _int_env("GAMEDAY_INTERVAL_SECONDS", 300)
NON_GAMEDAY_INTERVAL = _int_env("NON_GAMEDAY_INTERVAL_SECONDS", 10000)
STATIC_INTERVAL = _int_env("INTERVAL_SECONDS", 0)

ACTIVE = os.getenv("ACTIVE", "1")
MAX_GAMEWEEK = _int_env("MAX_GAMEWEEK", 38)

# ====== STATE ======
file_hashes = {}
running = True

# ====== SIGNALS ======
def _stop(signum, frame):
    global running
    print("[shutdown] SIGINT/SIGTERM received, stopping after current cycle…", flush=True)
    running = False

signal.signal(signal.SIGINT, _stop)
signal.signal(signal.SIGTERM, _stop)

# ====== UTILS ======
def log(msg: str):
    print(f"[{datetime.utcnow().isoformat()}] {msg}", flush=True)

def bust():
    return int(time.time())

def get_file_hash(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()

def smart_upload_bytes(blob_name: str, data: bytes, content_type: str = "text/plain", headers: dict = None) -> bool:
    new_hash = get_file_hash(data)
    if blob_name in file_hashes and file_hashes[blob_name] == new_hash:
        log(f"Skipped {blob_name} - no changes detected")
        return False

    try:
        request_headers = {"Content-Type": content_type}
        if headers:
            request_headers.update(headers)

        url = f"{UPLOAD_ENDPOINT}?name={blob_name}"
        r = requests.post(url, headers=request_headers, data=data, timeout=60)
        r.raise_for_status()
        file_hashes[blob_name] = new_hash
        log(f"Uploaded {blob_name} ({len(data)} bytes)")
        return True
    except Exception as e:
        log(f"Failed to upload {blob_name}: {e}")
        return False

def smart_upload_csv(blob_name: str, data: bytes) -> bool:
    return smart_upload_bytes(blob_name, data, content_type="text/csv")

def verify_file_accessible(blob_name: str, max_retries: int = 3, delay_seconds: float = 2.0) -> bool:
    verify_url = f"{PUBLIC_BASE}{blob_name}?v={bust()}"
    
    for attempt in range(1, max_retries + 1):
        try:
            log(f"Verifying {blob_name} accessibility (attempt {attempt}/{max_retries})")
            resp = requests.get(verify_url, timeout=15)
            
            if resp.status_code == 200:
                log(f"Verified {blob_name} is accessible")
                return True
            else:
                log(f"Verification failed for {blob_name}: HTTP {resp.status_code}")
                
        except Exception as e:
            log(f"Verification attempt {attempt} failed for {blob_name}: {e}")
        
        if attempt < max_retries:
            time.sleep(delay_seconds)
            delay_seconds *= 1.5
    
    log(f"Failed to verify {blob_name} after {max_retries} attempts")
    return False

def run_scraper(cmd: list[str], expect_file: Path, timeout_sec: int = 90) -> bytes:
    try:
        if expect_file.exists():
            expect_file.unlink()
    except Exception:
        pass

    log(f"Running: {' '.join(cmd)}")
    proc = subprocess.run(cmd, cwd="/app", capture_output=True, text=True, timeout=timeout_sec)

    if proc.returncode != 0:
        raise RuntimeError(f"Scraper failed ({cmd[0]}): {proc.stderr or proc.stdout}")

    if not expect_file.exists():
        raise FileNotFoundError(f"Expected output not found: {expect_file}")

    data = expect_file.read_bytes()
    if not data:
        raise RuntimeError(f"Output file is empty: {expect_file}")

    return data

def get_output_file_path(file_type: str, gw: int) -> Path:
    return Path(f"/app/fpl_{file_type}_gw{gw}.csv")

# ----- Blob naming helpers -----
def legacy_rosters_name(gw: int) -> str:
    return f"fpl_rosters_points_gw{gw}.csv"

def versioned_rosters_name(gw: int, content_hash: str) -> str:
    return f"fpl_rosters_points_gw{gw}-{content_hash[:10]}.csv"

def manifest_name() -> str:
    return "fpl-league-manifest.json"

# ====== SCRAPERS (No changes needed here) ======
def scrape_rosters_bytes(gw: int) -> bytes:
    output_file = get_output_file_path("rosters_points", gw)
    return run_scraper([
        "python3", "fpl_scrape_rosters.py",
        "--gw", str(gw),
        "--entries",
        "394273", "373574", "650881", "6197529", "1094601", "6256408", "62221", "701623",
        "3405299", "5438502", "5423005", "4807443", "581156", "4912819", "876871", "4070923",
        "5898648", "872442", "468791", "8592148"
    ], output_file)

# ====== GW DETECTION & GAME DAY (No changes needed here) ======
def detect_current_gameweek() -> int:
    log("Detecting current gameweek...")
    latest_gw = 1
    for gw in range(1, MAX_GAMEWEEK + 1):
        try:
            test_output = get_output_file_path("rosters_points", gw)
            test_cmd = ["python3", "fpl_scrape_rosters.py", "--gw", str(gw), "--entries", "394273"]
            proc = subprocess.run(test_cmd, cwd="/app", capture_output=True, text=True, timeout=30)
            if proc.returncode == 0 and test_output.exists() and test_output.stat().st_size > 0:
                latest_gw = gw
                if test_output.exists(): test_output.unlink()
            else:
                break
        except Exception:
            break
    log(f"Latest available gameweek: GW{latest_gw}")
    return latest_gw

def is_game_day() -> bool:
    now_utc = datetime.now(timezone.utc)
    # Simple check for UK DST
    is_dst = 3 <= now_utc.month <= 10 and now_utc.replace(month=3, day=31).weekday() <= now_utc.weekday()
    uk_offset = 1 if is_dst else 0
    uk_time = now_utc.replace(tzinfo=None) + timedelta(hours=uk_offset)
    weekday = uk_time.weekday()
    hour = uk_time.hour
    is_weekend = weekday in [5, 6] and 12 <= hour <= 22
    is_midweek = weekday in [1, 2, 3] and 18 <= hour <= 22
    return is_weekend or is_midweek

def get_dynamic_interval() -> int:
    if STATIC_INTERVAL > 0:
        return STATIC_INTERVAL
    return GAMEDAY_INTERVAL if is_game_day() else NON_GAMEDAY_INTERVAL

# ====== MAIN UPLOAD STEP (VERSIONED + MANIFEST) ======
def scrape_and_upload_gameweek(gw: int) -> bool:
    try:
        rosters_data = scrape_rosters_bytes(gw)
        h = get_file_hash(rosters_data)

        # Upload to LEGACY path (optional, for backward compatibility)
        smart_upload_csv(legacy_rosters_name(gw), rosters_data)

        # Upload to VERSIONED path (immutable)
        ver_name = versioned_rosters_name(gw, h)
        ver_url = f"{PUBLIC_BASE}{ver_name}"
        version_uploaded = smart_upload_csv(ver_name, rosters_data)

        if version_uploaded:
            log(f"New version uploaded for GW{gw}, updating manifest...")
            
            if not verify_file_accessible(ver_name):
                log(f"ERROR: Versioned file {ver_name} not accessible, aborting manifest update")
                return False

            # **STEP 1: Create a uniquely named pointer file for this new version**
            pointer_content = { "gw": gw, "url": ver_url, "hash": h, "updated": datetime.utcnow().isoformat() + "Z" }
            unique_id = str(uuid.uuid4())[:8]
            versioned_pointer_name = f"fpl_rosters_points_gw{gw}-latest-{unique_id}.json"
            
            smart_upload_bytes(
                versioned_pointer_name,
                json.dumps(pointer_content).encode("utf-8"),
                content_type="application/json"
            )
            versioned_pointer_url = f"{PUBLIC_BASE}{versioned_pointer_name}"
            log(f"Uploaded versioned pointer: {versioned_pointer_name}")

            # **STEP 2: Update the central manifest file to point to the new unique pointer**
            manifest_url = f"{PUBLIC_BASE}{manifest_name()}?v={bust()}"
            try:
                r = requests.get(manifest_url)
                manifest_data = r.json() if r.ok else {}
            except Exception:
                manifest_data = {}
            
            if 'gameweeks' not in manifest_data: manifest_data['gameweeks'] = {}
            manifest_data['gameweeks'][str(gw)] = versioned_pointer_url
            manifest_data['updated'] = datetime.utcnow().isoformat() + "Z"

            # **STEP 3: Upload the manifest with NO-CACHE headers**
            no_cache_headers = {"x-cache-control": "max-age=0, no-cache, must-revalidate"}
            manifest_uploaded = smart_upload_bytes(
                manifest_name(),
                json.dumps(manifest_data, indent=2).encode("utf-8"),
                content_type="application/json",
                headers=no_cache_headers
            )
            
            if manifest_uploaded:
                log(f"SUCCESS: Updated manifest for GW{gw} to point to {versioned_pointer_name}")
            else:
                log(f"ERROR: Failed to upload manifest for GW{gw}")
                return False
        else:
            log(f"GW{gw} content unchanged, manifest not updated")

        return True

    except Exception as e:
        log(f"GW{gw} ERROR: {e}")
        try:
            smart_upload_csv(legacy_rosters_name(gw), b"The game is being updated.")
        except Exception as upload_err:
            log(f"Failed to upload updating sentinel for GW{gw}: {upload_err}")
        return False

# ====== LOOP ======
if __name__ == "__main__":
    log("Booting dynamic FPL scraper worker (versioned uploads + manifest system)…")

    while running:
        cycle_start_time = datetime.utcnow()
        try:
            if ACTIVE != "1":
                log("inactive (ACTIVE=0)")
            else:
                latest_gw = detect_current_gameweek()
                successful = 0
                for gw in range(1, latest_gw + 1):
                    if scrape_and_upload_gameweek(gw):
                        successful += 1
                log(f"Full cycle complete: {successful}/{latest_gw} gameweeks successful")
        except Exception as e:
            log(f"GENERAL ERROR: {e}")

        interval = get_dynamic_interval()
        cycle_duration = (datetime.utcnow() - cycle_start_time).total_seconds()
        
        sleep_time = max(0, interval - cycle_duration)
        if sleep_time > 0:
            log(f"Sleeping for {sleep_time:.1f}s")
            slept = 0
            while running and slept < sleep_time:
                time.sleep(1)
                slept += 1

    log("Exited cleanly.")