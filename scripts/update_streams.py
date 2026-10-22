#!/usr/bin/env python3
"""Refresh MovieBox_Animal_Daily's stream list.

Reads data/sources.json and writes data/live.json with:
  - the 24/7 streams currently on air on each "tv" YouTube channel (TV-style animal channels)
  - every animal live stream currently on air on each "live" YouTube channel
  - the latest full episodes / videos from each "shows" YouTube channel

Run it once a day (cron, GitHub Actions, etc.):
    python3 scripts/update_streams.py
Uses only the Python standard library.
"""
import json
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "data" / "sources.json"
OUTPUT = ROOT / "data" / "live.json"
HEADERS = {"User-Agent": "Mozilla/5.0 (MovieBox_Animal_Daily updater)", "Accept-Language": "en-US,en"}
LATEST_PER_SHOW = 15


def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=25) as res:
        return res.read().decode("utf-8", "ignore")


def lockups(node, out):
    """Collect YouTube's video tiles (lockupViewModel) from the page data."""
    if isinstance(node, dict):
        if "lockupViewModel" in node:
            out.append(node["lockupViewModel"])
            return
        for v in node.values():
            lockups(v, out)
    elif isinstance(node, list):
        for v in node:
            lockups(v, out)


def live_streams(channel):
    """Streams currently on air on a channel's /streams tab."""
    html = fetch(f"https://www.youtube.com/channel/{channel['id']}/streams")
    m = re.search(r"var ytInitialData = (\{.*?\});</script>", html)
    if not m:
        return []
    tiles = []
    lockups(json.loads(m.group(1)), tiles)
    streams = []
    for t in tiles:
        if t.get("contentType") != "LOCKUP_CONTENT_TYPE_VIDEO":
            continue
        meta = t.get("metadata", {}).get("lockupMetadataViewModel", {})
        blob = json.dumps(t)
        rows = json.dumps(meta.get("metadata", {}))
        # Live tiles show "N watching" and a LIVE badge; replays show "N views".
        if "watching" not in rows and '"LIVE"' not in blob:
            continue
        viewers = re.search(r'"content": "([\d,.KM]+) watching"', rows)
        streams.append({
            "id": t["contentId"],
            "title": meta.get("title", {}).get("content", "").strip(),
            "viewers": viewers.group(1) if viewers else "",
        })
    return streams


def latest_videos(channel):
    """Latest uploads from YouTube's public RSS feed."""
    xml = fetch(f"https://www.youtube.com/feeds/videos.xml?channel_id={channel['id']}")
    ns = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}
    root = ET.fromstring(xml)
    videos = []
    for e in root.findall("a:entry", ns)[:LATEST_PER_SHOW]:
        videos.append({
            "id": e.find("yt:videoId", ns).text,
            "title": e.find("a:title", ns).text,
            "published": e.find("a:published", ns).text,
        })
    return videos


def process(channel):
    try:
        if channel["kind"] in ("tv", "live"):
            channel = {**channel, "streams": live_streams(channel)}
        else:
            channel = {**channel, "videos": latest_videos(channel)}
        channel["ok"] = True
    except Exception as e:  # keep going if one channel fails
        print(f"  ! {channel['name']}: {e}", file=sys.stderr)
        channel = {**channel, "ok": False}
    count = len(channel.get("streams", channel.get("videos", [])))
    print(f"  {channel['name']:<34} {channel['kind']:<5} {count}")
    return channel


def main():
    sources = json.loads(SOURCES.read_text())
    channels = [{**c, "kind": kind} for kind in ("tv", "live", "shows") for c in sources["youtube"][kind]]
    start = time.time()
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(process, channels))

    # Keep the previous data for any channel that failed this run.
    previous = {}
    if OUTPUT.exists():
        old = json.loads(OUTPUT.read_text())
        previous = {(c["kind"], c["id"]): c for k in ("tv", "live", "shows") for c in old.get(k, [])}
    results = [r if r["ok"] else previous.get((r["kind"], r["id"]), r) for r in results]

    data = {
        "updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "tv": [r for r in results if r["kind"] == "tv"],
        "live": [r for r in results if r["kind"] == "live"],
        "shows": [r for r in results if r["kind"] == "shows"],
    }
    OUTPUT.write_text(json.dumps(data, indent=1, ensure_ascii=False))
    n_tv = sum(len(c.get("streams", [])) for c in data["tv"])
    n_live = sum(len(c.get("streams", [])) for c in data["live"])
    n_vids = sum(len(c.get("videos", [])) for c in data["shows"])
    print(f"Wrote {OUTPUT.relative_to(ROOT)}: {n_tv} TV channels, {n_live} live cams, {n_vids} videos ({time.time() - start:.1f}s)")


if __name__ == "__main__":
    main()
