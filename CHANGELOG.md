# Changelog

Versions follow [semver](https://semver.org/) while the project is `0.x`: a minor bump for
new UI or behavior, a patch bump for fixes. The current version is shown in the page footer
(`<span id="version">` in `index.html`), and each release gets a git tag (`vX.Y.Z`).

## 0.4.3 — 2026-11-19

### Changed
- Emoji card is a fixed 375px tall, showing 6 across and 7 down. More emoji scroll inside the
  card.

## 0.4.2 — 2026-11-19

### Fixed
- Emoji cards are all the same size. Emoji with no Twemoji image fell back to the system font at
  a different size; `assets/emoji/` now covers every emoji in the data.

### Changed
- All tweets come from `data/tweets.json`. `data/recovered-sample.json` and
  `data/parked-tweets.json` are removed; their tweets are merged in.

## 0.4.1 — 2026-11-19

### Changed
- Emoji card images are 32px (were 42px).
- Four tweets without dates are parked in `data/parked-tweets.json`, out of the page.
- Duplicate tweets removed from `data/recovered-sample.json`; the parsed tweets from the account
  are kept.

## 0.4.0 — 2026-11-19

### Added
- Each tweet is prefixed with its date in light text, as `mm/dd/yy` (UTC). Tweets without a
  date show no prefix.

## 0.3.1 — 2026-11-19

Data and tooling only; no change to the page's layout or behavior.

### Added
- `scripts/clean_tweets.py`: cleans and validates tweet data before it goes in `data/`. It
  normalizes whitespace, hashtags and timestamps, and rejects malformed input.
- 22 tweets parsed from the account's posts into `data/recovered-sample.json`.

### Changed
- Removed an `@anildash` mention from a sample tweet in `data/recovered-sample.json`.

## 0.3.0 — 2026-11-18

Interaction and layout refinements on the recovered UI; adds the UI spec.

### Added
- **Click an emoji to show only its tweet.** Each emoji in the emoji card is a button tied to
  the tweet it came from. Clicking one shows just that tweet in the tweets card and fades the
  emoji from other tweets; clicking it again, or picking another tag, shows everything again.
  Emoji buttons are keyboard operable and expose `aria-pressed`.
- `UI_SPEC.md`: the UI and data-mapping spec for porting this to `main`.

### Changed
- The view-all tag is now `#view-all` (was `#all`).
- Emoji card is a 6-column grid with 42px emoji (was an inline flow of 24px emoji).
- Page container max width is 400px (was 768px).

## 0.2.0 — 2026-11-18

The recovered UI, ported into the repo and restyled. Not a data change: the page still loads
`data/tweets.json`.

### Added
- Recovered UI split into `index.html`, `css/styles.css` and `app.js`; jQuery and emoji-css removed.
- `#view-all` pseudo-tag (shipped as `#all`) showing every emoji and tweet unfiltered.
- `data/tags.json`: preferred tag order (the 17 tags from the recovered design), merged with the
  hashtags found in `data/tweets.json`. Tags without tweets show an empty state.
- Twemoji SVGs in `assets/emoji/` and `scripts/vendor_emoji.js` to copy the ones the data uses;
  falls back to the plain emoji if a file is missing. Credit in `ATTRIBUTION.md`.
- Corben font, self-hosted in `assets/fonts/` (OFL).
- Subtitle under the title, and a footer with `@matchadata` and the version.
- `data/recovered-sample.json`: the recovered mock tweets in the repo's tweet schema (test fixture).

### Changed
- Layout: hashtag chips in one swipeable row above two stacked cards, the same on desktop and
  mobile. Tapping a tag selects it; hover selects only on devices that can hover.
- Cards: 24px radius, 1px `#949494` stroke, no fill.
- Title: black, lowercase, linked to `http://twitter.com/matchadata`.
- Tag, emoji and tweet logic rewritten without jQuery (`fetch`, DOM APIs, event delegation).

### Fixed
- Duplicated and unclosed markup in the old `index.html`; one tag per tweet and an unclosed
  `<a>` in the old tag list.

## 0.1.0 — 2026-11-18

Baseline on `main` (tag `v0.1.0`): emoji-cloud UI fixed, static `data/tweets.json` pipeline,
X archive converter ready; placeholder sample data pending the real X export.
