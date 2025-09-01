import os, time, requests, sys, signal, subprocess
from datetime import datetime
from pathlib import Path

UPLOAD_ENDPOINT = os.getenv(“BASE_UPLOAD_ENDPOINT”, “https://swikle.com/api/upload-csv”)

def _int_env(name, default):
try:
v = int(os.getenv(name, str(default)))
return v if v >= 1 else default
except Exception:
return default

INTERVAL = _int_env(“INTERVAL_SECONDS”, 300)  # 5 minutes
ACTIVE   = os.getenv(“ACTIVE”, “1”)

# Output CSV filenames your scripts produce

ALL_OUT_GW1 = Path(”/app/fpl_all_players_gw1.csv”)
ROSTERS_OUT_GW1 = Path(”/app/fpl_rosters_points_gw1.csv”)
ALL_OUT_GW2 = Path(”/app/fpl_all_players_gw2.csv”)
ROSTERS_OUT_GW2 = Path(”/app/fpl_rosters_points_gw2.csv”)
ALL_OUT_GW3 = Path(”/app/fpl_all_players_gw3.csv”)
ROSTERS_OUT_GW3 = Path(”/app/fpl_rosters_points_gw3.csv”)

# Stable blob names

ALL_BLOB_GW1 = “fpl_all_players_gw1.csv”
ROSTERS_BLOB_GW1 = “fpl_rosters_points_gw1.csv”
ALL_BLOB_GW2 = “fpl_all_players_gw2.csv”
ROSTERS_BLOB_GW2 = “fpl_rosters_points_gw2.csv”
ALL_BLOB_GW3 = “fpl_all_players_gw3.csv”
ROSTERS_BLOB_GW3 = “fpl_rosters_points_gw3.csv”

# Graceful shutdown

running = True
def _stop(signum, frame):
global running
print(”[shutdown] SIGINT/SIGTERM received, stopping after current cycle…”, flush=True)
running = False

signal.signal(signal.SIGINT, _stop)
signal.signal(signal.SIGTERM, _stop)

def log(msg: str):
print(f”[{datetime.utcnow().isoformat()}] {msg}”, flush=True)

def upload_csv(blob_name: str, data: bytes):
url = f”{UPLOAD_ENDPOINT}?name={blob_name}”
r = requests.post(url, headers={“Content-Type”: “text/csv”}, data=data, timeout=60)
r.raise_for_status()
j = r.json()
log(f”Uploaded {blob_name} → {j.get(‘wrote’)} ({len(data)} bytes)”)

def run_scraper(cmd: list[str], expect_file: Path, timeout_sec: int = 90) -> bytes:
try:
if expect_file.exists():
expect_file.unlink()
except Exception:
pass

```
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
```

def scrape_all_players_bytes(gw: int) -> bytes:
if gw == 1:
output_file = ALL_OUT_GW1
elif gw == 2:
output_file = ALL_OUT_GW2
else:  # gw == 3
output_file = ALL_OUT_GW3

```
return run_scraper([
    "python3", "fpl_scrape_ALL.py",
    "--gw", str(gw),  # This sets the gameweek parameter
    "--entries",
    "394273", "373574", "650881", "6197529", "1094601", "6256408", "62221", "701623",
    "3405299", "5438502", "5423005", "4807443", "581156", "4912819", "876871", "4070923",
    "5898648", "872442", "468791", "8592148"
], output_file)
```

def scrape_rosters_bytes(gw: int) -> bytes:
if gw == 1:
output_file = ROSTERS_OUT_GW1
elif gw == 2:
output_file = ROSTERS_OUT_GW2
else:  # gw == 3
output_file = ROSTERS_OUT_GW3

```
return run_scraper([
    "python3", "fpl_scrape_rosters.py",
    "--gw", str(gw),  # This sets the gameweek parameter
    "--entries",
    "394273", "373574", "650881", "6197529", "1094601", "6256408", "62221", "701623",
    "3405299", "5438502", "5423005", "4807443", "581156", "4912819", "876871", "4070923",
    "5898648", "872442", "468791", "8592148"
], output_file)
```

if **name** == “**main**”:
log(“Booting worker…”)
while running:
try:
if ACTIVE != “1”:
log(“inactive (ACTIVE=0)”)
else:
# Scrape and upload GW1 data
try:
all_players_gw1 = scrape_all_players_bytes(1)
upload_csv(ALL_BLOB_GW1, all_players_gw1)

```
                rosters_gw1 = scrape_rosters_bytes(1)
                upload_csv(ROSTERS_BLOB_GW1, rosters_gw1)
                
                log("GW1 cycle OK")
            except Exception as e:
                log(f"GW1 ERROR: {e}")
            
            # Scrape and upload GW2 data
            try:
                all_players_gw2 = scrape_all_players_bytes(2)
                upload_csv(ALL_BLOB_GW2, all_players_gw2)
                
                rosters_gw2 = scrape_rosters_bytes(2)
                upload_csv(ROSTERS_BLOB_GW2, rosters_gw2)
                
                log("GW2 cycle OK")
            except Exception as e:
                log(f"GW2 ERROR: {e}")
                # If GW2 fails, upload "updating" message
                updating_msg = b"The game is being updated."
                upload_csv(ROSTERS_BLOB_GW2, updating_msg)
                log("Uploaded GW2 updating message")
            
            # Scrape and upload GW3 data
            try:
                all_players_gw3 = scrape_all_players_bytes(3)
                upload_csv(ALL_BLOB_GW3, all_players_gw3)
                
                rosters_gw3 = scrape_rosters_bytes(3)
                upload_csv(ROSTERS_BLOB_GW3, rosters_gw3)
                
                log("GW3 cycle OK")
            except Exception as e:
                log(f"GW3 ERROR: {e}")
                # If GW3 fails, upload "updating" message
                updating_msg = b"The game is being updated."
                upload_csv(ROSTERS_BLOB_GW3, updating_msg)
                log("Uploaded GW3 updating message")
            
            log("Full cycle complete")
            
    except Exception as e:
        log(f"GENERAL ERROR: {e}")
    
    # Sleep in 1s chunks
    slept = 0
    while running and slept < INTERVAL:
        time.sleep(1)
        slept += 1

log("Exited cleanly.")
