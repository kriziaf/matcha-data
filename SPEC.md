# Matcha Data — tweet display pipeline spec

**Version 0.3.0** — see `CHANGELOG.md`. The UI, interactions and the mapping
from tweets to the page are specified in `UI_SPEC.md`; this file covers the
goal, the data pipeline and what is left to do.

## Goal

Show every public tweet from the `matchadata` X/Twitter account on the
homepage — hashtag chips, an emoji card and a tweets card, where clicking an
emoji shows just its tweet (see `UI_SPEC.md`) — with the deployed site having
**zero runtime dependencies** — no live API calls, no server. The homepage
only ever fetches committed static files (`data/tweets.json`, plus
`data/tags.json` for tag order).

## Status: parked, waiting on the X data export

Blocked on an external step (see "Next step" below). Everything on the code
side is done and tested; only the real data is missing.

## What's built

- **`index.html`, `css/styles.css`, `app.js`** (rewritten in 0.2.0–0.3.0; the
  earlier hover-an-emoji design and its jQuery code are gone): fixed a
  pre-existing brace-mismatch bug that silently broke the whole original
  script. The page fetches `data/tweets.json` directly (no
  `localhost:3000/twitter` server dependency) and `data/tags.json` for the
  preferred tag order. Tags are mapped from `entities.hashtags[].text`, and
  emoji are extracted from the tweet text and drawn as local Twemoji SVGs
  (`assets/emoji/`, copied by `scripts/vendor_emoji.js`). A tag chip filters
  the emoji and tweets; `#view-all` shows everything; clicking an emoji shows
  only that emoji's tweet. Full behavior, layout, styles and the data contract
  are in `UI_SPEC.md`.
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
4. Copy the Twemoji files the real tweets use: `node scripts/vendor_emoji.js
   <dir of Twemoji SVGs>` (the script header says where to get them). It lists
   any emoji it has no file for.
5. Review `data/tags.json` (preferred tag order) and `DEFAULT_TAG` in
   `app.js` against the real hashtags.
6. Verify locally: `python3 -m http.server` in this directory, open
   `index.html`, and run the checks in `UI_SPEC.md` (tags filter, `#view-all`
   shows everything, clicking an emoji shows one tweet, six emoji per row,
   no 404s in `assets/emoji/`) at real data volume. Decide whether the long
   `#view-all` emoji grid needs a cap (open question in `UI_SPEC.md`).
7. Review the diff, bump the version in `index.html` and `CHANGELOG.md`, then
   commit and push to `main`.

## Branches

`main` is now the 0.3.0 UI described in this file and `UI_SPEC.md` — the
`recovered-ui` branch was merged into `main` (a fast-forward, since it was
a direct descendant) and then deleted as redundant. The earlier jQuery-based
emoji-cloud UI (tagged `v0.1.0`) lives on in the `legacy-ui` branch if it's
ever needed for reference.

## Files touched so far

`.gitignore`, `scrape_x_account.py`, `convert_x_archive.py`, `index.html`,
`css/styles.css`, `app.js` (rewritten), `data/tweets.json` (placeholder
sample data — **needs the real archive**), `data/tags.json`,
`data/recovered-sample.json`, `assets/emoji/`, `assets/fonts/`,
`scripts/vendor_emoji.js`, `ATTRIBUTION.md`, `CHANGELOG.md`, `UI_SPEC.md` —
all on `main`.
