# Matcha Data: UI and data-mapping spec

Version **0.3.0** (see `CHANGELOG.md`). This describes the UI on the `recovered-ui` branch. It
supersedes the description of `app.js` in `SPEC.md` ("What's built"), which covers the older
hover-an-emoji design. The data pipeline in `SPEC.md` (scraper, X archive converter,
`data/tweets.json`) is unchanged.

The UI and logic do not depend on which tweets are loaded. Porting to `main` means copying the
UI files; the only thing that changes with real data is the content of `data/tweets.json` (plus
two small data-dependent steps, in "Mapping the real data").

## Files

| Path | Role |
|---|---|
| `index.html` | Markup: header with title and subtitle, tag row, two cards, footer |
| `css/styles.css` | All styles |
| `app.js` | All logic, no dependencies |
| `data/tweets.json` | Tweets (the pipeline's output, see "Data contract") |
| `data/tags.json` | Optional preferred tag order, a JSON array of lowercase strings |
| `assets/emoji/*.svg` | Twemoji images for the emoji used in the data |
| `assets/fonts/*.woff2` | Corben 400 and 700 |
| `scripts/vendor_emoji.js` | Copies the Twemoji SVGs the data uses into `assets/emoji/` |
| `data/recovered-sample.json` | Test fixture: recovered tweets in the tweet schema |
| `ATTRIBUTION.md` | Twemoji (CC-BY 4.0) and Corben (OFL) credits |

## Layout

One layout at every screen size. Page container: `max-width: 400px`, centered, 12px side
padding (so the cards are 376px wide). Top to bottom:

1. **Header**: title, subtitle, 3px black rule.
   - Title: `Matcha Data` shown lowercase (`text-transform`), Corben 700, 24px, black, a link to
     `http://twitter.com/matchadata` (new tab), underlined only on hover or focus.
   - Subtitle (14px, links underlined, open in new tabs): "I'm a public quantified-self
     experiment by [@kriziafern](https://x.com/kriziafern) for NYU ITP. Using
     [#matchadata](https://x.com/search?q=%23matchadata&src=hashtag_click) 🍵 to track my
     activities." The 🍵 is the Twemoji image `assets/emoji/1f375.svg`.
2. **Tag row**: see "Tags".
3. **Emoji card**.
4. **Tweets card**.
5. **Footer**: `@matchadata` (link as the title) and `ver <version>` in 12px muted text. The
   version number is set in a system font because Corben's digits read as letters
   (0 as O, 1 as l).

### Style tokens

| | |
|---|---|
| Font | Corben (400, 700), fallback Georgia, serif; body 14px |
| Ink / text | `#111` |
| Card stroke | `#949494`, 1px, no fill |
| Card radius | 24px |
| Tag chip | fill `#ececec`, border `#ddd`; active or hover: `#111` fill, white text |
| Muted text | `#666` |

## Cards

Both cards: 1px `#949494` stroke, 24px radius, transparent background.

- **Emoji card**: 6-column grid (`repeat(6, 1fr)`), so exactly six emoji per row at any width
  down to 320px. Each emoji is 42px by 42px. Padding 16px 22px, min height 90px, row gap 10px.
  Empty state (a tag with no tweets): a 26px outlined black square.
- **Tweets card**: tweets as paragraphs, 18px 24px padding, 14px gap, 1.5 line height. Bare
  `http(s)` URLs become links (new tab). A tag with no tweets shows "No tweets for #tag yet."

## Tags

- The row is one line that scrolls sideways (swipe on touch; a thin draggable scrollbar where a
  mouse is used).
- The first chip is **`#view-all`**: it shows every tweet and every emoji, unfiltered.
- Then the tags from `data/tags.json`, in file order (shown even if no tweet uses them), then any
  other hashtag found in the tweets, in order of first appearance. No duplicates; lowercase.
- On load: `#reading` if it is in the list, otherwise the first real tag, otherwise `#view-all`.

## Interactions

| Action | Result |
|---|---|
| Hover a tag (only on devices that can hover) | Selects it |
| Click or tap a tag, or focus it by keyboard | Selects it |
| Select a tag | Emoji card shows the emoji from that tag's tweets; tweets card shows those tweets; any emoji selection is cleared |
| Click an emoji | Tweets card shows **only that emoji's tweet**; emoji from other tweets fade to 30% opacity (all emoji of the same tweet stay at full opacity) |
| Click the same emoji again | Shows all of the tag's tweets again |
| Click a different emoji | Switches to that emoji's tweet |

Emoji are `<button>` elements with `aria-pressed`, so they work with Tab and Enter. Hover
highlighting on tags is applied only under `@media (hover: hover)`, so a tapped tag does not
stay highlighted on touch screens.

## Data contract

`app.js` fetches `data/tweets.json` (a JSON array) and reads only two fields per tweet:

| Field | Used for |
|---|---|
| `text` | The tweet text; the emoji are extracted from it |
| `entities.hashtags[].text` | The tweet's tags (lowercased, de-duplicated) |

Everything else (`id`, `created_at`, `url`, `likes`, `reposts`, ...) is ignored, so the schema
`convert_x_archive.py` and `scrape_x_account.py` already produce works as it is.

Derived per tweet in `normalizeTweet()`:

- `tags`: the hashtags, lowercase, no `#`.
- `emoji`: every emoji in `text`, in order (ZWJ sequences and skin tones count as one emoji).
  The emoji card shows one button per emoji; each button points back to its tweet.
- A tweet **without hashtags** appears only under `#view-all`. A tweet **without emoji** has no
  button in the emoji card but still appears in the tweets card.
- Tweet order is the order in the file (the converter writes newest first).

### Emoji images

An emoji maps to `assets/emoji/<name>.svg`, where `<name>` is its code points in lowercase hex
joined by `-`, with `fe0f` dropped unless the emoji contains a ZWJ (`200d`). Examples:
🍵 → `1f375.svg`, ☕️ → `2615.svg`, 🧑‍💻 → `1f9d1-200d-1f4bb.svg`. If an image fails to load, the plain
emoji character is shown instead, so a missing file never hides an emoji. The same rule is in
`app.js` (`emojiFilename`) and `scripts/vendor_emoji.js`; keep them in sync.

## Mapping the real data

When the X export is available:

1. Convert it with `convert_x_archive.py` so `data/tweets.json` has the real tweets. Nothing in the
   UI code changes.
2. Run `node scripts/vendor_emoji.js <dir of Twemoji SVGs>` (instructions are in the script header).
   It copies the Twemoji files the real tweets use and lists any emoji it has no file for.
3. Review `data/tags.json`. It currently holds the 17 tags recovered from the original design. Real
   tags not in the file are appended automatically; edit the file to reorder, or remove it to
   list only the tags found in the tweets.
4. Check the default tag (`DEFAULT_TAG` in `app.js`, currently `reading`).

### Open questions for real data

- **Volume.** With hundreds of tweets, `#view-all` makes a long emoji grid. If that matters,
  options are a cap with a "show more" control, or paging. Not built.
- **Tweets under no tag.** They are reachable only through `#view-all`.
- **Emoji in tweet text** still use the system emoji font; only the emoji card uses Twemoji.

## Porting to `main`

Copy from `recovered-ui`: `index.html`, `css/styles.css`, `app.js`, `assets/`, `scripts/`,
`data/tags.json`, `ATTRIBUTION.md`, `CHANGELOG.md`, `UI_SPEC.md`. Keep `main`'s `data/tweets.json`
pipeline files as they are. Keep `data/recovered-sample.json` only if you want the test fixture.

## Checks

- With any `tweets.json`: the footer shows the version; `#view-all` shows all tweets and all emoji;
  each tag filters; clicking an emoji shows one tweet, again shows all; switching tag resets.
- Six emoji per row at 320px, 390px and 1200px; no sideways page scroll.
- With touch, a tap selects (no hover required).
- Every emoji image loads (no 404s in `assets/emoji/`).

## Versioning

Bump the number in `index.html` (`<span id="version">`), add a `CHANGELOG.md` entry, commit, and
tag `vX.Y.Z`.
