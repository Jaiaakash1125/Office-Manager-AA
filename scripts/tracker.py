"""
Office Manager - Windows Python Background Tracker
==================================================
Lightweight background service for staff PCs.
- Checks keyboard and mouse activity using standard Windows API (ctypes.windll.user32)
- Inspects active foreground window title
- Sends active seconds and app name to /api/tracker/heartbeat every 60 seconds
- Zero heavy dependencies (only requires standard python + requests)
- Can be compiled into a standalone .exe with PyInstaller:
    pip install requests pyinstaller
    pyinstaller --noconsole --onefile tracker.py
"""

import sys
import os
import time
import json
import ctypes
from datetime import datetime

try:
    import requests
except ImportError:
    print("Error: 'requests' package is required. Install it using: pip install requests")
    sys.exit(1)

# Config file location in the same directory as script or exe
CONFIG_FILE = "tracker_config.json"

DEFAULT_CONFIG = {
    "server_url": "https://your-office-app.vercel.app",
    "api_token": "YOUR_WORKER_API_TOKEN_HERE",
    "check_interval_seconds": 60,
}


def load_config():
    """Loads configuration from tracker_config.json or creates default template."""
    if not os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_CONFIG, f, indent=4)
        print(f"Created default '{CONFIG_FILE}'. Please edit it and fill in your server_url and api_token.")
        return DEFAULT_CONFIG

    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading config: {e}. Using defaults.")
        return DEFAULT_CONFIG


class LASTINPUTINFO(ctypes.Structure):
    _fields_ = [
        ("cbSize", ctypes.c_uint),
        ("dwTime", ctypes.c_uint),
    ]


def get_idle_duration():
    """Returns number of seconds since last mouse or keyboard input on Windows."""
    if sys.platform != "win32":
        return 0  # Fallback for testing on non-windows
    
    last_input_info = LASTINPUTINFO()
    last_input_info.cbSize = ctypes.sizeof(LASTINPUTINFO)
    
    if ctypes.windll.user32.GetLastInputInfo(ctypes.byref(last_input_info)):
        millis = ctypes.windll.kernel32.GetTickCount() - last_input_info.dwTime
        return millis / 1000.0
    return 0


def get_active_window_title():
    """Gets the title of currently focused application on Windows."""
    if sys.platform != "win32":
        return "Non-Windows OS"
    
    hwnd = ctypes.windll.user32.GetForegroundWindow()
    length = ctypes.windll.user32.GetWindowTextLengthW(hwnd)
    buff = ctypes.create_unicode_buffer(length + 1)
    ctypes.windll.user32.GetWindowTextW(hwnd, buff, length + 1)
    return buff.value or "Desktop"


def send_heartbeat(server_url, api_token, active_seconds, app_name):
    """Sends heartbeat payload to Office Manager API."""
    endpoint = f"{server_url.rstrip('/')}/api/tracker/heartbeat"
    payload = {
        "api_token": api_token,
        "active_seconds": active_seconds,
        "app_name": app_name,
    }
    
    try:
        response = requests.post(
            endpoint,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        if response.status_code == 200:
            return True, response.json()
        else:
            return False, f"HTTP {response.status_code}: {response.text}"
    except Exception as e:
        return False, str(e)


def main():
    print("==================================================")
    print("   Office Manager Windows Tracker Service         ")
    print("==================================================")
    
    config = load_config()
    server_url = config.get("server_url", "").strip()
    api_token = config.get("api_token", "").strip()
    interval = config.get("check_interval_seconds", 60)

    if not api_token or api_token == "YOUR_WORKER_API_TOKEN_HERE":
        print(f"Error: Please configure your valid worker api_token in '{CONFIG_FILE}'!")
        time.sleep(10)
        sys.exit(1)

    print(f"Target Server: {server_url}")
    print(f"Tracking Interval: {interval} seconds")
    print("Tracker is actively monitoring user activity...")

    while True:
        try:
            # Monitor over the interval (e.g. 60 seconds)
            # Sample every 5 seconds to calculate total active seconds
            sample_interval = 5
            total_samples = interval // sample_interval
            active_samples = 0
            latest_app = "Desktop"

            for _ in range(total_samples):
                idle_sec = get_idle_duration()
                # Consider active if user interacted in the last 15 seconds
                if idle_sec < 15:
                    active_samples += 1
                
                curr_app = get_active_window_title()
                if curr_app and curr_app != "Desktop":
                    latest_app = curr_app
                
                time.sleep(sample_interval)

            active_seconds = int((active_samples / total_samples) * interval)
            
            # Send heartbeat to cloud API
            success, result = send_heartbeat(server_url, api_token, active_seconds, latest_app)
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            if success:
                print(f"[{now_str}] Heartbeat synced: {active_seconds}s active | App: '{latest_app}'")
            else:
                print(f"[{now_str}] Sync error: {result}")

        except KeyboardInterrupt:
            print("\nTracker stopped by user.")
            break
        except Exception as err:
            print(f"Unexpected error: {err}")
            time.sleep(10)


if __name__ == "__main__":
    main()
