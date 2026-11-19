#!/usr/bin/env python3
"""Clean and validate tweet mock/real data for the Matcha Data page.

Usage:
  python3 scripts/clean_tweets.py INPUT.json [-o OUTPUT.json]
  python3 scripts/clean_tweets.py INPUT.json --check     # validate only, write nothing

Input: a JSON array of tweets in the schema app.js reads:
  { "id": str, "text": str, "created_at": ISO8601 or null,
    "entities": { "hashtags": [{ "text": str }] },
    "likes"/"reposts"/"replies"/"quotes": int, "views": int or null, "url": str }

Cleaning (never changes meaning):
  - collapses runs of whitespace in text and trims it
  - lowercases hashtags, strips a leading '#', drops empties, removes duplicates
  - rewrites created_at to UTC with a trailing 'Z' (seconds precision)
  - fills missing counts with 0 and missing views with null
  - drops hashtag "indices": they are offsets into the raw text, which go stale once
    whitespace is collapsed, and app.js does not read them
Errors (exit code 1, nothing written): missing/duplicate id, empty text, bad created_at,
  hashtags not a list of {text}.
Warnings (printed, not fatal): no hashtags, a hashtag that never appears in the text.
"""
import argparse
import json
import re
import sys
from datetime import datetime, timezone

COUNTS = ("likes", "reposts", "replies", "quotes")
WS = re.compile(r"\s+")


def parse_time(value):
    """Return ISO8601 UTC string with Z, or None if value is None. Raises ValueError if unparseable."""
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError(f"created_at must be a string or null, got {type(value).__name__}")
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def clean_one(raw, index, errors, warnings):
    tid = raw.get("id")
    label = f"tweet[{index}] id={tid!r}"
    if tid is None or str(tid).strip() == "":
        errors.append(f"tweet[{index}]: missing id")
    text = raw.get("text")
    if not isinstance(text, str):
        errors.append(f"{label}: text must be a string")
        text = ""
    text = WS.sub(" ", text).strip()
    if not text:
        errors.append(f"{label}: empty text")

    try:
        created = parse_time(raw.get("created_at"))
    except ValueError as exc:
        errors.append(f"{label}: created_at {raw.get('created_at')!r}: {exc}")
        created = None

    entities = raw.get("entities") or {}
    raw_tags = entities.get("hashtags") or []
    if not isinstance(raw_tags, list) or not all(isinstance(h, dict) and "text" in h for h in raw_tags):
        errors.append(f"{label}: entities.hashtags must be a list of {{text}} objects")
        raw_tags = []
    tags = []
    for h in raw_tags:
        tag = str(h["text"]).strip().lstrip("#").lower()
        if tag and tag not in tags:
            tags.append(tag)

    if not tags:
        warnings.append(f"{label}: no hashtags (it will only appear under #view-all)")
    lowered = text.lower()
    for tag in tags:
        if f"#{tag}" not in lowered:
            warnings.append(f"{label}: #{tag} is in entities but not in the text")

    cleaned = {
        "id": str(tid),
        "text": text,
        "created_at": created,
        "url": raw.get("url"),
        "entities": {"hashtags": [{"text": t} for t in tags]},
    }
    for key in COUNTS:
        value = raw.get(key, 0)
        cleaned[key] = int(value) if value is not None else 0
    views = raw.get("views")
    cleaned["views"] = None if views is None else int(views)
    return cleaned


def clean(tweets):
    errors, warnings, out = [], [], []
    if not isinstance(tweets, list):
        return None, ["top level must be a JSON array"], []
    for i, raw in enumerate(tweets):
        if not isinstance(raw, dict):
            errors.append(f"tweet[{i}]: not an object")
            continue
        out.append(clean_one(raw, i, errors, warnings))
    seen = set()
    for t in out:
        if t["id"] in seen:
            errors.append(f"duplicate id {t['id']!r}")
        seen.add(t["id"])
    return out, errors, warnings


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input")
    ap.add_argument("-o", "--output", help="write cleaned JSON here (default: overwrite input)")
    ap.add_argument("--check", action="store_true", help="validate only; write nothing")
    args = ap.parse_args()

    with open(args.input, encoding="utf-8") as f:
        data = json.load(f)
    out, errors, warnings = clean(data)

    for w in warnings:
        print(f"warning: {w}")
    for e in errors:
        print(f"error: {e}", file=sys.stderr)
    if errors:
        print(f"{len(errors)} error(s); nothing written", file=sys.stderr)
        return 1
    print(f"{len(out)} tweet(s) valid, {len(warnings)} warning(s)")
    if args.check:
        return 0

    target = args.output or args.input
    with open(target, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"wrote {target}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
