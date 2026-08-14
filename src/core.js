(function exposeCoverFlowCore(root, factory) {
  const api = Object.freeze(factory());

  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }

  root.YtmCoverFlowCore = api;
})(typeof globalThis === "object" ? globalThis : this, function createCoverFlowCore() {
  const MESSAGE_TOGGLE = "ytm-cover-flow:toggle";
  const UNKNOWN_TRACK_TITLE = "未知曲目";
  const EMPTY_QUEUE_MESSAGE = "沒有曲目";

  function cleanText(value) {
    return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  }

  function textFromRuns(value) {
    if (typeof value === "string") {
      return cleanText(value);
    }

    if (!value || !Array.isArray(value.runs)) {
      return "";
    }

    return cleanText(value.runs.map((run) => run?.text || "").join(""));
  }

  function isUsableImageUrl(value) {
    const url = cleanText(value);

    if (!url || url === "about:blank") {
      return false;
    }

    return !/^data:image\/gif(?:;|,)/i.test(url);
  }

  function isTrustedArtworkUrl(value) {
    if (!isUsableImageUrl(value)) {
      return false;
    }

    try {
      const url = new URL(cleanText(value));
      return url.protocol === "https:"
        && ["yt3.googleusercontent.com", "lh3.googleusercontent.com", "i.ytimg.com"]
          .includes(url.hostname);
    } catch {
      return false;
    }
  }

  function upgradeGoogleArtworkUrl(value, minimumSize = 544) {
    const artworkUrl = cleanText(value);
    if (!isTrustedArtworkUrl(artworkUrl)) {
      return artworkUrl;
    }

    const url = new URL(artworkUrl);
    if (!["yt3.googleusercontent.com", "lh3.googleusercontent.com"].includes(url.hostname)) {
      return artworkUrl;
    }

    const safeMinimum = Number.isFinite(minimumSize)
      ? Math.max(1, Math.trunc(minimumSize))
      : 544;

    return artworkUrl.replace(/=w(\d+)-h(\d+)(?=-|$)/, (match, width, height) => {
      const upgradedWidth = Math.max(Number(width), safeMinimum);
      const upgradedHeight = Math.max(Number(height), safeMinimum);
      return `=w${upgradedWidth}-h${upgradedHeight}`;
    });
  }

  function normalizeImageCandidate(candidate) {
    const value = typeof candidate === "string" ? { url: candidate } : candidate;

    if (!value || !isUsableImageUrl(value.url)) {
      return null;
    }

    const width = Number.isFinite(Number(value.width)) ? Math.max(0, Number(value.width)) : 0;
    const height = Number.isFinite(Number(value.height)) ? Math.max(0, Number(value.height)) : 0;

    return {
      url: cleanText(value.url),
      width,
      height,
      score: width * height || width || height
    };
  }

  function parseSrcset(value) {
    if (typeof value !== "string") {
      return [];
    }

    return value
      .split(",")
      .map((part) => {
        const match = part.trim().match(/^(\S+)(?:\s+(\d+(?:\.\d+)?)(w|x))?$/);
        if (!match) {
          return null;
        }

        const size = Number(match[2]) || 0;
        return match[3] === "w"
          ? { url: match[1], width: size, height: size }
          : { url: match[1], width: size, height: 0 };
      })
      .filter(Boolean);
  }

  function selectLargestImage(candidates) {
    const normalized = Array.isArray(candidates)
      ? candidates.map(normalizeImageCandidate).filter(Boolean)
      : [];

    if (normalized.length === 0) {
      return null;
    }

    normalized.sort((left, right) => right.score - left.score);
    return normalized[0].url;
  }

  function normalizeQueueCandidates(candidates) {
    if (!Array.isArray(candidates)) {
      return [];
    }

    const seenSources = new Set();
    const items = [];

    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== "object") {
        continue;
      }

      const sourceKey = cleanText(candidate.sourceKey);
      if (sourceKey && seenSources.has(sourceKey)) {
        continue;
      }

      if (sourceKey) {
        seenSources.add(sourceKey);
      }

      const title = cleanText(candidate.title) || UNKNOWN_TRACK_TITLE;
      const imageCandidates = [
        ...(Array.isArray(candidate.imageCandidates) ? candidate.imageCandidates : []),
        candidate.imageUrl
      ];
      const imageUrl = selectLargestImage(imageCandidates);
      const queueIndex = items.length;

      items.push({
        id: sourceKey || `queue-${queueIndex}`,
        sourceKey: sourceKey || null,
        queueIndex,
        videoId: cleanText(candidate.videoId) || null,
        title,
        artist: cleanText(candidate.artist),
        imageUrl,
        placeholder: imageUrl ? null : { title },
        isVideo: candidate.isVideo === true,
        isCurrent: candidate.isCurrent === true
      });
    }

    return items;
  }

  function findCurrentIndex(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return -1;
    }

    const currentIndex = items.findIndex((item) => item?.isCurrent === true);
    return currentIndex >= 0 ? currentIndex : 0;
  }

  function findTrackIndex(items, identity) {
    if (!Array.isArray(items) || items.length === 0 || !identity) {
      return -1;
    }

    const videoId = cleanText(identity.videoId);
    if (videoId) {
      const videoIndex = items.findIndex((item) => item?.videoId === videoId);
      if (videoIndex >= 0) {
        return videoIndex;
      }
    }

    const title = cleanText(identity.title);
    const artist = cleanText(identity.artist);
    if (!title) {
      return -1;
    }

    return items.findIndex((item) => (
      cleanText(item?.title) === title
      && (!artist || cleanText(item?.artist) === artist)
    ));
  }

  function clampIndex(index, length) {
    if (!Number.isFinite(length) || length <= 0) {
      return -1;
    }

    const value = Number.isFinite(index) ? Math.trunc(index) : 0;
    return Math.min(Math.trunc(length) - 1, Math.max(0, value));
  }

  function settleIndex(position, length) {
    return clampIndex(Number.isFinite(position) ? Math.round(position) : 0, length);
  }

  function clampPosition(position, length) {
    if (!Number.isFinite(length) || length <= 0) {
      return -1;
    }

    const value = Number.isFinite(position) ? position : 0;
    return Math.min(Math.trunc(length) - 1, Math.max(0, value));
  }

  function moveIndex(index, delta, length) {
    const current = clampIndex(index, length);
    if (current < 0) {
      return -1;
    }

    const offset = Number.isFinite(delta) ? Math.trunc(delta) : 0;
    return clampIndex(current + offset, length);
  }

  function positionFromPointer(startPosition, deltaX, pixelsPerItem, length) {
    const distance = Number.isFinite(deltaX) ? deltaX : 0;
    const step = Number.isFinite(pixelsPerItem) && pixelsPerItem > 0
      ? pixelsPerItem
      : 1;

    return clampPosition(startPosition - (distance / step), length);
  }

  function positionFromWheel(currentPosition, deltaX, deltaY, pixelsPerItem, length) {
    const horizontal = Number.isFinite(deltaX) ? deltaX : 0;
    const vertical = Number.isFinite(deltaY) ? deltaY : 0;
    const dominantDelta = Math.abs(horizontal) > Math.abs(vertical) ? horizontal : vertical;
    const step = Number.isFinite(pixelsPerItem) && pixelsPerItem > 0
      ? pixelsPerItem
      : 1;

    return clampPosition(currentPosition + (dominantDelta / step), length);
  }

  function getVisibleRange(position, length, radius = 6) {
    if (!Number.isFinite(length) || length <= 0) {
      return { start: -1, end: -1 };
    }

    const center = settleIndex(position, length);
    const safeRadius = Number.isFinite(radius) ? Math.max(0, Math.trunc(radius)) : 0;

    return {
      start: Math.max(0, center - safeRadius),
      end: Math.min(Math.trunc(length) - 1, center + safeRadius)
    };
  }

  function getCoverLayout(index, position) {
    const safeIndex = Number.isFinite(index) ? index : 0;
    const safePosition = Number.isFinite(position) ? position : 0;
    const distance = safeIndex - safePosition;
    const magnitude = Math.abs(distance);
    const direction = Math.sign(distance);
    const sideOffset = magnitude <= 1
      ? magnitude * 78
      : 78 + ((magnitude - 1) * 24);
    const depth = magnitude === 0
      ? 0
      : magnitude <= 1
        ? magnitude * -75
      : -75 - ((magnitude - 1) * 28);
    const scale = Math.max(
      0.74,
      1 - (Math.min(magnitude, 1) * 0.12) - (Math.max(0, magnitude - 1) * 0.025)
    );
    const opacity = magnitude <= 4
      ? 1
      : Math.max(0, 1 - ((magnitude - 4) * 0.5));

    return {
      distance,
      translateXPercent: direction * sideOffset,
      translateZ: depth,
      rotateY: magnitude === 0 ? 0 : direction * Math.min(magnitude, 1) * -58,
      scale,
      opacity,
      zIndex: 1000 - Math.round(magnitude * 10)
    };
  }

  function createQueueSnapshot(candidates) {
    const items = normalizeQueueCandidates(candidates);
    const currentIndex = findCurrentIndex(items);

    return {
      items,
      currentIndex,
      selectedIndex: currentIndex
    };
  }

  function isYouTubeMusicUrl(value) {
    if (typeof value !== "string" || value.length === 0) {
      return false;
    }

    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname === "music.youtube.com";
    } catch {
      return false;
    }
  }

  function createToggleMessage() {
    return { type: MESSAGE_TOGGLE };
  }

  function isToggleMessage(value) {
    return Boolean(value && value.type === MESSAGE_TOGGLE);
  }

  function nextVisibility(current, requested) {
    if (typeof requested === "boolean") {
      return requested;
    }

    return !current;
  }

  return {
    EMPTY_QUEUE_MESSAGE,
    MESSAGE_TOGGLE,
    UNKNOWN_TRACK_TITLE,
    clampIndex,
    clampPosition,
    cleanText,
    createQueueSnapshot,
    createToggleMessage,
    findCurrentIndex,
    findTrackIndex,
    getCoverLayout,
    getVisibleRange,
    isToggleMessage,
    isTrustedArtworkUrl,
    isUsableImageUrl,
    isYouTubeMusicUrl,
    moveIndex,
    nextVisibility,
    normalizeQueueCandidates,
    parseSrcset,
    positionFromPointer,
    positionFromWheel,
    selectLargestImage,
    settleIndex,
    textFromRuns,
    upgradeGoogleArtworkUrl
  };
});
