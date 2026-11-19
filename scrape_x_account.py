#!/usr/bin/env python3
"""
Collect public posts from a public X (Twitter) account.

Modes
-----
api      Official X API v2 (needs a bearer token). Most reliable, structured data,
         returns up to ~3,200 most recent posts for the account.
browser  Playwright fallback: opens the public profile, scrolls, and reads the
         rendered posts. Brittle (X changes its markup) and X often requires a
         logged-in session to see more than a handful of posts.

Usage
-----
  export X_BEARER_TOKEN="..."
  python scrape_x_account.py api matchadata --out matchadata

  pip install playwright && playwright install chromium
  python scrape_x_account.py browser matchadata --out matchadata --max-posts 200
  # optional: reuse a logged-in session saved with `--save-session state.json`
  python scrape_x_account.py browser matchadata --session state.json

Outputs <out>.jsonl, <out>.csv, and a web-ready <web-out> JSON file
(default data/tweets.json) shaped for the Matcha Data site's app.js,
i.e. each post has .text and .entities.hashtags[].text.
"""
import argparse
import csv
import json
import os
import re
import sys
import time

import requests

API = "https://api.twitter.com/2"
HASHTAG_RE = re.compile(r"#(\w+)")


# ---------------------------------------------------------------- API mode
def api_get(path, params, token):
    while True:
        r = requests.get(
            f"{API}{path}",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        if r.status_code == 429:
            reset = int(r.headers.get("x-rate-limit-reset", time.time() + 60))
            wait = max(reset - int(time.time()), 5)
            print(f"Rate limited; sleeping {wait}s", file=sys.stderr)
            time.sleep(wait)
            continue
        if not r.ok:
            sys.exit(f"API error {r.status_code}: {r.text}")
        return r.json()


def scrape_api(username, token, include_replies, include_retweets, max_posts):
    user = api_get(
        f"/users/by/username/{username}",
        {"user.fields": "created_at,description,public_metrics,verified,location,url"},
        token,
    )["data"]
    print(f"Account: @{user['username']} ({user['name']}) id={user['id']}", file=sys.stderr)

    exclude = []
    if not include_replies:
        exclude.append("replies")
    if not include_retweets:
        exclude.append("retweets")

    params = {
        "max_results": 100,
        "tweet.fields": "created_at,public_metrics,lang,entities,referenced_tweets,conversation_id,possibly_sensitive",
    }
    if exclude:
        params["exclude"] = ",".join(exclude)

    posts = []
    while True:
        data = api_get(f"/users/{user['id']}/tweets", params, token)
        for t in data.get("data", []):
            m = t.get("public_metrics", {})
            posts.append(
                {
                    "id": t["id"],
                    "created_at": t.get("created_at"),
                    "text": t["text"],
                    "lang": t.get("lang"),
                    "likes": m.get("like_count"),
                    "reposts": m.get("retweet_count"),
                    "replies": m.get("reply_count"),
                    "quotes": m.get("quote_count"),
                    "views": m.get("impression_count"),
                    "url": f"https://x.com/{username}/status/{t['id']}",
                    "raw": t,
                }
            )
        print(f"  collected {len(posts)}", file=sys.stderr)
        nxt = data.get("meta", {}).get("next_token")
        if not nxt or (max_posts and len(posts) >= max_posts):
            break
        params["pagination_token"] = nxt
    return posts[:max_posts] if max_posts else posts


# ------------------------------------------------------------ Browser mode
def scrape_browser(username, max_posts, session, save_session, headed):
    from playwright.sync_api import sync_playwright

    posts, seen = [], set()
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not headed)
        ctx = browser.new_context(storage_state=session) if session else browser.new_context()
        page = ctx.new_page()
        page.goto(f"https://x.com/{username}", wait_until="domcontentloaded")
        try:
            page.wait_for_selector("article", timeout=20000)
        except Exception:
            print("No posts rendered (login wall?). Try --headed --save-session.", file=sys.stderr)

        if save_session:
            input("Log in in the browser window if needed, then press Enter here...")
            ctx.storage_state(path=save_session)
            print(f"Session saved to {save_session}", file=sys.stderr)

        stale = 0
        while len(posts) < max_posts and stale < 6:
            before = len(posts)
            for a in page.query_selector_all("article[data-testid='tweet']"):
                link = a.query_selector("a[href*='/status/'] time")
                if not link:
                    continue
                href = link.evaluate("e => e.parentElement.getAttribute('href')")
                tid = href.rstrip("/").split("/")[-1]
                if tid in seen:
                    continue
                seen.add(tid)
                text_el = a.query_selector("[data-testid='tweet-text']")
                counts = a.query_selector("[role='group']")
                posts.append(
                    {
                        "id": tid,
                        "created_at": link.get_attribute("datetime"),
                        "text": text_el.inner_text() if text_el else "",
                        "author_context": a.query_selector("[data-testid='User-Name']").inner_text()
                        if a.query_selector("[data-testid='User-Name']")
                        else "",
                        "engagement_label": counts.get_attribute("aria-label") if counts else "",
                        "url": f"https://x.com{href}",
                    }
                )
            stale = stale + 1 if len(posts) == before else 0
            page.mouse.wheel(0, 2500)
            page.wait_for_timeout(1500)
        browser.close()
    return posts[:max_posts]


