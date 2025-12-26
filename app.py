"""
Unified FPL app for Fly.io + Upstash Redis
Combines your existing scraper with SSE server
"""

import os, time, requests, signal, subprocess, hashlib, json, uuid, threading
from datetime import datetime, timezone, timedelta
from pathlib import Path
from flask import Flask, Response
from flask_cors import CORS
import concurrent.futures

# Add at top of file with other globals
chips_cache = {"data": None, "timestamp": 0}
chips_cache_lock = threading.Lock()
CHIPS_CACHE_DURATION = 3600  # 1 hour in seconds

# ====== REDIS CONNECTION (Upstash) ======
try:
    import redis
    redis_client = redis.Redis(
        host=os.getenv('REDIS_HOST', 'localhost'),
        port=int(os.getenv('REDIS_PORT', 6379)),
        password=os.getenv('REDIS_PASSWORD'),
        decode_responses=True,
        ssl=True,
        ssl_cert_reqs=None,
        socket_connect_timeout=5,
        socket_timeout=5,
        retry_on_timeout=True
    )
    redis_client.ping()
    REDIS_ENABLED = True
    print("[redis] Connected to Upstash successfully", flush=True)
except Exception as e:
    REDIS_ENABLED = False
    print(f"[redis] Connection failed: {e}. Push notifications disabled.", flush=True)

# ====== CONFIG ======
UPLOAD_ENDPOINT = os.getenv("BASE_UPLOAD_ENDPOINT", "https://swikle.com/api/upload-csv")
PUBLIC_BASE = os.getenv("PUBLIC_BASE", "https://1b0s3gmik3fqhcvt.public.blob.vercel-storage.com/")

def _int_env(name, default):
    try:
        v = int(os.getenv(name, str(default)))
        return v if v >= 1 else default
    except Exception:
        return default

GAMEDAY_INTERVAL = _int_env("GAMEDAY_INTERVAL_SECONDS", 30)
NON_GAMEDAY_INTERVAL = _int_env("NON_GAMEDAY_INTERVAL_SECONDS", 600)
STATIC_INTERVAL = _int_env("INTERVAL_SECONDS", 0)
ACTIVE = os.getenv("ACTIVE", "1")
MAX_GAMEWEEK = _int_env("MAX_GAMEWEEK", 38)
CHANNEL_NAME = 'fpl_updates'

# ====== STATE ======
file_hashes = {}
scraper_running = True
current_manifest = {"gameweeks": {}, "version": None, "timestamp": None, "updated": None}
manifest_lock = threading.Lock()

# ====== FLASK SSE SERVER ======
app = Flask(__name__)

# Configure CORS for your frontend
CORS(app, origins=[
    "http://localhost:3000",
    "http://localhost:5173",
    "https://*.vercel.app",
    os.getenv("FRONTEND_URL", "*")
], resources={r"/*": {"origins": "*"}})

# ====== UTILITIES ======
def log(msg: str):
    print(f"[{datetime.utcnow().isoformat()}] {msg}", flush=True)

def bust():
    return int(time.time())

