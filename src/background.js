importScripts("core.js");

const core = globalThis.YtmCoverFlowCore;

chrome.action.onClicked.addListener((tab) => {
  if (!tab.id || !core.isYouTubeMusicUrl(tab.url)) {
    return;
  }

  chrome.tabs.sendMessage(tab.id, core.createToggleMessage(), () => {
    void chrome.runtime.lastError;
  });
});
