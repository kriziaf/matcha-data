# Matcha Data — tweet display pipeline spec

## Goal

Show every public tweet from the `matchadata` X/Twitter account on the
homepage as a hover-to-reveal emoji cloud, with the deployed site having
**zero runtime dependencies** — no live API calls, no server. The homepage
only ever fetches a committed static file, `data/tweets.json`.

## Status: parked, waiting on the X data export

Blocked on an external step (see "Next step" below). Everything on the code
side is done and tested; only the real data is missing.

## What's built

- **`app.js`**: fixed a pre-existing brace-mismatch bug that silently broke
  the whole script (confirmed present even in the original committed
  version). Fetches `data/tweets.json` directly (no more
  `localhost:3000/twitter` server dependency). Tweet text paragraphs are
  hidden by default; hovering an emoji reveals its matching tweet's text via
  a shared `data-target`/`id` pair, then hides it again on mouseout — this
  gives the "emoji-cloud by default, text on hover" behavior that matches
  the original design intent (and the commented-out hints already in the
  file: "hover this emoji, show obj[i].text; else hide").
- **`scrape_x_account.py`**: added `extract_hashtags()`, `to_web_schema()`,
  `write_web_json()`, and a `--web-out` flag (default `data/tweets.json`).
  These convert either scrape mode's output (api or browser) into the
  schema `app.js` needs — specifically `entities.hashtags[].text`, which
  neither X API v2 (`entities.hashtags[].tag`) nor browser-mode scraping
  (no entities at all) provide natively, so hashtags are derived from the
  tweet text via regex.
- **`convert_x_archive.py`** (new, untested against a real export yet):
  parses X's official "download your data" archive format
  (`data/tweets.js`, a `window.YTD.tweets.partN = [...]` JS-wrapped array)
  and converts it into the same `data/tweets.json` schema — using the
  archive's own real `entities.hashtags` instead of regex-derived ones.
  Verified against a hand-built synthetic sample matching the real export
  format (hashtags, date normalization to ISO8601, like/repost counts all
  convert correctly) — not yet run against an actual X archive.
- **`data/tweets.json`**: currently holds 6 hand-written sample tweets
  (matcha/tea themed, with real emoji + hashtags) used to verify the UI.
  **This needs to be replaced with real data** once the archive is
  converted.
- **`.gitignore`**: added `*.jsonl`, `*.csv` (raw scrape dumps — not the
  site's data source) and `*.session.json` / `state.json` (Playwright login
  session cookies — must never be committed).
- Playwright + Chromium are installed locally (dev-only tool, not shipped
  to the site) — currently unused; see "why browser-scraping is dead" below.

## Why browser-scraping is dead (don't retry this)

Tried Playwright browser-mode scraping (`scrape_x_account.py browser ...`)
against the live `x.com/matchadata` profile. A fresh automated Chromium
instance gets served a **completely blank page** (0 bytes rendered, empty
title) — X's bot detection blocks the automation signal itself, before any
login wall. Did not attempt to work around this (stealth/fingerprint
evasion) and won't — that's bypassing bot detection, which is off the table
regardless of the end use. The X API v2 path is still technically available
but needs a bearer token (paid tier for anything beyond trivial use).

## Next step (manual, on you)

Request `matchadata`'s data export from X:
**Settings → Your Account → Download an archive of your data**
X typically takes a few hours (up to ~a day) and emails a download link.

## Once you have the archive

1. Unzip it anywhere (doesn't need to live inside this repo).
2. Tell Claude the path to its `data/` folder (the one containing
   `tweets.js`).
3. Run: `python3 convert_x_archive.py <path-to-archive>/data matchadata`
   — this overwrites `data/tweets.json` with the real, complete tweet
   history.
4. Verify locally: `python3 -m http.server` in this directory, open
   `index.html`, confirm the emoji cloud renders and hover-reveal still
   works at real data volume.
5. Review the diff, then commit and push (nothing has been pushed to
   `origin/main` since the initial commit — this work is local-only for
   now, per request).

## Files touched so far (uncommitted)

`.gitignore`, `app.js`, `scrape_x_account.py`, `convert_x_archive.py` (new),
`data/tweets.json` (new, placeholder sample data).
