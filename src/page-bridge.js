(function initializeCoverFlowPageBridge() {
  if (globalThis.__ytmCoverFlowPageBridge) {
    return;
  }

  const REQUEST_EVENT = "ytm-cover-flow:request-queue-data";
  const RESPONSE_EVENT = "ytm-cover-flow:queue-data";
  const QUEUE_CONTENTS_SELECTOR = "ytmusic-player-queue#queue > #contents, ytmusic-player-queue > #contents";
  const ACTIVE_WRAPPER_ROW_SELECTOR = "#primary-renderer:not([hidden]) ytmusic-player-queue-item, #counterpart-renderer:not([hidden]) ytmusic-player-queue-item";
  const CURRENT_PLAY_STATES = new Set(["loading", "paused", "playing"]);

  function textFromRuns(value) {
    if (typeof value === "string") {
      return value;
    }

    return Array.isArray(value?.runs)
      ? value.runs.map((run) => run?.text || "").join("")
      : "";
  }

  function getActiveRow(child) {
    if (child.matches("ytmusic-player-queue-item")) {
      return child;
    }

    return child.querySelector(ACTIVE_WRAPPER_ROW_SELECTOR)
      || child.querySelector("ytmusic-player-queue-item");
  }

  function isVideoRow(row) {
    if (row.parentElement?.id === "counterpart-renderer") {
      return true;
    }

    const type = row.data?.navigationEndpoint?.watchEndpoint
      ?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType;

    return typeof type === "string" && type.length > 0 && type !== "MUSIC_VIDEO_TYPE_ATV";
  }

  function captureQueueData() {
    const contents = document.querySelector(QUEUE_CONTENTS_SELECTOR);
    if (!contents) {
      return [];
    }

    return [...contents.children].map((child, index) => {
      const row = getActiveRow(child);
      if (!row) {
        return null;
      }

      const data = row.data || {};
      const playState = row.getAttribute("play-button-state");

      return {
        sourceKey: `queue-${index}`,
        videoId: data.videoId,
        title: textFromRuns(data.title),
        artist: textFromRuns(data.shortBylineText),
        imageCandidates: Array.isArray(data.thumbnail?.thumbnails)
          ? data.thumbnail.thumbnails
          : [],
        isVideo: isVideoRow(row),
        isCurrent: data.selected === true
          || row.hasAttribute("selected")
          || CURRENT_PLAY_STATES.has(playState),
        isPlaying: playState === "playing"
      };
    }).filter(Boolean);
  }

  document.addEventListener(REQUEST_EVENT, (event) => {
    if (typeof event.detail !== "string" || event.detail.length === 0) {
      return;
    }

    document.dispatchEvent(new CustomEvent(RESPONSE_EVENT, {
      detail: JSON.stringify({
        requestId: event.detail,
        candidates: captureQueueData()
      })
    }));
  });

  globalThis.__ytmCoverFlowPageBridge = true;
})();
