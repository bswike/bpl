import os, time, requests, sys, signal, subprocess
from datetime import datetime, timezone, timedelta
from pathlib import Path

UPLOAD_ENDPOINT = os.getenv("BASE_UPLOAD_ENDPOINT", "https://swikle.com/api/upload-csv")

def _int_env(name, default):
    try:
        v = int(os.getenv(name, str(default)))
        return v if v >= 1 else default
    except Exception:
        return default

# Dynamic interval settings
GAMEDAY_INTERVAL = _int_env("GAMEDAY_INTERVAL_SECONDS", 300)  # 5 minutes on game days
NON_GAMEDAY_INTERVAL = _int_env("NON_GAMEDAY_INTERVAL_SECONDS", 10000)  # ~2.7 hours on non-game days
STATIC_INTERVAL = _int_env("INTERVAL_SECONDS", 0)  # Manual override if set

ACTIVE = os.getenv("ACTIVE", "1")
MAX_GAMEWEEK = _int_env("MAX_GAMEWEEK", 38)

# Graceful shutdown
running = True

def _stop(signum, frame):
    global running
    print("[shutdown] SIGINT/SIGTERM received, stopping after current cycle…", flush=True)
    running = False

signal.signal(signal.SIGINT, _stop)
signal.signal(signal.SIGTERM, _stop)

def log(msg: str):
    print(f"[{datetime.utcnow().isoformat()}] {msg}", flush=True)

def is_game_day() -> bool:
    """
    Determine if today is likely a game day based on several factors:
    1. Day of the week (Premier League typically plays Sat/Sun, some midweek)
    2. Recent data changes (if data is updating frequently, it's probably a game day)
    3. Time of day (games typically between 12:30 PM and 10 PM UK time)
    """
    now_utc = datetime.now(timezone.utc)
    
    # Convert to UK time (UTC+0 in winter, UTC+1 in summer)
    # Simple approximation: assume UTC+1 from March-October
    uk_offset = 1 if 3 <= now_utc.month <= 10 else 0
    uk_time = now_utc.replace(tzinfo=None) + timedelta(hours=uk_offset)
    
    weekday = uk_time.weekday()  # 0=Monday, 6=Sunday
    hour = uk_time.hour
    
    log(f"Current UK time: {uk_time.strftime('%Y-%m-%d %H:%M:%S')} (weekday: {weekday})")
    
    # Time-based check: Games typically between 12:30 PM and 10 PM UK time
    is_game_time = 12 <= hour <= 22
    
    # Day-based check: Premier League games typically on:
    # Saturday (5), Sunday (6), Tuesday (1), Wednesday (2), Thursday (3)
    is_typical_game_day = weekday in [1, 2, 3, 5, 6]  # Tue, Wed, Thu, Sat, Sun
    
    # Strong indicators for game day
    is_weekend = weekday in [5, 6]  # Saturday or Sunday
    is_midweek_evening = weekday in [1, 2, 3] and 18 <= hour <= 22  # Tue/Wed/Thu evening
    
    # Primary logic: Weekend or midweek evening during game hours
    primary_game_day = (is_weekend and is_game_time) or is_midweek_evening
    
    # Secondary logic: Any typical game day during game hours
    secondary_game_day = is_typical_game_day and is_game_time
    
    # Use primary logic, but log additional info
    result = primary_game_day
    
    log(f"Game day check: weekend={is_weekend}, midweek_evening={is_midweek_evening}, "
        f"game_time={is_game_time}, typical_day={is_typical_game_day} -> {result}")
    
    return result

def get_dynamic_interval() -> int:
    """
    Return the appropriate polling interval based on whether it's a game day
    and any manual overrides.
    """
    # If INTERVAL_SECONDS is manually set (non-zero), use that
    if STATIC_INTERVAL > 0:
        log(f"Using manual interval override: {STATIC_INTERVAL} seconds")
        return STATIC_INTERVAL
    
    # Otherwise, use dynamic detection
    if is_game_day():
        log(f"Game day detected - using fast interval: {GAMEDAY_INTERVAL} seconds")
        return GAMEDAY_INTERVAL
    else:
        log(f"Non-game day - using slow interval: {NON_GAMEDAY_INTERVAL} seconds")
        return NON_GAMEDAY_INTERVAL

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

def get_output_file_path(file_type: str, gw: int) -> Path:
    """Generate dynamic file paths for any gameweek"""
    return Path(f"/app/fpl_{file_type}_gw{gw}.csv")

def get_blob_name(file_type: str, gw: int) -> str:
    """Generate dynamic blob names for any gameweek"""
    return f"fpl_{file_type}_gw{gw}.csv"

