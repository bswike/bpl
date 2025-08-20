# app.py
import os, requests, sys, subprocess
from datetime import datetime
from pathlib import Path

# Vercel provides a custom environment for serverless functions,
# which is why this file should not contain an endless loop.
# The Cron Job scheduler handles the repetition for us.

UPLOAD_ENDPOINT = os.getenv("BASE_UPLOAD_ENDPOINT", "https://swikle.com/api/upload-csv")

# Output CSV filenames your scripts produce
ALL_OUT = "fpl_all_players_gw1.csv"
ROSTERS_OUT = "fpl_rosters_points_gw1.csv"

# Stable blob names
ALL_BLOB = "fpl_all_players_gw1.csv"
ROSTERS_BLOB = "fpl_rosters_points_gw1.csv"

def log(msg: str):
    print(f"[{datetime.utcnow().isoformat()}] {msg}", flush=True)

def upload_csv(blob_name: str, data: bytes):
    url = f"{UPLOAD_ENDPOINT}?name={blob_name}"
    r = requests.post(url, headers={"Content-Type": "text/csv"}, data=data, timeout=60)
    r.raise_for_status()
    j = r.json()
    log(f"Uploaded {blob_name} -> {j.get('wrote')} ({len(data)} bytes)")

def run_scraper(cmd: list[str], expect_file_name: str, timeout_sec: int = 90) -> bytes:
    try:
        if os.path.exists(expect_file_name):
            os.unlink(expect_file_name)
    except Exception:
        pass

    log(f"Running: {' '.join(cmd)}")
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_sec, check=True)

    if not os.path.exists(expect_file_name):
        raise FileNotFoundError(f"Expected output not found: {expect_file_name}")

    data = Path(expect_file_name).read_bytes()
    if not data:
        raise RuntimeError(f"Output file is empty: {expect_file_name}")
    return data

def handler(event, context):
    """Vercel Serverless Function entry point."""
    log("Starting Vercel Cron Job task...")
    try:
        all_players_bytes = run_scraper([
            "python3", "fpl_scrape_ALL.py",
            "--gw", "1",
            "--entries",
            "394273", "373574", "650881", "6197529", "1094601", "6256408", "62221", "701623",
            "3405299", "5438502", "5423005", "4807443", "581156", "4912819", "876871", "4070923",
            "5898648", "872442", "468791", "8592148"
        ], ALL_OUT)
        upload_csv(ALL_BLOB, all_players_bytes)

        rosters_bytes = run_scraper([
            "python3", "fpl_scrape_rosters.py",
            "--gw", "1",
            "--entries",
            "394273", "373574", "650881", "6197529", "1094601", "6256408", "62221", "701623",
            "3405299", "5438502", "5423005", "4807443", "581156", "4912819", "876871", "4070923",
            "5898648", "872442", "468791", "8592148"
        ], ROSTERS_OUT)
        upload_csv(ROSTERS_BLOB, rosters_bytes)
        
        log("Cron Job task completed successfully!")
        return {"statusCode": 200, "body": "Cron job ran successfully"}

    except Exception as e:
        log(f"ERROR: {e}")
        return {"statusCode": 500, "body": f"Error during cron job: {e}"}