const test = require("node:test");
const assert = require("node:assert/strict");

const core = require("../src/core.js");

test("recognizes only secure YouTube Music URLs", () => {
  assert.equal(core.isYouTubeMusicUrl("https://music.youtube.com/"), true);
  assert.equal(core.isYouTubeMusicUrl("https://music.youtube.com/watch?v=abc"), true);
  assert.equal(core.isYouTubeMusicUrl("http://music.youtube.com/"), false);
  assert.equal(core.isYouTubeMusicUrl("https://www.youtube.com/"), false);
  assert.equal(core.isYouTubeMusicUrl("https://music.youtube.com.example.com/"), false);
  assert.equal(core.isYouTubeMusicUrl("not a url"), false);
  assert.equal(core.isYouTubeMusicUrl(null), false);
});

test("creates and recognizes the toolbar toggle message", () => {
  const message = core.createToggleMessage();

  assert.deepEqual(message, { type: core.MESSAGE_TOGGLE });
  assert.equal(core.isToggleMessage(message), true);
  assert.equal(core.isToggleMessage({ type: "other" }), false);
  assert.equal(core.isToggleMessage(null), false);
});

test("toggles visibility unless an explicit state is requested", () => {
  assert.equal(core.nextVisibility(false), true);
  assert.equal(core.nextVisibility(true), false);
  assert.equal(core.nextVisibility(false, false), false);
  assert.equal(core.nextVisibility(false, true), true);
  assert.equal(core.nextVisibility(true, false), false);
});

test("normalizes text runs without leaking layout whitespace", () => {
  assert.equal(core.cleanText("  田馥甄\n  無人知曉  "), "田馥甄 無人知曉");
  assert.equal(core.textFromRuns({
    runs: [{ text: "田馥甄" }, { text: " • " }, { text: "無人知曉" }]
  }), "田馥甄 • 無人知曉");
  assert.equal(core.textFromRuns(null), "");
});

test("selects the largest usable image and excludes transparent GIF placeholders", () => {
  const transparentGif = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAA";
  const image = core.selectLargestImage([
    { url: transparentGif, width: 1000, height: 1000 },
    { url: "https://example.com/120.jpg", width: 120, height: 120 },
    { url: "https://example.com/544.jpg", width: 544, height: 544 }
  ]);

  assert.equal(image, "https://example.com/544.jpg");
  assert.equal(core.isUsableImageUrl(transparentGif), false);
  assert.equal(core.selectLargestImage([transparentGif]), null);
});

test("parses width-based srcset candidates", () => {
  assert.deepEqual(core.parseSrcset(
    "https://example.com/60.jpg 60w, https://example.com/544.jpg 544w"
  ), [
    { url: "https://example.com/60.jpg", width: 60, height: 60 },
    { url: "https://example.com/544.jpg", width: 544, height: 544 }
  ]);
  assert.deepEqual(core.parseSrcset(null), []);
});

test("preserves legal same-title tracks while removing repeated DOM sources", () => {
  const items = core.normalizeQueueCandidates([
    {
      sourceKey: "queue-0",
      videoId: "song-version",
      title: "先知",
      artist: "田馥甄"
    },
    {
      sourceKey: "queue-0",
      videoId: "hidden-dom-copy",
      title: "先知",
      artist: "Hebe Tien"
    },
    {
      sourceKey: "queue-1",
      videoId: "legitimate-repeat",
      title: "先知",
      artist: "田馥甄"
    }
  ]);

  assert.equal(items.length, 2);
  assert.deepEqual(items.map((item) => item.videoId), ["song-version", "legitimate-repeat"]);
  assert.deepEqual(items.map((item) => item.queueIndex), [0, 1]);
});

test("builds placeholder data when title or image is unavailable", () => {
  const [named, unknown] = core.normalizeQueueCandidates([
    {
      sourceKey: "queue-0",
      title: "或是一首歌",
      imageCandidates: ["data:image/gif;base64,R0lGODlhAQABAIAAAAAA"]
    },
    { sourceKey: "queue-1" }
  ]);

  assert.equal(named.imageUrl, null);
  assert.deepEqual(named.placeholder, { title: "或是一首歌" });
  assert.equal(unknown.title, core.UNKNOWN_TRACK_TITLE);
  assert.deepEqual(unknown.placeholder, { title: core.UNKNOWN_TRACK_TITLE });
});

test("centers the current track and falls back to the first available track", () => {
  const currentSnapshot = core.createQueueSnapshot([
    { sourceKey: "queue-0", title: "Intro" },
    { sourceKey: "queue-1", title: "或是一首歌", isCurrent: true }
  ]);
  const fallbackSnapshot = core.createQueueSnapshot([
    { sourceKey: "queue-0", title: "Intro" },
    { sourceKey: "queue-1", title: "先知" }
  ]);

  assert.equal(currentSnapshot.currentIndex, 1);
  assert.equal(currentSnapshot.selectedIndex, 1);
  assert.equal(fallbackSnapshot.currentIndex, 0);
  assert.equal(core.createQueueSnapshot([]).currentIndex, -1);
});

test("finds a playing track by video id before title and artist", () => {
  const items = core.normalizeQueueCandidates([
    { sourceKey: "queue-0", videoId: "a", title: "同名", artist: "甲" },
    { sourceKey: "queue-1", videoId: "b", title: "同名", artist: "乙" }
  ]);

  assert.equal(core.findTrackIndex(items, { videoId: "b", title: "同名", artist: "甲" }), 1);
  assert.equal(core.findTrackIndex(items, { title: "同名", artist: "乙" }), 1);
  assert.equal(core.findTrackIndex(items, { title: "不存在" }), -1);
});

test("clamps and settles indexes at queue boundaries", () => {
  assert.equal(core.clampIndex(-8, 4), 0);
  assert.equal(core.clampIndex(2.9, 4), 2);
  assert.equal(core.clampIndex(99, 4), 3);
  assert.equal(core.clampIndex(0, 0), -1);
  assert.equal(core.settleIndex(1.51, 4), 2);
  assert.equal(core.settleIndex(-30.2, 4), 0);
  assert.equal(core.settleIndex(300.8, 4), 3);
});
