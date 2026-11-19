'use strict';

const DATA_URL = 'data/tweets.json';
const DEFAULT_TAG = 'reading';
const ALL_TAG = 'all'; // pseudo-tag: shows every tweet, unfiltered

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

function renderTag(tweets, tag) {
  tagNav.querySelectorAll('.active').forEach((b) => b.classList.remove('active'));
  tagNav.querySelector(`[data-tag="${CSS.escape(tag)}"]`)?.classList.add('active');

  const hits = tag === ALL_TAG ? tweets : tweets.filter((t) => t.tags.includes(tag));

  if (!hits.length) {
    const none = document.createElement('span');
    none.className = 'none';
    emojiPanel.replaceChildren(none);
    tweetPanel.replaceChildren(hint(`No tweets for #${tag} yet.`));
    return;
  }

  emojiPanel.textContent = hits.map((t) => t.emoji).join('');
  tweetPanel.replaceChildren(
    ...hits.map((t) => {
      const p = document.createElement('p');
      p.append(linkify(t.text));
      return p;
    })
  );
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
  try {
    tweets = await loadTweets();
  } catch (error) {
    console.error(error);
    tweetPanel.replaceChildren(hint('Could not load tweets.'));
    return;
  }

  // A real "#all" hashtag would collide with the view-all entry, which already includes it.
  const tags = collectTags(tweets).filter((tag) => tag !== ALL_TAG);
  renderTagList([ALL_TAG, ...tags]);

  const select = (event) => {
    const button = event.target.closest('button[data-tag]');
    if (button) renderTag(tweets, button.dataset.tag);
  };
  tagNav.addEventListener('mouseover', select);
  tagNav.addEventListener('focusin', select);
  tagNav.addEventListener('click', select);

  renderTag(tweets, tags.includes(DEFAULT_TAG) ? DEFAULT_TAG : tags[0] ?? ALL_TAG);
}

init();
