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

test("trusts known YouTube artwork hosts and upgrades verified Google image dimensions", () => {
  const small = "https://yt3.googleusercontent.com/example=w120-h120-l90-rj";
  const large = "https://yt3.googleusercontent.com/example=w1000-h1000-l90-rj";

  assert.equal(core.isTrustedArtworkUrl(small), true);
  assert.equal(core.isTrustedArtworkUrl("https://i.ytimg.com/vi/example/hqdefault.jpg"), true);
  assert.equal(core.isTrustedArtworkUrl("https://example.com/cover.jpg"), false);
  assert.equal(
    core.upgradeGoogleArtworkUrl(small),
    "https://yt3.googleusercontent.com/example=w544-h544-l90-rj"
  );
  assert.equal(core.upgradeGoogleArtworkUrl(large), large);
  assert.equal(
    core.upgradeGoogleArtworkUrl("https://i.ytimg.com/vi/example/hqdefault.jpg"),
    "https://i.ytimg.com/vi/example/hqdefault.jpg"
  );
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

test("uses pause only for the selected track that is actively playing", () => {
  const items = core.normalizeQueueCandidates([
    { sourceKey: "queue-0", title: "第一首", isCurrent: true, isPlaying: true },
    { sourceKey: "queue-1", title: "第二首" }
  ]);

  assert.equal(core.getPlaybackAction(items, 0), "pause");
  assert.equal(core.getPlaybackAction(items, 1), "play");

  items[0].isPlaying = false;
  assert.equal(core.getPlaybackAction(items, 0), "play");
  assert.equal(core.getPlaybackAction([], 0), "play");
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

test("matches playback targets without accepting ambiguous fallback identities", () => {
  const item = {
    videoId: "target",
    title: "同名",
    artist: "甲"
  };

  assert.equal(core.isSameTrack(item, { videoId: "target", title: "其他", artist: "乙" }), true);
  assert.equal(core.isSameTrack(item, { videoId: "other", title: "同名", artist: "甲" }), false);
  assert.equal(core.isSameTrack(
    { title: "同名", artist: "甲" },
    { title: "同名", artist: "甲" }
  ), true);
  assert.equal(core.isSameTrack(
    { title: "同名", artist: "甲" },
    { title: "同名" }
  ), false);
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

test("keeps continuous positions and discrete movement inside queue boundaries", () => {
  assert.equal(core.clampPosition(-0.5, 4), 0);
  assert.equal(core.clampPosition(1.25, 4), 1.25);
  assert.equal(core.clampPosition(8, 4), 3);
  assert.equal(core.clampPosition(0, 0), -1);
  assert.equal(core.moveIndex(1, 1, 4), 2);
  assert.equal(core.moveIndex(0, -1, 4), 0);
  assert.equal(core.moveIndex(3, 1, 4), 3);
});

test("compresses overscroll outside queue bounds, including a single-track queue", () => {
  assert.equal(core.rubberBandPosition(1.25, 4), 1.25);
  assert.equal(core.rubberBandPosition(0, 1), 0);
  assert.ok(core.rubberBandPosition(-1, 1, 0.9, 0.65) < 0);
  assert.ok(core.rubberBandPosition(-1, 1, 0.9, 0.65) > -0.9);
  assert.ok(core.rubberBandPosition(1, 1, 0.9, 0.65) > 0);
  assert.ok(core.rubberBandPosition(1, 1, 0.9, 0.65) < 0.9);
  assert.ok(core.rubberBandPosition(-10, 1, 0.9, 0.65) > -0.9);
  assert.ok(core.rubberBandPosition(10, 1, 0.9, 0.65) < 0.9);
  assert.equal(
    core.rubberBandPosition(-1, 1, 0.9, 0.65),
    -core.rubberBandPosition(1, 1, 0.9, 0.65)
  );
  assert.equal(core.rubberBandPosition(0, 0), -1);
});

test("scales overscroll with responsive cover size while preserving desktop caps", () => {
  assert.equal(core.responsiveOverscrollDistance(360, 0.55, 198), 198);
  assert.ok(Math.abs(core.responsiveOverscrollDistance(180, 0.55, 198) - 99) < 1e-9);
  assert.equal(core.responsiveOverscrollDistance(360, 0.2, 72), 72);
  assert.equal(core.responsiveOverscrollDistance(180, 0.2, 72), 36);
  assert.equal(core.responsiveOverscrollDistance(0, 0.55, 198), 0);
});

test("converts pointer and dominant wheel movement into continuous positions", () => {
  assert.equal(core.positionFromPointer(2, 110, 220, 5), 1.5);
  assert.equal(core.positionFromPointer(2, -220, 220, 5), 3);
  assert.equal(core.positionFromPointer(0, 500, 220, 5), 0);
  assert.equal(core.positionFromWheel(1, 20, 120, 240, 5), 1.5);
  assert.equal(core.positionFromWheel(1, -240, 20, 240, 5), 0);
  assert.equal(core.positionFromWheel(4, 0, 300, 240, 5), 4);
  assert.equal(core.rawPositionFromPointer(0, 220, 220), -1);
  assert.equal(core.rawPositionFromPointer(0, -220, 220), 1);
  assert.equal(core.rawPositionFromWheel(0, 0, -240, 240), -1);
  assert.equal(core.rawPositionFromWheel(0, 0, 240, 240), 1);
});

test("calculates a bounded rendering window around the selected position", () => {
  assert.deepEqual(core.getVisibleRange(0, 20, 3), { start: 0, end: 3 });
  assert.deepEqual(core.getVisibleRange(10.4, 20, 3), { start: 7, end: 13 });
  assert.deepEqual(core.getVisibleRange(19, 20, 3), { start: 16, end: 19 });
  assert.deepEqual(core.getVisibleRange(0, 0, 3), { start: -1, end: -1 });
});

test("derives symmetric Cover Flow transforms from relative position", () => {
  const center = core.getCoverLayout(2, 2);
  const left = core.getCoverLayout(1, 2);
  const right = core.getCoverLayout(3, 2);

  assert.deepEqual(center, {
    distance: 0,
    translateXPercent: 0,
    translateZ: 0,
    rotateY: 0,
    scale: 1,
    opacity: 1,
    zIndex: 1000
  });
  assert.equal(left.translateXPercent, -right.translateXPercent);
  assert.equal(left.rotateY, -right.rotateY);
  assert.equal(left.translateZ, right.translateZ);
  assert.equal(left.scale, right.scale);
  assert.ok(center.zIndex > left.zIndex);
});

test("detects points inside projected cover polygons without using bounding boxes", () => {
  const trapezoid = [
    { x: 30, y: 10 },
    { x: 80, y: 20 },
    { x: 80, y: 90 },
    { x: 30, y: 100 }
  ];

  assert.equal(core.isPointInPolygon({ x: 55, y: 50 }, trapezoid), true);
  assert.equal(core.isPointInPolygon({ x: 80, y: 50 }, trapezoid), true);
  assert.equal(core.isPointInPolygon({ x: 20, y: 50 }, trapezoid), false);
  assert.equal(core.isPointInPolygon({ x: 75, y: 12 }, trapezoid), false);
});
