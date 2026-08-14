(function initializeCoverFlowShell() {
  const core = globalThis.YtmCoverFlowCore;

  if (!core || globalThis.__ytmCoverFlowShell) {
    return;
  }

  const BUTTON_ID = "ytm-cover-flow-button";
  const HOST_ID = "ytm-cover-flow-host";
  const STYLE_ID = "ytm-cover-flow-shell-style";
  const APP_LAYOUT_SELECTOR = "ytmusic-app-layout#layout";
  const PLAYER_BAR_SELECTOR = "ytmusic-player-bar";
  const VOLUME_SELECTOR = "#right-controls #volume-slider";
  const PLAYER_BAR_MIN_HEIGHT = 72;
  const QUEUE_SELECTORS = Object.freeze({
    root: "ytmusic-player-queue#queue, ytmusic-player-queue",
    contents: ":scope > #contents",
    directChildren: ":scope > ytmusic-player-queue-item, :scope > ytmusic-playlist-panel-video-wrapper-renderer",
    row: "ytmusic-player-queue-item",
    activeWrapperRow: "#primary-renderer:not([hidden]) ytmusic-player-queue-item, #counterpart-renderer:not([hidden]) ytmusic-player-queue-item",
    fallbackWrapperRow: "#primary-renderer ytmusic-player-queue-item, #counterpart-renderer ytmusic-player-queue-item",
    title: ".song-title",
    artist: ".byline",
    image: "img"
  });
  const CURRENT_PLAY_STATES = new Set(["loading", "paused", "playing"]);

  let isOpen = false;
  let appLayout = null;
  let appLayoutObserver = null;
  let bootObserver = null;
  let playerBar = null;
  let playerBarObserver = null;
  let scheduledFrame = 0;
  let queueSnapshot = core.createQueueSnapshot([]);
  let queueRows = new Map();

  function ensureDocumentStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${BUTTON_ID} {
        align-items: center;
        appearance: none;
        background: transparent;
        border: 0;
        border-radius: 50%;
        color: var(--ytmusic-text-secondary, #aaa);
        cursor: pointer;
        display: inline-flex;
        flex: 0 0 40px;
        height: 40px;
        justify-content: center;
        margin: 0 2px;
        padding: 8px;
        transition: background-color 120ms ease, color 120ms ease;
        width: 40px;
      }

      #${BUTTON_ID}:hover,
      #${BUTTON_ID}:focus-visible,
      #${BUTTON_ID}[aria-pressed="true"] {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
        outline: none;
      }

      #${BUTTON_ID}:focus-visible {
        box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.72);
      }

      #${BUTTON_ID} svg {
        display: block;
        fill: currentColor;
        height: 24px;
        pointer-events: none;
        width: 24px;
      }
    `;
    document.head.append(style);
  }

  function createPlayerButton() {
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.setAttribute("aria-label", "切換 Cover Flow");
    button.setAttribute("aria-pressed", "false");
    button.title = "Cover Flow";
    button.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M3.5 7.5 8 5.7v12.6l-4.5-1.8v-9Zm6-2.3h5v13.6h-5V5.2Zm6.5.5 4.5 1.8v9L16 18.3V5.7Z"></path>
      </svg>
    `;
    button.addEventListener("click", () => setOpen());
    return button;
  }

  function createOverlayHost() {
    const host = document.createElement("div");
    host.id = HOST_ID;
    host.hidden = true;
    host.style.display = "none";
    host.style.position = "fixed";
    host.style.inset = "0 0 72px 0";
    host.style.zIndex = "999";
    host.style.pointerEvents = "none";

    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host {
          color-scheme: dark;
          font-family: Roboto, Arial, sans-serif;
        }

        .stage {
          align-items: center;
          background: #000;
          box-sizing: border-box;
          color: #fff;
          display: flex;
          height: 100%;
          justify-content: center;
          width: 100%;
        }

        .label {
          font-size: 18px;
          font-weight: 500;
          letter-spacing: 0.02em;
          opacity: 0.78;
        }
      </style>
      <section class="stage" aria-label="Cover Flow" role="dialog">
        <div class="label">Cover Flow</div>
      </section>
    `;

    document.body.append(host);
    return host;
  }

  function getButton() {
    return document.getElementById(BUTTON_ID);
  }

  function getOverlayHost() {
    return document.getElementById(HOST_ID) || createOverlayHost();
  }

  function getActiveQueueRow(child) {
    if (child.matches(QUEUE_SELECTORS.row)) {
      return child;
    }

    return child.querySelector(QUEUE_SELECTORS.activeWrapperRow)
      || child.querySelector(QUEUE_SELECTORS.fallbackWrapperRow);
  }

  function getImageCandidates(row) {
    const thumbnails = Array.isArray(row.data?.thumbnail?.thumbnails)
      ? row.data.thumbnail.thumbnails
      : [];
    const image = row.querySelector(QUEUE_SELECTORS.image);
    const srcsetCandidates = core.parseSrcset(image?.getAttribute("srcset"));

    return [
      ...thumbnails,
      ...srcsetCandidates,
      image?.currentSrc,
      image?.getAttribute("src")
    ];
  }

  function isVideoRow(row) {
    if (row.parentElement?.id === "counterpart-renderer") {
      return true;
    }

    const musicVideoType = row.data?.navigationEndpoint?.watchEndpoint
      ?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType;

    return typeof musicVideoType === "string"
      && musicVideoType.length > 0
      && musicVideoType !== "MUSIC_VIDEO_TYPE_ATV";
  }

  function readQueueCandidate(row, sourceKey) {
    const data = row.data || {};
    const playState = row.getAttribute("play-button-state");

    return {
      sourceKey,
      videoId: data.videoId,
      title: core.textFromRuns(data.title)
        || row.querySelector(QUEUE_SELECTORS.title)?.textContent,
      artist: core.textFromRuns(data.shortBylineText)
        || row.querySelector(QUEUE_SELECTORS.artist)?.textContent,
      imageCandidates: getImageCandidates(row),
      isVideo: isVideoRow(row),
      isCurrent: data.selected === true
        || row.hasAttribute("selected")
        || CURRENT_PLAY_STATES.has(playState)
    };
  }

  function captureQueueSnapshot() {
    const root = document.querySelector(QUEUE_SELECTORS.root);
    const contents = root?.querySelector(QUEUE_SELECTORS.contents);
    const nextRows = new Map();

    if (!contents) {
      queueRows = nextRows;
      return core.createQueueSnapshot([]);
    }

    const candidates = [...contents.querySelectorAll(QUEUE_SELECTORS.directChildren)]
      .map((child, index) => {
        const row = getActiveQueueRow(child);
        if (!row) {
          return null;
        }

        const sourceKey = `queue-${index}`;
        nextRows.set(sourceKey, row);
        return readQueueCandidate(row, sourceKey);
      })
      .filter(Boolean);

    queueRows = nextRows;
    return core.createQueueSnapshot(candidates);
  }

  function renderQueueShellState() {
    const host = getOverlayHost();
    const label = host.shadowRoot?.querySelector(".label");

    host.dataset.queueLength = String(queueSnapshot.items.length);
    host.dataset.currentIndex = String(queueSnapshot.currentIndex);

    if (label) {
      label.textContent = queueSnapshot.items.length > 0
        ? "Cover Flow"
        : core.EMPTY_QUEUE_MESSAGE;
    }
  }

  function updateOverlayInset() {
    const host = getOverlayHost();
    const height = playerBar?.getBoundingClientRect().height || PLAYER_BAR_MIN_HEIGHT;
    host.style.bottom = `${Math.max(PLAYER_BAR_MIN_HEIGHT, Math.round(height))}px`;
  }

  function setOpen(requested) {
    isOpen = core.nextVisibility(isOpen, requested);

    const host = getOverlayHost();
    host.hidden = !isOpen;
    host.style.display = isOpen ? "block" : "none";
    host.style.pointerEvents = isOpen ? "auto" : "none";
    getButton()?.setAttribute("aria-pressed", String(isOpen));

    if (isOpen) {
      queueSnapshot = captureQueueSnapshot();
      renderQueueShellState();
      updateOverlayInset();
    }
  }

  function ensurePlayerButton() {
    const currentAppLayout = document.querySelector(APP_LAYOUT_SELECTOR);
    if (currentAppLayout) {
      bindAppLayout(currentAppLayout);
    }

    const currentPlayerBar = currentAppLayout?.querySelector(PLAYER_BAR_SELECTOR);
    if (!currentPlayerBar) {
      return;
    }

    bindPlayerBar(currentPlayerBar);
    ensureDocumentStyles();

    const volume = currentPlayerBar.querySelector(VOLUME_SELECTOR);
    if (!volume) {
      return;
    }

    let button = getButton();
    if (!button) {
      button = createPlayerButton();
    }

    if (button.parentElement !== volume.parentElement || button.nextElementSibling !== volume) {
      volume.before(button);
    }

    button.setAttribute("aria-pressed", String(isOpen));
    updateOverlayInset();
  }

  function schedulePlayerButtonCheck() {
    if (scheduledFrame) {
      return;
    }

    scheduledFrame = requestAnimationFrame(() => {
      scheduledFrame = 0;
      ensurePlayerButton();
    });
  }

  function bindPlayerBar(nextPlayerBar) {
    if (playerBar === nextPlayerBar) {
      return;
    }

    playerBarObserver?.disconnect();
    playerBar = nextPlayerBar;
    playerBarObserver = new MutationObserver(schedulePlayerButtonCheck);
    playerBarObserver.observe(playerBar, { childList: true, subtree: true });
  }

  function bindAppLayout(nextAppLayout) {
    if (appLayout === nextAppLayout) {
      return;
    }

    appLayoutObserver?.disconnect();
    appLayout = nextAppLayout;
    appLayoutObserver = new MutationObserver(schedulePlayerButtonCheck);
    appLayoutObserver.observe(appLayout, { childList: true });
    bootObserver?.disconnect();
  }

  function handleKeydown(event) {
    if (isOpen && event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (core.isToggleMessage(message)) {
      setOpen();
    }
  });

  document.addEventListener("keydown", handleKeydown, true);
  window.addEventListener("resize", updateOverlayInset, { passive: true });

  bootObserver = new MutationObserver(schedulePlayerButtonCheck);
  bootObserver.observe(document.documentElement, { childList: true, subtree: true });

  globalThis.__ytmCoverFlowShell = Object.freeze({
    captureQueueSnapshot,
    ensurePlayerButton,
    getSnapshot: () => queueSnapshot,
    getSourceRow: (sourceKey) => queueRows.get(sourceKey) || null,
    setOpen
  });

  ensurePlayerButton();
})();
