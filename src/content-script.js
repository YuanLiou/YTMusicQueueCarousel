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
  const PLAYER_BAR_ACTIVE_CLASS = "ytm-cover-flow-active";
  const NATIVE_QUEUE_HIDDEN_CLASS = "ytm-cover-flow-queue-hidden";
  const VOLUME_SELECTOR = "#right-controls #volume-slider";
  const PLAYER_BAR_MIN_HEIGHT = 72;
  const QUEUE_SELECTORS = Object.freeze({
    root: "ytmusic-player-queue#queue, ytmusic-player-queue",
    contents: ":scope > #contents",
    row: "ytmusic-player-queue-item",
    activeWrapperRow: "#primary-renderer:not([hidden]) ytmusic-player-queue-item, #counterpart-renderer:not([hidden]) ytmusic-player-queue-item",
    fallbackWrapperRow: "#primary-renderer ytmusic-player-queue-item, #counterpart-renderer ytmusic-player-queue-item",
    title: ".song-title",
    artist: ".byline",
    image: "img"
  });
  const PLAY_TARGET_SELECTOR = [
    "ytmusic-play-button-renderer",
    "#play-button",
    "button[aria-label*='播放']",
    "button[aria-label*='Play']",
    "[role='button'][aria-label*='播放']",
    "[role='button'][aria-label*='Play']"
  ].join(", ");
  const CURRENT_PLAY_STATES = new Set(["loading", "paused", "playing"]);
  const PAGE_QUEUE_REQUEST_EVENT = "ytm-cover-flow:request-queue-data";
  const PAGE_QUEUE_RESPONSE_EVENT = "ytm-cover-flow:queue-data";
  const VISIBLE_RADIUS = 6;
  const POINTER_PIXELS_PER_ITEM = 220;
  const WHEEL_PIXELS_PER_ITEM = 240;
  const DRAG_THRESHOLD = 6;
  const SNAP_DURATION = 320;

  let isOpen = false;
  let appLayout = null;
  let appLayoutObserver = null;
  let bootObserver = null;
  let playerBar = null;
  let playerBarObserver = null;
  let queueObserver = null;
  let observedQueueContents = null;
  let currentTrackSyncTimer = 0;
  let scheduledFrame = 0;
  let syncFrame = 0;
  let queueSnapshot = core.createQueueSnapshot([]);
  let queueRows = new Map();
  let selectedPosition = -1;
  let renderedRange = { start: -2, end: -2 };
  let coverCards = new Map();
  let animationFrame = 0;
  let wheelTimer = 0;
  let infoTimer = 0;
  let lastInfoIndex = -2;
  let pendingInfoIndex = -2;
  let pointerState = null;
  let suppressClick = false;
  let overlayFadeFrame = 0;

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

      ${PLAYER_BAR_SELECTOR}.${PLAYER_BAR_ACTIVE_CLASS} {
        z-index: 1000 !important;
      }

      ytmusic-player-queue#queue.${NATIVE_QUEUE_HIDDEN_CLASS},
      ytmusic-player-queue.${NATIVE_QUEUE_HIDDEN_CLASS} {
        display: none !important;
      }
    `;
    document.head.append(style);
  }

  function createPlayerButton() {
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.setAttribute("aria-label", "切換 YouTube Music Queue Carousel");
    button.setAttribute("aria-pressed", "false");
    button.title = "YouTube Music Queue Carousel";
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
          user-select: none;
        }

        .stage {
          background: #000;
          box-sizing: border-box;
          color: #fff;
          height: 100%;
          opacity: 0;
          overflow: hidden;
          position: relative;
          touch-action: none;
          transition: opacity 150ms ease-out;
          width: 100%;
        }

        :host([data-visible="true"]) .stage {
          opacity: 1;
        }

        .brand {
          align-items: center;
          display: inline-flex;
          gap: 9px;
          left: clamp(18px, 2.6vw, 42px);
          pointer-events: none;
          position: absolute;
          top: clamp(18px, 2.8vw, 42px);
          z-index: 1100;
        }

        .brand-mark {
          align-items: center;
          background: rgba(255, 255, 255, 0.94);
          border-radius: 50%;
          display: inline-flex;
          height: 32px;
          justify-content: center;
          width: 32px;
        }

        .brand-mark::before {
          border-bottom: 7px solid transparent;
          border-left: 11px solid #000;
          border-top: 7px solid transparent;
          content: "";
          margin-left: 3px;
        }

        .brand-name {
          color: #fff;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .viewport {
          height: 100%;
          outline: none;
          perspective: 1100px;
          perspective-origin: 50% 43%;
          position: relative;
          width: 100%;
        }

        .viewport.dragging {
          cursor: grabbing;
        }

        .flow {
          height: 100%;
          position: relative;
          transform-style: preserve-3d;
          width: 100%;
        }

        .cover-card {
          background: transparent;
          border: 0;
          cursor: pointer;
          height: var(--cover-size);
          left: 50%;
          margin: 0;
          outline: none;
          padding: 0;
          position: absolute;
          top: 42%;
          transform-origin: center center;
          transform-style: preserve-3d;
          width: var(--cover-size);
          will-change: transform, opacity;
        }

        .cover-card:focus-visible .artwork {
          box-shadow: 0 0 0 3px #fff, 0 18px 45px rgba(0, 0, 0, 0.55);
        }

        .artwork {
          background: #202020;
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.55);
          height: 100%;
          overflow: hidden;
          position: relative;
          width: 100%;
        }

        .artwork img {
          display: block;
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        .placeholder {
          align-items: center;
          background: linear-gradient(145deg, #323232, #111);
          box-sizing: border-box;
          color: rgba(255, 255, 255, 0.9);
          display: none;
          font-size: clamp(15px, 1.4vw, 20px);
          font-weight: 600;
          height: 100%;
          justify-content: center;
          line-height: 1.35;
          padding: 24px;
          position: absolute;
          text-align: center;
          text-wrap: balance;
          width: 100%;
        }

        .artwork.no-image .placeholder,
        .artwork.image-failed .placeholder {
          display: flex;
        }

        .artwork.image-failed img {
          display: none;
        }

        .play-button {
          align-items: center;
          background: rgba(0, 0, 0, 0.72);
          border: 1px solid rgba(255, 255, 255, 0.72);
          border-radius: 50%;
          box-sizing: border-box;
          box-shadow: 0 5px 18px rgba(0, 0, 0, 0.4);
          color: #fff;
          display: flex;
          height: min(23%, 76px);
          justify-content: center;
          left: 50%;
          opacity: 0;
          padding: 0;
          pointer-events: none;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%) scale(0.92);
          transition: background-color 120ms ease, box-shadow 120ms ease, opacity 130ms ease, transform 130ms ease;
          width: min(23%, 76px);
        }

        .cover-card[aria-selected="true"]:hover .play-button,
        .cover-card[aria-selected="true"]:focus-visible .play-button {
          opacity: 1;
          pointer-events: auto;
          transform: translate(-50%, -50%) scale(1);
        }

        .play-button:hover {
          background: rgba(0, 0, 0, 0.82);
          box-shadow: 0 7px 22px rgba(0, 0, 0, 0.52);
        }

        .play-button:active,
        .play-button.is-pressed {
          background: rgba(0, 0, 0, 0.88);
          box-shadow: 0 2px 7px rgba(0, 0, 0, 0.58), inset 0 2px 5px rgba(0, 0, 0, 0.4);
          transform: translate(-50%, -50%) scale(0.76);
        }

        .play-button.is-activated {
          animation: play-button-activation 280ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        @keyframes play-button-activation {
          0% {
            transform: translate(-50%, -50%) scale(1);
          }
          34% {
            transform: translate(-50%, -50%) scale(0.68);
          }
          68% {
            transform: translate(-50%, -50%) scale(1.12);
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
          }
        }

        .play-button::before {
          border-bottom: 10px solid transparent;
          border-left: 15px solid currentColor;
          border-top: 10px solid transparent;
          content: "";
          margin-left: 4px;
        }

        .play-button[data-action="pause"]::before {
          background: linear-gradient(to right, currentColor 0 5px, transparent 5px 10px, currentColor 10px 15px);
          border: 0;
          height: 20px;
          margin-left: 0;
          width: 15px;
        }

        .reflection-clip {
          height: 45%;
          left: 0;
          mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.42), transparent 82%);
          overflow: hidden;
          pointer-events: none;
          position: absolute;
          top: calc(100% + 9px);
          width: 100%;
          -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.42), transparent 82%);
        }

        .reflection {
          background-position: center;
          background-size: cover;
          display: block;
          height: 222.23%;
          opacity: 0.38;
          transform: scaleY(-1);
          width: 100%;
        }

        .reflection.placeholder-reflection {
          background: linear-gradient(145deg, #323232, #111);
        }

        .track-info {
          bottom: 5.5%;
          box-sizing: border-box;
          left: 50%;
          max-width: min(680px, 78vw);
          opacity: 1;
          pointer-events: none;
          position: absolute;
          text-align: center;
          transform: translateX(-50%);
          transition: opacity 90ms ease;
          width: max-content;
        }

        .track-info.changing {
          opacity: 0;
        }

        .track-title {
          color: #fff;
          font-size: clamp(19px, 2vw, 28px);
          font-weight: 600;
          line-height: 1.25;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .track-artist {
          color: #9d9d9d;
          font-size: clamp(14px, 1.35vw, 18px);
          line-height: 1.5;
          margin-top: 5px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .empty-state {
          font-size: 18px;
          font-weight: 500;
          left: 50%;
          letter-spacing: 0.02em;
          opacity: 0.78;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
        }

        [hidden] {
          display: none !important;
        }

        @media (prefers-reduced-motion: reduce) {
          .stage,
          .track-info,
          .play-button {
            transition-duration: 0ms;
          }
        }

        @media (max-height: 620px) {
          .cover-card {
            top: 39%;
          }

          .track-info {
            bottom: 3%;
          }
        }
      </style>
      <section class="stage" aria-label="YouTube Music Queue Carousel" role="dialog">
        <div class="brand" aria-label="YouTube Music">
          <span class="brand-mark" aria-hidden="true"></span>
          <span class="brand-name" aria-hidden="true">YouTube Music</span>
        </div>
        <div
          class="viewport"
          role="listbox"
          aria-label="YouTube Music Queue Carousel 播放佇列"
          tabindex="0"
          style="--cover-size: min(30vw, 40vh, 360px)"
        >
          <div class="flow"></div>
        </div>
        <div class="track-info" aria-live="polite">
          <div class="track-title"></div>
          <div class="track-artist"></div>
        </div>
        <div class="empty-state" hidden>${core.EMPTY_QUEUE_MESSAGE}</div>
      </section>
    `;

    const viewport = shadow.querySelector(".viewport");
    viewport.addEventListener("pointerdown", handlePointerDown);
    viewport.addEventListener("pointermove", handlePointerMove);
    viewport.addEventListener("pointerup", handlePointerEnd);
    viewport.addEventListener("pointercancel", handlePointerEnd);
    viewport.addEventListener("click", handleCoverClick);
    viewport.addEventListener("wheel", handleWheel, { passive: false });

    document.body.append(host);
    return host;
  }

  function getButton() {
    return document.getElementById(BUTTON_ID);
  }

  function getOverlayHost() {
    return document.getElementById(HOST_ID) || createOverlayHost();
  }

  function getOverlayParts() {
    const shadow = getOverlayHost().shadowRoot;

    return {
      emptyState: shadow?.querySelector(".empty-state"),
      flow: shadow?.querySelector(".flow"),
      info: shadow?.querySelector(".track-info"),
      artist: shadow?.querySelector(".track-artist"),
      title: shadow?.querySelector(".track-title"),
      viewport: shadow?.querySelector(".viewport")
    };
  }

  function getNativeQueue() {
    return document.querySelector(QUEUE_SELECTORS.root);
  }

  function setNativeQueueVisibility(hidden) {
    getNativeQueue()?.classList.toggle(NATIVE_QUEUE_HIDDEN_CLASS, hidden);
  }

  function updatePlayButton(playButton, index) {
    const item = queueSnapshot.items[index];
    if (!playButton || !item) {
      return;
    }

    const action = core.getPlaybackAction(queueSnapshot.items, index);
    playButton.dataset.action = action;
    playButton.setAttribute("aria-label", `${action === "pause" ? "暫停" : "播放"} ${item.title}`);
  }

  function createCoverCard(item, index) {
    const card = document.createElement("div");
    card.className = "cover-card";
    card.dataset.index = String(index);
    card.setAttribute("role", "option");
    card.setAttribute("aria-label", `選取 ${item.title}`);
    card.setAttribute("aria-selected", "false");
    card.tabIndex = -1;

    const artwork = document.createElement("span");
    artwork.className = "artwork";
    const reflectionClip = document.createElement("span");
    reflectionClip.className = "reflection-clip";
    const reflection = document.createElement("span");
    reflection.className = "reflection";
    reflectionClip.append(reflection);

    const placeholder = document.createElement("span");
    placeholder.className = "placeholder";
    placeholder.textContent = item.placeholder?.title || item.title;
    artwork.append(placeholder);

    const playButton = document.createElement("button");
    playButton.className = "play-button";
    playButton.type = "button";
    updatePlayButton(playButton, index);
    playButton.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      playButton.classList.add("is-pressed");
    });
    playButton.addEventListener("pointerup", () => playButton.classList.remove("is-pressed"));
    playButton.addEventListener("pointercancel", () => playButton.classList.remove("is-pressed"));
    playButton.addEventListener("pointerleave", () => playButton.classList.remove("is-pressed"));
    playButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      playButton.classList.remove("is-activated");
      void playButton.offsetWidth;
      playButton.classList.add("is-activated");
      playSelectedTrack();
    });
    playButton.addEventListener("animationend", () => {
      playButton.classList.remove("is-activated");
    });
    artwork.append(playButton);

    if (item.imageUrl) {
      const image = document.createElement("img");
      image.alt = "";
      image.decoding = "async";
      image.draggable = false;
      image.src = item.imageUrl;
      reflection.style.backgroundImage = `url(${JSON.stringify(item.imageUrl)})`;
      image.addEventListener("error", () => {
        artwork.classList.add("image-failed");
        reflection.style.removeProperty("background-image");
        reflection.classList.add("placeholder-reflection");
      }, { once: true });
      artwork.prepend(image);
    } else {
      artwork.classList.add("no-image");
      reflection.classList.add("placeholder-reflection");
    }

    card.append(artwork, reflectionClip);
    return card;
  }

  function ensureRenderedRange() {
    const nextRange = core.getVisibleRange(
      selectedPosition,
      queueSnapshot.items.length,
      VISIBLE_RADIUS
    );

    if (nextRange.start === renderedRange.start && nextRange.end === renderedRange.end) {
      return;
    }

    const { flow } = getOverlayParts();
    if (!flow) {
      return;
    }

    const fragment = document.createDocumentFragment();
    const nextCards = new Map();

    for (let index = nextRange.start; index <= nextRange.end; index += 1) {
      const card = createCoverCard(queueSnapshot.items[index], index);
      fragment.append(card);
      nextCards.set(index, card);
    }

    flow.replaceChildren(fragment);
    coverCards = nextCards;
    renderedRange = nextRange;
  }

  function updateSelectedInfo(index, immediate = false) {
    if (index < 0 || index === lastInfoIndex || index === pendingInfoIndex) {
      return;
    }

    const { artist, info, title } = getOverlayParts();
    const item = queueSnapshot.items[index];
    if (!artist || !info || !title || !item) {
      return;
    }

    clearTimeout(infoTimer);
    pendingInfoIndex = index;

    const applyText = () => {
      title.textContent = item.title;
      artist.textContent = item.artist;
      artist.hidden = !item.artist;
      lastInfoIndex = index;
      pendingInfoIndex = -2;
      requestAnimationFrame(() => info.classList.remove("changing"));
    };

    if (immediate || lastInfoIndex < 0) {
      applyText();
      return;
    }

    info.classList.add("changing");
    infoTimer = window.setTimeout(applyText, 90);
  }

  function renderSelectedPosition({ immediateInfo = false } = {}) {
    if (selectedPosition < 0) {
      return;
    }

    ensureRenderedRange();
    const selectedIndex = core.settleIndex(selectedPosition, queueSnapshot.items.length);
    queueSnapshot.selectedIndex = selectedIndex;

    for (const [index, card] of coverCards) {
      const layout = core.getCoverLayout(index, selectedPosition);
      card.style.opacity = String(layout.opacity);
      card.style.pointerEvents = layout.opacity > 0 ? "auto" : "none";
      card.style.zIndex = String(layout.zIndex);
      card.style.transform = `translate3d(calc(-50% + ${layout.translateXPercent}%), -50%, ${layout.translateZ}px) rotateY(${layout.rotateY}deg) scale(${layout.scale})`;
      card.setAttribute("aria-selected", String(index === selectedIndex));
      card.setAttribute(
        "aria-label",
        index === selectedIndex
          ? `目前置中的 ${queueSnapshot.items[index].title}`
          : `置中 ${queueSnapshot.items[index].title}`
      );
      updatePlayButton(card.querySelector(".play-button"), index);
    }

    updateSelectedInfo(selectedIndex, immediateInfo);
  }

  function cancelAnimation() {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
  }

  function setSelectedPosition(position, options) {
    const nextPosition = core.clampPosition(position, queueSnapshot.items.length);
    if (nextPosition < 0) {
      return;
    }

    selectedPosition = nextPosition;
    renderSelectedPosition(options);
  }

  function animateToIndex(index) {
    const target = core.clampIndex(index, queueSnapshot.items.length);
    if (target < 0) {
      return;
    }

    cancelAnimation();
    const start = selectedPosition;
    const distance = target - start;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion || Math.abs(distance) < 0.001) {
      setSelectedPosition(target);
      return;
    }

    const startedAt = performance.now();
    const duration = Math.min(480, SNAP_DURATION + (Math.abs(distance) * 35));

    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - ((1 - progress) ** 3);
      setSelectedPosition(start + (distance * eased));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(tick);
      } else {
        animationFrame = 0;
        setSelectedPosition(target);
      }
    };

    animationFrame = requestAnimationFrame(tick);
  }

  function moveSelection(delta) {
    const currentIndex = core.settleIndex(selectedPosition, queueSnapshot.items.length);
    animateToIndex(core.moveIndex(currentIndex, delta, queueSnapshot.items.length));
  }

  function snapToNearestCover() {
    animateToIndex(core.settleIndex(selectedPosition, queueSnapshot.items.length));
  }

  function findLiveQueueRow(item) {
    const knownRow = queueRows.get(item.sourceKey);
    if (knownRow?.isConnected) {
      return knownRow;
    }

    const contents = getNativeQueue()
      ?.querySelector(QUEUE_SELECTORS.contents);
    if (!contents) {
      return null;
    }

    const candidate = requestPageQueueCandidates().find((nextCandidate) => (
      core.isSameTrack(item, nextCandidate)
    ));
    const sourceIndex = Number(candidate?.sourceKey?.replace(/^queue-/, ""));
    if (!Number.isInteger(sourceIndex)) {
      return null;
    }

    const row = getActiveQueueRow(contents.children[sourceIndex]);
    if (row) {
      queueRows.set(item.sourceKey, row);
    }
    return row || null;
  }

  function playSelectedTrack() {
    const selectedIndex = core.settleIndex(selectedPosition, queueSnapshot.items.length);
    const item = queueSnapshot.items[selectedIndex];
    if (!item) {
      return;
    }

    if (core.getPlaybackAction(queueSnapshot.items, selectedIndex) === "pause") {
      const nativeToggle = playerBar?.querySelector("#play-pause-button");
      if (nativeToggle) {
        nativeToggle.click();
        return;
      }
    }

    const row = findLiveQueueRow(item);
    const playTarget = row?.querySelector(PLAY_TARGET_SELECTOR);
    playTarget?.click();
  }

  function syncCurrentTrack() {
    if (!isOpen || queueSnapshot.items.length === 0) {
      return;
    }

    const currentCandidate = requestPageQueueCandidates().find((candidate) => (
      candidate.isCurrent === true
    ));
    const nextIndex = Number(currentCandidate?.sourceKey?.replace(/^queue-/, ""));

    if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= queueSnapshot.items.length) {
      return;
    }

    const wasPlaying = queueSnapshot.items[nextIndex]?.isPlaying === true;
    const isPlaying = currentCandidate.isPlaying === true;
    const indexChanged = nextIndex !== queueSnapshot.currentIndex;

    for (let index = 0; index < queueSnapshot.items.length; index += 1) {
      queueSnapshot.items[index].isCurrent = index === nextIndex;
      queueSnapshot.items[index].isPlaying = index === nextIndex && isPlaying;
    }

    if (indexChanged) {
      queueSnapshot.currentIndex = nextIndex;
      getOverlayHost().dataset.currentIndex = String(nextIndex);
      animateToIndex(nextIndex);
    } else if (wasPlaying !== isPlaying) {
      renderSelectedPosition();
    }
  }

  function scheduleCurrentTrackSync() {
    if (!isOpen || syncFrame) {
      return;
    }

    syncFrame = requestAnimationFrame(() => {
      syncFrame = 0;
      syncCurrentTrack();
    });
  }

  function startCurrentTrackSync() {
    clearInterval(currentTrackSyncTimer);
    currentTrackSyncTimer = window.setInterval(scheduleCurrentTrackSync, 250);
    scheduleCurrentTrackSync();
  }

  function stopCurrentTrackSync() {
    clearInterval(currentTrackSyncTimer);
    currentTrackSyncTimer = 0;
  }

  function getActiveQueueRow(child) {
    if (child.matches(QUEUE_SELECTORS.row)) {
      return child;
    }

    return child.querySelector(QUEUE_SELECTORS.activeWrapperRow)
      || child.querySelector(QUEUE_SELECTORS.fallbackWrapperRow);
  }

  function requestPageQueueCandidates() {
    const requestId = crypto.randomUUID?.()
      || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let candidates = [];

    const handleResponse = (event) => {
      if (typeof event.detail !== "string") {
        return;
      }

      try {
        const payload = JSON.parse(event.detail);
        if (payload?.requestId !== requestId || !Array.isArray(payload.candidates)) {
          return;
        }

        candidates = payload.candidates.map((candidate, index) => ({
          ...candidate,
          sourceKey: typeof candidate?.sourceKey === "string"
            ? candidate.sourceKey
            : `queue-${index}`,
          imageCandidates: Array.isArray(candidate?.imageCandidates)
            ? candidate.imageCandidates.filter((image) => (
              core.isTrustedArtworkUrl(typeof image === "string" ? image : image?.url)
            ))
            : []
        }));
      } catch {
        candidates = [];
      }
    };

    document.addEventListener(PAGE_QUEUE_RESPONSE_EVENT, handleResponse);
    document.dispatchEvent(new CustomEvent(PAGE_QUEUE_REQUEST_EVENT, { detail: requestId }));
    document.removeEventListener(PAGE_QUEUE_RESPONSE_EVENT, handleResponse);
    return candidates;
  }

  function upgradeImageCandidate(candidate) {
    if (typeof candidate === "string") {
      return core.upgradeGoogleArtworkUrl(candidate);
    }

    if (!candidate || typeof candidate !== "object") {
      return candidate;
    }

    return {
      ...candidate,
      url: core.upgradeGoogleArtworkUrl(candidate.url)
    };
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
    ].map(upgradeImageCandidate);
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
        || CURRENT_PLAY_STATES.has(playState),
      isPlaying: playState === "playing"
    };
  }

  function captureQueueSnapshot() {
    const root = getNativeQueue();
    const contents = root?.querySelector(QUEUE_SELECTORS.contents);
    const nextRows = new Map();
    const pageCandidates = requestPageQueueCandidates();
    const pageCandidatesBySourceKey = new Map(
      pageCandidates.map((candidate) => [candidate.sourceKey, candidate])
    );

    if (!contents) {
      queueRows = nextRows;
      return core.createQueueSnapshot([]);
    }

    const candidates = [...contents.children]
      .map((child, index) => {
        const row = getActiveQueueRow(child);
        if (!row) {
          return null;
        }

        const sourceKey = `queue-${index}`;
        const domCandidate = readQueueCandidate(row, sourceKey);
        const pageCandidate = pageCandidatesBySourceKey.get(sourceKey);
        nextRows.set(sourceKey, row);

        if (!pageCandidate) {
          return domCandidate;
        }

        return {
          ...domCandidate,
          ...pageCandidate,
          sourceKey,
          imageCandidates: [
            ...(pageCandidate.imageCandidates || []),
            ...(domCandidate.imageCandidates || [])
          ],
          isCurrent: pageCandidate.isCurrent === true || domCandidate.isCurrent === true,
          isPlaying: pageCandidate.isPlaying === true || domCandidate.isPlaying === true
        };
      })
      .filter(Boolean);

    queueRows = nextRows;
    return core.createQueueSnapshot(candidates);
  }

  function renderQueueShellState() {
    const host = getOverlayHost();
    const { emptyState, info, viewport } = getOverlayParts();
    const hasItems = queueSnapshot.items.length > 0;

    host.dataset.queueLength = String(queueSnapshot.items.length);
    host.dataset.currentIndex = String(queueSnapshot.currentIndex);

    if (emptyState && info && viewport) {
      emptyState.hidden = hasItems;
      info.hidden = !hasItems;
      viewport.hidden = !hasItems;
    }

    renderedRange = { start: -2, end: -2 };
    coverCards = new Map();
    lastInfoIndex = -2;
    pendingInfoIndex = -2;

    if (hasItems) {
      selectedPosition = queueSnapshot.selectedIndex;
      renderSelectedPosition({ immediateInfo: true });
    } else {
      selectedPosition = -1;
    }
  }

  function handlePointerDown(event) {
    if (!isOpen || event.button !== 0 || queueSnapshot.items.length === 0) {
      return;
    }

    cancelAnimation();
    clearTimeout(wheelTimer);
    suppressClick = false;
    pointerState = {
      id: event.pointerId,
      moved: false,
      startPosition: selectedPosition,
      startX: event.clientX
    };
  }

  function handlePointerMove(event) {
    if (!pointerState || event.pointerId !== pointerState.id) {
      return;
    }

    const deltaX = event.clientX - pointerState.startX;
    if (Math.abs(deltaX) >= DRAG_THRESHOLD) {
      if (!pointerState.moved) {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        event.currentTarget.classList.add("dragging");
      }
      pointerState.moved = true;
    }

    if (!pointerState.moved) {
      return;
    }

    event.preventDefault();
    setSelectedPosition(core.positionFromPointer(
      pointerState.startPosition,
      deltaX,
      POINTER_PIXELS_PER_ITEM,
      queueSnapshot.items.length
    ));
  }

  function handlePointerEnd(event) {
    if (!pointerState || event.pointerId !== pointerState.id) {
      return;
    }

    suppressClick = pointerState.moved;
    pointerState = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    event.currentTarget.classList.remove("dragging");
    snapToNearestCover();
  }

  function getProjectedCoverPolygon(card) {
    const { viewport } = getOverlayParts();
    const index = Number(card.dataset.index);
    if (!viewport || !Number.isInteger(index)) {
      return null;
    }

    const viewportStyle = getComputedStyle(viewport);
    const viewportRect = viewport.getBoundingClientRect();
    const perspectiveOrigin = viewportStyle.perspectiveOrigin.split(/\s+/).map(Number.parseFloat);
    const perspectiveDistance = Number.parseFloat(viewportStyle.perspective);
    const originX = card.offsetWidth / 2;
    const originY = card.offsetHeight / 2;
    const perspectiveX = viewportRect.left
      + (Number.isFinite(perspectiveOrigin[0]) ? perspectiveOrigin[0] : viewportRect.width / 2);
    const perspectiveY = viewportRect.top
      + (Number.isFinite(perspectiveOrigin[1]) ? perspectiveOrigin[1] : viewportRect.height / 2);

    if (!Number.isFinite(perspectiveDistance) || perspectiveDistance <= 0) {
      return null;
    }

    const layout = core.getCoverLayout(index, selectedPosition);
    const angle = layout.rotateY * (Math.PI / 180);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const translateX = ((layout.translateXPercent / 100) - 0.5) * card.offsetWidth;
    const translateY = -0.5 * card.offsetHeight;

    return [
      [0, 0],
      [card.offsetWidth, 0],
      [card.offsetWidth, card.offsetHeight],
      [0, card.offsetHeight]
    ].map(([x, y]) => {
      const relativeX = (x - originX) * layout.scale;
      const relativeY = (y - originY) * layout.scale;
      const transformedX = translateX + (relativeX * cosine);
      const transformedY = translateY + relativeY;
      const transformedZ = layout.translateZ - (relativeX * sine);
      const worldX = viewportRect.left + card.offsetLeft + originX + transformedX;
      const worldY = viewportRect.top + card.offsetTop + originY + transformedY;
      const perspectiveScale = perspectiveDistance / (perspectiveDistance - transformedZ);

      return {
        x: perspectiveX + ((worldX - perspectiveX) * perspectiveScale),
        y: perspectiveY + ((worldY - perspectiveY) * perspectiveScale)
      };
    });
  }

  function findCoverAtPoint(clientX, clientY) {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      return null;
    }

    let frontCard = null;
    let frontZIndex = Number.NEGATIVE_INFINITY;

    for (const card of coverCards.values()) {
      if (card.style.pointerEvents === "none") {
        continue;
      }

      const polygon = getProjectedCoverPolygon(card);
      if (!polygon || !core.isPointInPolygon({ x: clientX, y: clientY }, polygon)) {
        continue;
      }

      const zIndex = core.getCoverLayout(Number(card.dataset.index), selectedPosition).zIndex;
      if (zIndex > frontZIndex) {
        frontCard = card;
        frontZIndex = zIndex;
      }
    }

    return frontCard;
  }

  function handleCoverClick(event) {
    if (suppressClick) {
      suppressClick = false;
      event.preventDefault();
      return;
    }

    const pathCard = event.composedPath().find((target) => (
        target instanceof Element && target.classList.contains("cover-card")
      ));
    const card = event.isTrusted
      ? findCoverAtPoint(event.clientX, event.clientY)
      : pathCard || findCoverAtPoint(event.clientX, event.clientY);
    if (!card) {
      return;
    }

    const index = Number(card.dataset.index);
    if (!Number.isInteger(index)) {
      return;
    }

    animateToIndex(index);
  }

  function handleWheel(event) {
    if (!isOpen || queueSnapshot.items.length === 0) {
      return;
    }

    event.preventDefault();
    cancelAnimation();
    clearTimeout(wheelTimer);
    setSelectedPosition(core.positionFromWheel(
      selectedPosition,
      event.deltaX,
      event.deltaY,
      WHEEL_PIXELS_PER_ITEM,
      queueSnapshot.items.length
    ));
    wheelTimer = window.setTimeout(snapToNearestCover, 110);
  }

  function updateOverlayInset() {
    const host = getOverlayHost();
    const height = playerBar?.getBoundingClientRect().height || PLAYER_BAR_MIN_HEIGHT;
    host.style.bottom = `${Math.max(PLAYER_BAR_MIN_HEIGHT, Math.round(height))}px`;
  }

  function setOpen(requested) {
    isOpen = core.nextVisibility(isOpen, requested);

    const host = getOverlayHost();
    if (overlayFadeFrame) {
      cancelAnimationFrame(overlayFadeFrame);
      overlayFadeFrame = 0;
    }
    host.hidden = !isOpen;
    host.style.display = isOpen ? "block" : "none";
    host.style.pointerEvents = isOpen ? "auto" : "none";
    host.dataset.visible = "false";
    getButton()?.setAttribute("aria-pressed", String(isOpen));
    playerBar?.classList.toggle(PLAYER_BAR_ACTIVE_CLASS, isOpen);
    setNativeQueueVisibility(isOpen);

    if (isOpen) {
      queueSnapshot = captureQueueSnapshot();
      renderQueueShellState();
      updateOverlayInset();
      bindQueueObserver();
      startCurrentTrackSync();
      overlayFadeFrame = requestAnimationFrame(() => {
        overlayFadeFrame = 0;
        if (isOpen) {
          host.dataset.visible = "true";
        }
      });
      getOverlayParts().viewport?.focus({ preventScroll: true });
    } else {
      cancelAnimation();
      stopCurrentTrackSync();
      if (syncFrame) {
        cancelAnimationFrame(syncFrame);
        syncFrame = 0;
      }
      clearTimeout(wheelTimer);
      clearTimeout(infoTimer);
      pointerState = null;
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
    playerBar?.classList.remove(PLAYER_BAR_ACTIVE_CLASS);
    playerBar = nextPlayerBar;
    playerBar.classList.toggle(PLAYER_BAR_ACTIVE_CLASS, isOpen);
    playerBarObserver = new MutationObserver(schedulePlayerButtonCheck);
    playerBarObserver.observe(playerBar, { childList: true, subtree: true });
  }

  function bindQueueObserver() {
    const root = getNativeQueue();
    if (!root || root === observedQueueContents) {
      return;
    }

    queueObserver?.disconnect();
    queueObserver = new MutationObserver(scheduleCurrentTrackSync);
    queueObserver.observe(root, {
      attributes: true,
      attributeFilter: ["play-button-state", "selected"],
      childList: true,
      subtree: true
    });
    observedQueueContents = root;
    setNativeQueueVisibility(isOpen);
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

  function isEditableTarget(target) {
    return target instanceof Element
      && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
  }

  function handleKeydown(event) {
    if (!isOpen) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (isEditableTarget(event.target)) {
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      moveSelection(event.key === "ArrowLeft" ? -1 : 1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      playSelectedTrack();
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
  bindQueueObserver();
})();