def scrape_all_players_bytes(gw: int) -> bytes:
    output_file = get_output_file_path("all_players", gw)
    
    return run_scraper([
        "python3", "fpl_scrape_ALL.py",
        "--gw", str(gw),
        "--entries",
        "394273", "373574", "650881", "6197529", "1094601", "6256408", "62221", "701623",
        "3405299", "5438502", "5423005", "4807443", "581156", "4912819", "876871", "4070923",
        "5898648", "872442", "468791", "8592148"
    ], output_file)

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

def detect_current_gameweek() -> int:
    """
    Detect the current gameweek by trying to scrape data.
    Returns the highest gameweek number that successfully produces data.
    """
    log("Detecting current gameweek...")
    
    # Start from GW1 and work up to find the latest available
    latest_gw = 1
    
    for gw in range(1, MAX_GAMEWEEK + 1):
        try:
            log(f"Testing GW{gw} availability...")
            
            # Try a quick scrape test - if it fails, this GW isn't ready yet
            test_output = get_output_file_path("rosters_points", gw)
            test_cmd = [
                "python3", "fpl_scrape_rosters.py",
                "--gw", str(gw),
                "--entries", "394273"  # Just test with one entry
            ]
            
            # Quick test with shorter timeout
            proc = subprocess.run(test_cmd, cwd="/app", capture_output=True, text=True, timeout=30)
            
            if proc.returncode == 0 and test_output.exists() and test_output.stat().st_size > 0:
                latest_gw = gw
                log(f"GW{gw} is available")
                # Clean up test file
                try:
                    test_output.unlink()
                except:
                    pass
            else:
                log(f"GW{gw} not available yet - stopping detection")
                break
                
        except (subprocess.TimeoutExpired, Exception) as e:
            log(f"GW{gw} not available: {e}")
            break
    
    log(f"Latest available gameweek: GW{latest_gw}")
    return latest_gw

def scrape_and_upload_gameweek(gw: int):
    """Scrape and upload data for a specific gameweek"""
    try:
        # Scrape all players data
        all_players_data = scrape_all_players_bytes(gw)
        all_players_blob = get_blob_name("all_players", gw)
        upload_csv(all_players_blob, all_players_data)
        
        # Scrape rosters data
        rosters_data = scrape_rosters_bytes(gw)
        rosters_blob = get_blob_name("rosters_points", gw)
        upload_csv(rosters_blob, rosters_data)
        
        log(f"GW{gw} cycle OK")
        return True
        
    except Exception as e:
        log(f"GW{gw} ERROR: {e}")
        
        # Upload "updating" message for rosters (the main file the frontend uses)
        try:
            updating_msg = b"The game is being updated."
            rosters_blob = get_blob_name("rosters_points", gw)
            upload_csv(rosters_blob, updating_msg)
            log(f"Uploaded GW{gw} updating message")
        except Exception as upload_err:
            log(f"Failed to upload updating message for GW{gw}: {upload_err}")
        
        return False

if __name__ == "__main__":
    log("Booting dynamic FPL scraper worker with smart game day detection…")
    
    while running:
        cycle_start_time = datetime.utcnow()
        
        try:
            if ACTIVE != "1":
                log("inactive (ACTIVE=0)")
            else:
                # Detect the current gameweek range
                latest_gw = detect_current_gameweek()
                
                # Scrape all available gameweeks (GW1 through latest)
                successful_scrapes = 0
                for gw in range(1, latest_gw + 1):
                    if scrape_and_upload_gameweek(gw):
                        successful_scrapes += 1
                
                log(f"Full cycle complete: {successful_scrapes}/{latest_gw} gameweeks successful")
                
        except Exception as e:
            log(f"GENERAL ERROR: {e}")
        
        # Determine the next interval dynamically
        interval = get_dynamic_interval()
        
        # Calculate time elapsed during this cycle
        cycle_duration = (datetime.utcnow() - cycle_start_time).total_seconds()
        log(f"Cycle took {cycle_duration:.1f} seconds")
        
        # Adjust sleep time to account for processing time
        sleep_time = max(0, interval - cycle_duration)
        
        if sleep_time > 0:
            log(f"Sleeping for {sleep_time:.1f} seconds (interval: {interval}s, cycle: {cycle_duration:.1f}s)")
            
            # Sleep in 1s chunks so we can respond to shutdown signals
            slept = 0
            while running and slept < sleep_time:
                time.sleep(1)
                slept += 1
        else:
            log(f"Cycle took longer than interval ({cycle_duration:.1f}s > {interval}s) - starting next cycle immediately")

    log("Exited cleanly.")