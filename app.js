'use strict';

const DATA_URL = 'data/tweets.json';
const EMOJI_DIR = 'assets/emoji/'; // Twemoji SVGs, see scripts/vendor_emoji.js
const TAG_ORDER_URL = 'data/tags.json'; // optional: preferred sidebar order
const DEFAULT_TAG = 'reading';
const ALL_TAG = 'view-all'; // pseudo-tag: shows every tweet, unfiltered

// An emoji, optional skin tone, then any variation selector / ZWJ-joined parts.
const EMOJI_RE =
  /\p{Extended_Pictographic}\p{Emoji_Modifier}?(?:️|‍\p{Extended_Pictographic}\p{Emoji_Modifier}?️?)*/gu;
const URL_RE = /(https?:\/\/\S+)/g;

const tagNav = document.getElementById('tags');
const emojiPanel = document.getElementById('emoji');
const tweetPanel = document.getElementById('tweets');

/* ---------- Data ---------- */

// Raw tweet ({ text, entities.hashtags[].text }) -> { tags, emoji, text }.
function normalizeTweet(raw) {
  const hashtags = raw.entities?.hashtags ?? [];
  return {
    tags: [...new Set(hashtags.map((h) => h.text.toLowerCase()))],
    emoji: (raw.text.match(EMOJI_RE) ?? []).join(''),
    text: raw.text,
  };
}

// Unique tags, in order of first appearance.
function collectTags(tweets) {
  return [...new Set(tweets.flatMap((t) => t.tags))];
}

async function loadTweets() {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`${DATA_URL}: HTTP ${response.status}`);
  return (await response.json()).map(normalizeTweet);
}

// Preferred sidebar order. Optional: a missing or invalid file just means no preset order.
async function loadTagOrder() {
  try {
    const response = await fetch(TAG_ORDER_URL);
    if (!response.ok) return [];
    return (await response.json()).map((tag) => String(tag).toLowerCase());
  } catch {
    return [];
  }
}

// Preset tags first (even with no tweets yet), then any other tags found in the data.
function buildTagList(tagOrder, tweets) {
  const tags = new Set([...tagOrder, ...collectTags(tweets)]);
  tags.delete(ALL_TAG); // keep the view-all entry unique
  return [ALL_TAG, ...tags];
}

/* ---------- Emoji images (Twemoji) ---------- */

// Twemoji filenames: lowercase hex code points joined by "-", FE0F dropped unless the emoji has a ZWJ.
// Keep in sync with scripts/vendor_emoji.js.
function emojiFilename(emoji) {
  const hasZwj = emoji.includes('\u200D');
  const points = [...emoji].map((c) => c.codePointAt(0)).filter((cp) => hasZwj || cp !== 0xfe0f);
  return points.map((cp) => cp.toString(16)).join('-') + '.svg';
}

// Twemoji <img> for one emoji; falls back to the plain emoji character if the file is missing.
function emojiImage(emoji) {
  const img = document.createElement('img');
  img.className = 'emoji';
  img.alt = emoji;
  img.draggable = false;
  img.src = EMOJI_DIR + emojiFilename(emoji);
  img.addEventListener('error', () => img.replaceWith(emoji), { once: true });
  return img;
}

/* ---------- Rendering ---------- */

// Plain text with bare URLs turned into links (built with DOM nodes, so no escaping needed).
function linkify(text) {
  const fragment = document.createDocumentFragment();
  text.split(URL_RE).forEach((part, i) => {
    if (i % 2 === 0) {
      fragment.append(part);
      return;
    }
    const a = document.createElement('a');
    a.href = part;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = part;
    fragment.append(a);
  });
  return fragment;
}

function renderTagList(tags) {
  tagNav.replaceChildren(
    ...tags.map((tag) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.tag = tag;
      button.textContent = `#${tag}`;
      return button;
    })
  );
}

// Tweets shown for the current tag, and the one picked by clicking an emoji (if any).
let view = { hits: [], selected: null };

function tweetParagraph(tweet) {
  const p = document.createElement('p');
  p.append(linkify(tweet.text));
  return p;
}

// One button per emoji; clicking it shows only the tweet that emoji came from.
function emojiButton(emoji, tweet) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'emoji-btn';
  button.setAttribute('aria-pressed', 'false');
  button.append(emojiImage(emoji));
  button.tweet = tweet;
  return button;
}

function renderEmoji() {
  emojiPanel.replaceChildren(
    ...view.hits.flatMap((t) => (t.emoji.match(EMOJI_RE) ?? []).map((e) => emojiButton(e, t)))
  );
}

function renderTweets() {
  const shown = view.selected ? [view.selected] : view.hits;
  tweetPanel.replaceChildren(...shown.map(tweetParagraph));

  emojiPanel.classList.toggle('has-selection', Boolean(view.selected));
  emojiPanel.querySelectorAll('.emoji-btn').forEach((button) => {
    const isSelected = button.tweet === view.selected;
    button.classList.toggle('selected', isSelected);
    button.setAttribute('aria-pressed', String(isSelected));
  });
}

// Click an emoji to show just its tweet; click it again to show all the tag's tweets.
function toggleEmoji(event) {
  const button = event.target.closest('.emoji-btn');
  if (!button) return;
  view.selected = view.selected === button.tweet ? null : button.tweet;
  renderTweets();
}

function renderTag(tweets, tag) {
  tagNav.querySelectorAll('.active').forEach((b) => b.classList.remove('active'));
  tagNav.querySelector(`[data-tag="${CSS.escape(tag)}"]`)?.classList.add('active');

  const hits = tag === ALL_TAG ? tweets : tweets.filter((t) => t.tags.includes(tag));
  view = { hits, selected: null };
  emojiPanel.classList.remove('has-selection');

  if (!hits.length) {
    const none = document.createElement('span');
    none.className = 'none';
    emojiPanel.replaceChildren(none);
    tweetPanel.replaceChildren(hint(`No tweets for #${tag} yet.`));
    return;
  }

  renderEmoji();
  renderTweets();
}

function hint(message) {
  const p = document.createElement('p');
  p.className = 'hint';
  p.textContent = message;
  return p;
}

/* ---------- Init ---------- */

async function init() {
  let tweets;
  let tagOrder;
  try {
    [tweets, tagOrder] = await Promise.all([loadTweets(), loadTagOrder()]);
  } catch (error) {
    console.error(error);
    tweetPanel.replaceChildren(hint('Could not load tweets.'));
    return;
  }

  const tags = buildTagList(tagOrder, tweets);
  renderTagList(tags);

  const select = (event) => {
    const button = event.target.closest('button[data-tag]');
    if (button) renderTag(tweets, button.dataset.tag);
  };
  // Hover selects on devices that can hover; on touch screens a tap (click) selects.
  const canHover = window.matchMedia('(hover: hover)');
  tagNav.addEventListener('mouseover', (event) => canHover.matches && select(event));
  tagNav.addEventListener('focusin', select);
  tagNav.addEventListener('click', select);
  emojiPanel.addEventListener('click', toggleEmoji);

  renderTag(tweets, tags.includes(DEFAULT_TAG) ? DEFAULT_TAG : tags[1] ?? ALL_TAG);
}

init();