def get_file_hash(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()

# ====== MANIFEST MANAGEMENT ======
def update_manifest_in_memory(manifest_data):
    """Update the in-memory manifest (thread-safe)"""
    global current_manifest
    with manifest_lock:
        current_manifest = manifest_data.copy()
        log(f"[manifest] Updated in-memory manifest to version {manifest_data.get('version')}")

# ====== PUSH NOTIFICATION ======
def publish_update(event_type: str, data: dict):
    """Publish update event to Redis for SSE clients"""
    if not REDIS_ENABLED:
        return
    
    try:
        message = {
            'type': event_type,
            'timestamp': int(time.time()),
            'data': data
        }
        redis_client.publish(CHANNEL_NAME, json.dumps(message))
        log(f"[push] Published {event_type} event")
    except Exception as e:
        log(f"[push] Failed to publish: {e}")

# ====== SSE ROUTES ======
def event_stream():
    """Generator that yields SSE formatted messages with reconnection handling"""
    max_retries = 3
    retry_count = 0
    
    while retry_count < max_retries:
        pubsub = None
        try:
            pubsub = redis_client.pubsub()
            pubsub.subscribe(CHANNEL_NAME)
            
            # Send initial connection message
            yield f"data: {json.dumps({'type': 'connected', 'timestamp': int(time.time())})}\n\n"
            
            last_heartbeat = time.time()
            last_message = time.time()
            
            for message in pubsub.listen():
                current_time = time.time()
                last_message = current_time
                
                # Send heartbeat every 30 seconds
                if current_time - last_heartbeat > 30:
                    yield f"data: {json.dumps({'type': 'heartbeat', 'timestamp': int(current_time)})}\n\n"
                    last_heartbeat = current_time
                
                # Check for stale connection (no messages for 5 minutes)
                if current_time - last_message > 300:
                    log("[SSE] Connection appears stale, reconnecting...")
                    raise ConnectionError("Stale connection detected")
                
                # Process actual messages
                if message['type'] == 'message':
                    try:
                        yield f"data: {message['data']}\n\n"
                    except:
                        continue
                        
        except Exception as e:
            log(f"[SSE] Stream error: {e}, retrying... ({retry_count + 1}/{max_retries})")
            retry_count += 1
            if retry_count < max_retries:
                time.sleep(2 ** retry_count)
            else:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Connection lost'})}\n\n"
                break
        finally:
            if pubsub:
                try:
                    pubsub.close()
                except:
                    pass

@app.route('/sse/fpl-updates')
def sse_endpoint():
    """SSE endpoint that clients connect to"""
    if not REDIS_ENABLED:
        return {'error': 'Redis not available'}, 503
    
    return Response(
        event_stream(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache, no-transform',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive',
            'Content-Type': 'text/event-stream'
        }
    )

@app.route('/health')
def health():
    """Health check endpoint"""
    redis_status = 'unknown'
    try:
        if REDIS_ENABLED:
            redis_client.ping()
            redis_status = 'connected'
        else:
            redis_status = 'disabled'
    except:
        redis_status = 'error'
    
    status = {
        'status': 'healthy' if redis_status in ['connected', 'disabled'] else 'degraded',
        'redis': redis_status,
        'scraper': 'running' if scraper_running else 'stopped',
        'timestamp': int(time.time())
    }
    
    code = 200 if status['status'] == 'healthy' else 503
    return status, code

@app.route('/')
def root():
    """Info page"""
    return {
        'service': 'FPL Dashboard Backend',
        'version': '2.3-no-pointers',
        'endpoints': {
            'sse': '/sse/fpl-updates',
            'health': '/health',
            'fixtures': '/api/fixtures',
            'manifest': '/api/manifest',
            'data': '/api/data/<gameweek>'
        },
        'features': {
            'redis': REDIS_ENABLED,
            'push_notifications': REDIS_ENABLED,
            'in_memory_manifest': True,
            'cdn_bypass': True
        }
    }

@app.route('/api/manifest')
def get_manifest():
    """Serve manifest directly from memory with no caching"""
    with manifest_lock:
        manifest_copy = current_manifest.copy()
    
    log(f"[manifest] Served manifest version {manifest_copy.get('version')}")
    
    return manifest_copy, 200, {
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
    }

@app.route('/api/fixtures')
def get_fixtures():
    """Fetch and return FPL fixture data with player mappings"""
    try:
        # Fetch bootstrap data (includes teams and players)
        bootstrap_response = requests.get(
            'https://fantasy.premierleague.com/api/bootstrap-static/',
            timeout=10
        )
        bootstrap_response.raise_for_status()
        bootstrap_data = bootstrap_response.json()
        
        # Fetch fixtures
        fixtures_response = requests.get(
            'https://fantasy.premierleague.com/api/fixtures/',
            timeout=10
        )
        fixtures_response.raise_for_status()
        fixtures_data = fixtures_response.json()
        
        # Build team map
        team_map = {str(team['id']): team['short_name'] for team in bootstrap_data['teams']}
        
        # Build player-to-team map with multiple name formats
        player_team_map = {}
        for player in bootstrap_data['elements']:
            team_name = team_map[str(player['team'])]
            
            # Add web_name (short name)
            player_team_map[player['web_name']] = team_name
            
            # Add full name
            full_name = f"{player['first_name']} {player['second_name']}"
            player_team_map[full_name] = team_name
            
            # Add second_name only (most common in your CSV)
            player_team_map[player['second_name']] = team_name
        
        log(f"[fixtures] Served {len(fixtures_data)} fixtures with {len(team_map)} teams and {len(player_team_map)} player mappings")
        
        return {
            'fixtures': fixtures_data,
            'teamMap': team_map,
            'playerTeamMap': player_team_map
        }, 200
        
    except Exception as e:
        log(f"[fixtures] Error fetching data: {e}")
        return {'error': 'Failed to fetch fixture data'}, 500

@app.route('/api/data/<int:gameweek>')
def get_gameweek_data(gameweek):
    """Serve CSV data directly through backend to bypass CDN caching"""
    try:
        with manifest_lock:
            gw_entry = current_manifest.get('gameweeks', {}).get(str(gameweek))
        
        if not gw_entry:
            return {'error': f'No data for GW{gameweek}'}, 404
        
        # Handle both old (string pointer URL) and new (object) formats
        if isinstance(gw_entry, str):
            # Old format: pointer URL - fetch it first
            log(f"[proxy] GW{gameweek} using old pointer format")
            pointer_res = requests.get(f"{gw_entry}?_t={int(time.time())}", timeout=10)
            pointer_res.raise_for_status()
            gw_info = pointer_res.json()
        else:
            # New format: direct object
            gw_info = gw_entry
        
        csv_url = gw_info.get('url')
        if not csv_url:
            return {'error': 'Invalid gameweek data'}, 500
        
        # Fetch CSV from Vercel Blob with aggressive cache busting
        bust_param = f"?_t={int(time.time())}&_r={uuid.uuid4().hex[:8]}"
        response = requests.get(f"{csv_url}{bust_param}", timeout=10)
        response.raise_for_status()
        
        log(f"[proxy] Served GW{gameweek} data ({len(response.content)} bytes)")
        
        return response.content, 200, {
            'Content-Type': 'text/csv',
            'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
        
    except requests.exceptions.RequestException as e:
        log(f"[proxy] Error fetching GW{gameweek} from blob: {e}")
        return {'error': 'Failed to fetch data from storage'}, 500
    except Exception as e:
        log(f"[proxy] Error serving GW{gameweek}: {e}")
        return {'error': 'Internal server error'}, 500

# Cache for gameweek status
gw_status_cache = {"data": None, "timestamp": 0}
gw_status_cache_lock = threading.Lock()
GW_STATUS_CACHE_DURATION = 60  # 1 minute

@app.route('/api/gameweek-status')
def get_gameweek_status():
    """Return current and next gameweek info including deadlines"""
    current_time = time.time()
    
    with gw_status_cache_lock:
        if gw_status_cache["data"] and (current_time - gw_status_cache["timestamp"]) < GW_STATUS_CACHE_DURATION:
            return gw_status_cache["data"], 200
    
    try:
        res = requests.get("https://fantasy.premierleague.com/api/bootstrap-static/", timeout=10)
        res.raise_for_status()
        data = res.json()
        
        events = data.get('events', [])
        current_gw = None
        next_gw = None
        
        for event in events:
            if event.get('is_current'):
                current_gw = {
                    'id': event['id'],
                    'name': f"GW{event['id']}",
                    'deadline_time': event['deadline_time'],
                    'finished': event.get('finished', False),
                    'is_current': True
                }
            if event.get('is_next'):
                next_gw = {
                    'id': event['id'],
                    'name': f"GW{event['id']}",
                    'deadline_time': event['deadline_time'],
                    'is_next': True
                }
        
        result = {
            'current_gameweek': current_gw,
            'next_gameweek': next_gw
        }
        
        with gw_status_cache_lock:
            gw_status_cache["data"] = result
            gw_status_cache["timestamp"] = current_time
        
        log(f"[gw-status] Served GW status: current={current_gw['id'] if current_gw else None}, next={next_gw['id'] if next_gw else None}")
        return result, 200
        
    except Exception as e:
        log(f"[gw-status] Error: {e}")
        return {'error': 'Failed to fetch gameweek status'}, 500

# Cache for historical data (never changes, so cache for 1 hour)
historical_cache = {"data": None, "version": None, "timestamp": 0}
historical_cache_lock = threading.Lock()
HISTORICAL_CACHE_DURATION = 3600  # 1 hour

@app.route('/api/historical')
def get_historical_data():
    """Return all historical gameweeks (except latest) in one response - massively faster for first load"""
    try:
        with manifest_lock:
            manifest_copy = current_manifest.copy()
        
        gameweeks = sorted([int(gw) for gw in manifest_copy.get('gameweeks', {}).keys()])
        if len(gameweeks) < 2:
            return {'gameweeks': {}, 'latest': gameweeks[0] if gameweeks else None}, 200
        
        latest_gw = gameweeks[-1]
        historical_gws = gameweeks[:-1]  # All except latest
        
        current_time = time.time()
        manifest_version = manifest_copy.get('version')
        
        # Check cache - only valid if manifest version matches
        with historical_cache_lock:
            if (historical_cache["data"] and 
                historical_cache["version"] == manifest_version and
                (current_time - historical_cache["timestamp"]) < HISTORICAL_CACHE_DURATION):
                log(f"[historical] Served from cache ({len(historical_cache['data'])} gameweeks)")
                return {
                    'gameweeks': historical_cache["data"],
                    'latest': latest_gw,
                    'cached': True
                }, 200
        
        log(f"[historical] Fetching GWs {historical_gws[0]}-{historical_gws[-1]} concurrently...")
        
        def fetch_and_parse_gw(gw):
            try:
                gw_entry = manifest_copy.get('gameweeks', {}).get(str(gw))
                if not gw_entry:
                    return gw, []
                
                if isinstance(gw_entry, str):
                    pointer_res = requests.get(f"{gw_entry}?_t={int(time.time())}", timeout=10)
                    pointer_res.raise_for_status()
                    gw_info = pointer_res.json()
                else:
                    gw_info = gw_entry
                
                csv_url = gw_info.get('url')
                if not csv_url:
                    return gw, []
                
                response = requests.get(csv_url, timeout=10)
                response.raise_for_status()
                csv_text = response.content.decode('utf-8')
                
                if csv_text.strip() == "The game is being updated.":
                    return gw, []
                
                # Parse CSV to list of dicts
                import csv
                from io import StringIO
                reader = csv.DictReader(StringIO(csv_text))
                rows = list(reader)
                
                return gw, rows
            except Exception as e:
                log(f"[historical] Error fetching GW{gw}: {e}")
                return gw, []
        
        # Fetch all historical GWs concurrently
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            results = list(executor.map(fetch_and_parse_gw, historical_gws))
        
        # Build response
        gw_data = {str(gw): rows for gw, rows in results if rows}
        
        # Cache the result
        with historical_cache_lock:
            historical_cache["data"] = gw_data
            historical_cache["version"] = manifest_version
            historical_cache["timestamp"] = current_time
        
        log(f"[historical] Served {len(gw_data)} gameweeks ({sum(len(r) for r in gw_data.values())} total rows)")
        
        return {
            'gameweeks': gw_data,
            'latest': latest_gw,
            'cached': False
        }, 200
        
    except Exception as e:
        log(f"[historical] Error: {e}")
        return {'error': 'Failed to fetch historical data'}, 500
    
@app.route('/api/chips')
def get_chips():
    """Fetch chip usage for all managers (concurrent + 1-hour cache)"""
    try:
        current_time = time.time()
        
        # Check cache first
        with chips_cache_lock:
            if chips_cache["data"] and (current_time - chips_cache["timestamp"]) < CHIPS_CACHE_DURATION:
                log(f"[chips] Served from cache ({len(chips_cache['data'])} managers)")
                return {'chips': chips_cache["data"]}, 200
        
        # Cache miss - fetch fresh data concurrently
        log("[chips] Cache miss, fetching from FPL API concurrently...")
        entry_ids = [
            394273, 373574, 650881, 6197529, 1094601, 6256408, 62221, 701623,
            3405299, 5438502, 5423005, 4807443, 581156, 4912819, 876871, 4070923,
            5898648, 872442, 468791, 8592148
        ]
        
        def fetch_manager_chips(entry_id):
            try:
                entry_res = requests.get(f'https://fantasy.premierleague.com/api/entry/{entry_id}/', timeout=10)
                entry_res.raise_for_status()
                entry_data = entry_res.json()
                
                manager_name = f"{entry_data['player_first_name']} {entry_data['player_last_name']}"
                
                history_res = requests.get(f'https://fantasy.premierleague.com/api/entry/{entry_id}/history/', timeout=10)
                history_res.raise_for_status()
                history_data = history_res.json()
                
                return {
                    'manager_name': manager_name,
                    'entry_id': entry_id,
                    'chips': history_data.get('chips', [])
                }
            except Exception as e:
                log(f"[chips] Error fetching data for entry {entry_id}: {e}")
                return None
        
        # Fetch all managers concurrently (max 10 parallel requests)
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            results = list(executor.map(fetch_manager_chips, entry_ids))
        
        chips_data = [r for r in results if r is not None]
        
        # Update cache
        with chips_cache_lock:
            chips_cache["data"] = chips_data
            chips_cache["timestamp"] = current_time
        
        log(f"[chips] Served fresh data for {len(chips_data)} managers (concurrent fetch), cached for 1 hour")
        return {'chips': chips_data}, 200
        
    except Exception as e:
        log(f"[chips] Error: {e}")
        return {'error': 'Failed to fetch chip data'}, 500

# ====== YOUR EXISTING SCRAPER LOGIC ======
def smart_upload_bytes(blob_name: str, data: bytes, content_type: str = "text/plain", headers: dict = None) -> bool:
    new_hash = get_file_hash(data)
    if blob_name in file_hashes and file_hashes[blob_name] == new_hash:
        log(f"Skipped {blob_name} - no changes detected")
        return False

    try:
        request_headers = {
            "Content-Type": content_type,
            "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0"
        }
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
    is_dst = 3 <= now_utc.month <= 10 and now_utc.replace(month=3, day=31).weekday() <= now_utc.weekday()
    uk_offset = 1 if is_dst else 0
    uk_time = now_utc.replace(tzinfo=None) + timedelta(hours=uk_offset)
    weekday = uk_time.weekday()
    hour = uk_time.hour
    minute = uk_time.minute
    
    is_weekend = weekday in [5, 6] and 12 <= hour <= 22
    is_midweek = weekday in [1, 2, 3] and 18 <= hour <= 22
    
    # Friday 8pm-10:30pm UK time (3pm-5:30pm EST)
    is_friday_early = weekday == 4 and (hour == 20 or hour == 21 or (hour == 22 and minute <= 30))
    
    return is_weekend or is_midweek or is_friday_early

def get_dynamic_interval() -> int:
    if STATIC_INTERVAL > 0:
        return STATIC_INTERVAL
    return GAMEDAY_INTERVAL if is_game_day() else NON_GAMEDAY_INTERVAL

# ====== ENHANCED UPLOAD WITH PUSH ======
def scrape_and_upload_gameweek(gw: int) -> bool:
    try:
        rosters_data = scrape_rosters_bytes(gw)
        h = get_file_hash(rosters_data)

        # Upload to legacy path
        smart_upload_csv(f"fpl_rosters_points_gw{gw}.csv", rosters_data)

        # Upload to versioned path
        ver_name = f"fpl_rosters_points_gw{gw}-{h[:10]}.csv"
        ver_url = f"{PUBLIC_BASE}{ver_name}"
        version_uploaded = smart_upload_csv(ver_name, rosters_data)

        if version_uploaded:
            log(f"New version uploaded for GW{gw}, updating manifest...")
            
            # Update manifest directly - NO MORE POINTER FILES
            manifest_name = "fpl-league-manifest.json"
            manifest_url = f"{PUBLIC_BASE}{manifest_name}?v={bust()}"
            try:
                r = requests.get(manifest_url, timeout=10)
                manifest_data = r.json() if r.ok else {}
            except Exception:
                manifest_data = {}
            
            if 'gameweeks' not in manifest_data: 
                manifest_data['gameweeks'] = {}
            
            timestamp = int(time.time())
            
            # Store full gameweek info directly in manifest
            manifest_data['gameweeks'][str(gw)] = {
                'url': ver_url,
                'hash': h,
                'timestamp': timestamp,
                'updated': datetime.utcnow().isoformat() + "Z"
            }
            manifest_data['updated'] = datetime.utcnow().isoformat() + "Z"
            manifest_data['version'] = str(timestamp)
            manifest_data['timestamp'] = timestamp

            # Upload to Vercel Blob (backup only)
            manifest_uploaded = smart_upload_bytes(
                manifest_name,
                json.dumps(manifest_data, indent=2).encode("utf-8"),
                content_type="application/json",
                headers={
                    "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
                    "CDN-Cache-Control": "no-cache"
                }
            )
            
            # ALWAYS update in-memory manifest (this is the source of truth now)
            update_manifest_in_memory(manifest_data)
            
            if manifest_uploaded:
                log(f"SUCCESS: Updated manifest for GW{gw} (blob backup + in-memory)")
                
                # Push notification to all connected clients
                publish_update('gameweek_updated', {
                    'gameweek': gw,
                    'manifest_version': manifest_data['version'],
                    'updated_at': manifest_data['updated']
                })
                
                return True
        else:
            log(f"GW{gw} content unchanged, no updates needed")

        return True

    except Exception as e:
        log(f"GW{gw} ERROR: {e}")
        try:
            smart_upload_csv(f"fpl_rosters_points_gw{gw}.csv", b"The game is being updated.")
        except Exception as upload_err:
            log(f"Failed to upload updating sentinel for GW{gw}: {upload_err}")
        return False

# ====== BACKGROUND WORKERS ======
def redis_health_check():
    """Background thread to monitor Redis connection"""
    while scraper_running:
        try:
            if REDIS_ENABLED:
                redis_client.ping()
        except Exception as e:
            log(f"[redis] Health check failed: {e}, attempting reconnect...")
            try:
                redis_client.connection_pool.disconnect()
                redis_client.ping()
                log("[redis] Reconnected successfully")
            except Exception as reconnect_err:
                log(f"[redis] Reconnect failed: {reconnect_err}")
        time.sleep(60)

def scraper_worker():
    """Background thread that runs the scraper"""
    global scraper_running
    log("Scraper worker started")
    
    while scraper_running:
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
            while scraper_running and slept < sleep_time:
                time.sleep(1)
                slept += 1
    
    log("Scraper worker stopped")

# ====== SIGNAL HANDLERS ======
def stop_gracefully(signum, frame):
    global scraper_running
    log("Received shutdown signal, stopping gracefully...")
    scraper_running = False

signal.signal(signal.SIGINT, stop_gracefully)
signal.signal(signal.SIGTERM, stop_gracefully)

# ====== STARTUP ======
if __name__ == '__main__':
    log("=" * 60)
    log("Starting FPL Dashboard Backend v2.3")
    log("Features: SSE Push + Background Scraper + In-Memory Manifest + CDN Bypass")
    log(f"Redis: {'ENABLED (Upstash)' if REDIS_ENABLED else 'DISABLED'}")
    log("=" * 60)
    
    # Start Redis health check thread
    if REDIS_ENABLED:
        health_thread = threading.Thread(target=redis_health_check, daemon=True)
        health_thread.start()
        log("Redis health monitor started")
    
    # Start scraper in background thread
    scraper_thread = threading.Thread(target=scraper_worker, daemon=True)
    scraper_thread.start()
    log("Background scraper started")
    
    # Start Flask SSE server
    port = int(os.getenv('PORT', 5000))
    log(f"Starting SSE server on port {port}")
    log(f"SSE endpoint: http://0.0.0.0:{port}/sse/fpl-updates")
    log(f"Manifest endpoint: http://0.0.0.0:{port}/api/manifest")
    log(f"Data proxy: http://0.0.0.0:{port}/api/data/<gameweek>")
    log(f"Health check: http://0.0.0.0:{port}/health")
    
    app.run(host='0.0.0.0', port=port, threaded=True)