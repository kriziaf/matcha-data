#!/usr/bin/env python3
"""
Convert an official X/Twitter "download your data" archive into the
Matcha Data site's tweets.json schema (data/tweets.json by default).

The archive's data/tweets.js (or tweet.js in older exports) isn't valid
JSON on its own -- it's a JS assignment like:
  window.YTD.tweets.part0 = [ { "tweet": { ... } }, ... ]
so we strip the assignment prefix before parsing.

Usage
-----
  python3 convert_x_archive.py /path/to/extracted-archive/data matchadata
"""
import argparse
import glob
import json
import os
import sys
from datetime import datetime

X_DATE_FMT = "%a %b %d %H:%M:%S %z %Y"


def load_archive_tweets(data_dir):
    files = sorted(glob.glob(os.path.join(data_dir, "tweet*.js")))
    if not files:
        sys.exit(f"No tweet*.js files found in {data_dir}")
    tweets = []
    for path in files:
        raw = open(path, encoding="utf-8").read()
        data = json.loads(raw[raw.index("["):])
        for entry in data:
            tweets.append(entry.get("tweet", entry))
    return tweets


def to_iso(created_at):
    try:
        return datetime.strptime(created_at, X_DATE_FMT).isoformat()
    except (TypeError, ValueError):
        return created_at


def convert(tweets, username):
    posts = []
    for t in tweets:
        hashtags = [
            {"text": h.get("text", ""), "indices": [int(i) for i in h.get("indices", [0, 0])]}
            for h in t.get("entities", {}).get("hashtags", [])
        ]
        tid = t.get("id_str") or t.get("id")
        posts.append(
            {
                "id": tid,
                "text": t.get("full_text") or t.get("text", ""),
                "created_at": to_iso(t.get("created_at", "")),
                "url": f"https://x.com/{username}/status/{tid}" if tid else None,
                "entities": {"hashtags": hashtags},
                "likes": int(t.get("favorite_count", 0) or 0),
                "reposts": int(t.get("retweet_count", 0) or 0),
                "replies": None,
                "quotes": None,
                "views": None,
            }
        )
    posts.sort(key=lambda p: p["created_at"] or "", reverse=True)
    return posts


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("archive_data_dir", help="Path to the extracted archive's data/ directory")
    ap.add_argument("username", help="Account handle, used to build status URLs")
    ap.add_argument("--web-out", default="data/tweets.json")
    a = ap.parse_args()

    tweets = load_archive_tweets(a.archive_data_dir)
    posts = convert(tweets, a.username)

    os.makedirs(os.path.dirname(a.web_out) or ".", exist_ok=True)
    with open(a.web_out, "w", encoding="utf-8") as f:
        json.dump(posts, f, ensure_ascii=False, indent=2)
    print(f"Wrote {len(posts)} posts to {a.web_out}", file=sys.stderr)


if __name__ == "__main__":
    main()
