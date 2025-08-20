# app.py
import os, time, requests, sys, signal, subprocess
from datetime import datetime
from pathlib import Path

UPLOAD_ENDPOINT = os.getenv("BASE_UPLOAD_ENDPOINT", "https://swikle.com/api/upload-csv")

def _int_env(name, default):
    try:
        v = int(os.getenv(name, str(default)))
        return v if v >= 1 else default
    except Exception:
        return default

INTERVAL = _int_env("INTERVAL_SECONDS", 30)
ACTIVE   = os.getenv("ACTIVE", "1")

# Output CSV filenames your scripts produce
ALL_OUT = Path("/app/fpl_all_players_gw1.csv")
ROSTERS_OUT = Path("/app/fpl_rosters_points_gw1.csv")

# Stable blob names
ALL_BLOB = "fpl_all_players_gw1.csv"
ROSTERS_BLOB = "fpl_rosters_points_gw1.csv"

# Graceful shutdown
running = True
def _stop(*_):
    global running
    print("[shutdown] SIGINT/SIGTERM received, stopping after current cycle...", flush=True)
    running = False

signal.signal(signal.SIGINT, _stop)
signal.signal(signal.SIGTERM, _stop)

def log(msg: str):
    print(f"[{datetime.utcnow().isoformat()}] {msg}", flush=True)

def upload_csv(blob_name: str, data: bytes):
    url = f"{UPLOAD_ENDPOINT}?name={blob_name}"
    r = requests.post(url, headers={"Content-Type": "text/csv"}, data=data, timeout=60)
    r.raise_for_status()
    j = r.json()
    log(f"Uploaded {blob_name} → {j.get('wrote')} ({len(data)} bytes)")

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

def scrape_all_players_bytes() -> bytes:
    return run_scraper([
        "python3", "fpl_scrape_ALL.py",
        "--gw", "1",
        "--entries",
        "394273", "373574", "650881", "6197529", "1094601", "6256408", "62221", "701623",
        "3405299", "5438502", "5423005", "4807443", "581156", "4912819", "876871", "4070923",
        "5898648", "872442", "468791", "8592148"
    ], ALL_OUT)

def scrape_rosters_bytes() -> bytes:
    return run_scraper([
        "python3", "fpl_scrape_rosters.py",
        "--gw", "1",
        "--entries",
        "394273", "373574", "650881", "6197529", "1094601", "6256408", "62221", "701623",
        "3405299", "5438502", "5423005", "4807443", "581156", "4912819", "876871", "4070923",
        "5898648", "872442", "468791", "8592148"
    ], ROSTERS_OUT)

if __name__ == "__main__":
    log("Booting worker...")
    while running:
        try:
            if ACTIVE != "1":
                log("inactive (ACTIVE=0)")
            else:
                all_players = scrape_all_players_bytes()
                upload_csv(ALL_BLOB, all_players)

                rosters = scrape_rosters_bytes()
                upload_csv(ROSTERS_BLOB, rosters)

                log("cycle OK")
        except Exception as e:
            log(f"ERROR: {e}")

        # sleep in 1s chunks
        slept = 0
        while running and slept < INTERVAL:
            time.sleep(1)
            slept += 1

    log("Exited cleanly.")
