# Findings

本文件用來記錄開發過程中實際遇到、可重現且有證據的陷阱與限制，讓後續開發者避免重踩。

## 2026-08-14：播放佇列包含非目前模式的 DOM 副本

條件：在 YouTube Music 播放頁開啟 `UP NEXT`，以 BrowserOS Neo 唯讀檢查 `ytmusic-player-queue`。

現象：目前直接顯示的 queue 有 11 個邏輯子項目，但對整個 queue 執行 descendant `ytmusic-player-queue-item` 查詢會得到 108 個 row。Song／Video 可切換項目由 `ytmusic-playlist-panel-video-wrapper-renderer` 包住 `#primary-renderer` 與 `#counterpart-renderer`；未啟用的 counterpart 帶有 `hidden`。本次頁面在整個 queue DOM 中共有 47 個 hidden counterpart row。

結論：快照必須從 `ytmusic-player-queue > #contents` 的直接子項目依順序擷取。遇到 wrapper 時只選未帶 `hidden` 的 primary 或 counterpart，不得掃描整個頁面或整個 queue 的所有 row，也不得用歌曲名稱去重。

## 2026-08-14：可見 img 可能仍是透明 GIF

條件：檢查 queue row 的 DOM 圖片與元件資料。

現象：row 內 `<img>` 的 `src` 與 `currentSrc` 可能仍是 1×1 `data:image/gif`，但同一 row 的 `data.thumbnail.thumbnails` 已提供 60、120、180、226、302 與 544 像素候選。

結論：優先從 row 資料中的縮圖候選選取最大尺寸，再退回 `srcset`、`currentSrc` 與 `src`；透明 GIF 不得當成有效封面。

## 2026-08-14：BrowserOS 設定檔未載入擴充套件

條件：在本次 BrowserOS Neo 設定檔檢查 `chrome://extensions`，並重新整理測試用 YouTube Music 分頁。

現象：擴充功能清單找不到「YouTube Music Queue Cover Flow」，頁面也沒有注入 `#ytm-cover-flow-button` 或 `#ytm-cover-flow-host`。

結論：本次只能完成 Unit Test 與實站 DOM selector 驗證，不能把實際擴充套件注入、工具列入口或播放列按鈕列為通過。

## 2026-08-14：isolated content script 讀不到 Polymer row data

條件：擴充套件在 BrowserOS Neo 實際注入後，開啟含 33 首曲目的 Cover Flow，檢查中央封面與後段項目。

現象：page main world 的 33 個 queue row 都有 6 個縮圖候選，最大為 544×544；isolated content script 無法讀取 YouTube Polymer 元件的 `row.data`。因此前段只能取得 DOM 已載入的 120×120 `<img>`，後段尚未 lazy-load 的 row 則只取得 1×1 透明 GIF，造成放大模糊與錯誤 Placeholder。

結論：使用 MAIN world bridge 唯讀擷取 queue row data，再以序列化事件交給 isolated content script；isolated 端只接受已知 YouTube 圖片 host。DOM fallback 中已驗證的 `yt3.googleusercontent.com`／`lh3.googleusercontent.com` 尺寸參數可安全提升至至少 544×544，不修改其他 host 的 URL。

補充：bridge 與 isolated content script 的 `sourceKey` 必須都以 `#contents.children` 的原始 DOM 位置建立。若 isolated 端先用 selector 排除非歌曲節點再編號，遇到混合節點時會與 bridge 錯位，造成封面或文字配錯曲目。實站插入一個非歌曲節點後，33 首順序、前七張 544×544 封面與標題對應均維持正確。