# ------------------------------------------------------------- web schema
def extract_hashtags(text):
    """Derive v1.1-style entities.hashtags (text + indices) from post text.

    app.js (and the old Twitter v1.1 API it was written against) expects
    entities.hashtags[].text, which v2's entities.hashtags[].tag doesn't
    provide and browser-mode posts don't have at all, so we compute it
    directly from the text for both scrape modes.
    """
    return [
        {"text": m.group(1), "indices": [m.start(), m.end()]}
        for m in HASHTAG_RE.finditer(text)
    ]


def to_web_schema(posts):
    web_posts = []
    for p in posts:
        web_posts.append(
            {
                "id": p.get("id"),
                "text": p.get("text", ""),
                "created_at": p.get("created_at"),
                "url": p.get("url"),
                "entities": {"hashtags": extract_hashtags(p.get("text", ""))},
                "likes": p.get("likes"),
                "reposts": p.get("reposts"),
                "replies": p.get("replies"),
                "quotes": p.get("quotes"),
                "views": p.get("views"),
            }
        )
    return web_posts


def write_web_json(posts, path):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(to_web_schema(posts), f, ensure_ascii=False, indent=2)
    print(f"Wrote {len(posts)} posts to {path}", file=sys.stderr)


# ------------------------------------------------------------------ output
def write_outputs(posts, out):
    with open(f"{out}.jsonl", "w", encoding="utf-8") as f:
        for p in posts:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")
    cols = [k for k in posts[0] if k != "raw"] if posts else []
    with open(f"{out}.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(posts)
    print(f"Wrote {len(posts)} posts to {out}.jsonl and {out}.csv", file=sys.stderr)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("mode", choices=["api", "browser"])
    ap.add_argument("username", help="handle without @, e.g. matchadata")
    ap.add_argument("--out", default=None)
    ap.add_argument("--max-posts", type=int, default=3200)
    ap.add_argument("--include-replies", action="store_true")
    ap.add_argument("--include-retweets", action="store_true")
    ap.add_argument("--session", help="Playwright storage_state JSON (browser mode)")
    ap.add_argument("--save-session", help="Pause to log in and save session here (browser mode)")
    ap.add_argument("--headed", action="store_true")
    ap.add_argument(
        "--web-out",
        default="data/tweets.json",
        help="Path for the site-ready JSON (matches app.js's expected schema). Pass '' to skip.",
    )
    a = ap.parse_args()

    out = a.out or a.username
    if a.mode == "api":
        token = os.environ.get("X_BEARER_TOKEN")
        if not token:
            sys.exit("Set X_BEARER_TOKEN first.")
        posts = scrape_api(a.username, token, a.include_replies, a.include_retweets, a.max_posts)
    else:
        posts = scrape_browser(a.username, a.max_posts, a.session, a.save_session, a.headed or bool(a.save_session))
    write_outputs(posts, out)
    if a.web_out:
        write_web_json(posts, a.web_out)


if __name__ == "__main__":
    main()
