# 開發進度

本文件是跨討論串的精簡交接入口。接手者應先讀 [`README.md`](./README.md) 與本文件，再依工作需要讀取規格、開發指南、規則與 findings。每次開發結束前更新「目前狀態」並新增一筆紀錄，不保留冗長對話內容。

## 目前狀態

MVP 第一、二階段已由 commit `b61d299` 完成，第三階段「Cover Flow 視覺、動畫與瀏覽輸入」已由 commit `1226559` 完成。方向鍵操作時 viewport 外圍的白色 focus box 已移除，保留焦點與鍵盤行為，並納入 commit `3b569e0`。第四階段「播放整合與狀態同步」已由 commit `ec438b1` 完成。seekbar 遮擋修正已由 commit `b87e939` 完成並推送至 `origin/master`；擴充套件圖示更新已由 commit `92bd081` 完成並推送至 `origin/master`。

已核准的第三階段 DoD：呈現中央與兩側透視封面、倒影、中央曲目文字及圖片 Placeholder；支援方向鍵、滾輪、觸控板橫向輸入、拖曳與側邊封面點擊；以連續位置驅動動畫並在邊界內吸附。中央封面、Play Button、`Enter` 播放與原生播放同步仍留在下一階段。

## 最新驗證

2026-08-14：第三階段新增 Cover Flow 佈局、連續位置、可見範圍、拖曳、滾輪及可信圖片 URL 測試；`npm test` 共 16 項通過，四個 JavaScript 檔案通過 `node --check`，`git diff --check` 通過。BrowserOS Neo 已確認 33 首快照、目前曲目置中、側邊透視、中央文字、方向鍵、wheel、拖曳、側邊選取、起點／終點邊界、`Esc` 與「沒有曲目」空狀態，且瀏覽未切換播放。實站發現 isolated content script 造成前段只載入 120×120、後段透明 GIF 退回 Placeholder；MAIN world queue bridge 修正後，索引 0、20、32 與所有可見卡片均實際解碼為 544×544 且無 image failure。重新載入磁碟版本後，索引 0、20、32 的獨立倒影均有實際尺寸且畫面可見；插入非歌曲佇列節點後仍維持 33 首、前七首順序及封面對應正確。`chrome://extensions` 沒有記錄擴充套件錯誤。DevTools console 只有 YouTube 遙測與播放統計請求的 `ERR_BLOCKED_BY_CLIENT`，沒有 Cover Flow 未處理錯誤。

2026-08-14：focus box 修正後 `npm test` 共 16 項通過，`src/content-script.js` 通過 `node --check`，`git diff --check` 通過。BrowserOS Neo 實際按下右方向鍵後，選取從索引 0 移至 1，viewport 仍保有焦點；其 `::after` content 為 `none`、border 為 `0px`，畫面不再顯示外圍白框。

2026-08-14：第四階段新增中央封面懸浮播放按鈕、中央封面及 `Enter` 播放、原生 queue row 播放委派與目前播放曲目同步。`npm test` 共 17 項通過，四個 JavaScript 檔案通過 `node --check`，`git diff --check` 通過。BrowserOS Neo 已實測側邊選取「人什麼的最麻煩了」不切換播放，按 `Enter` 後原生播放器切換至該曲；修正拖曳層 pointer capture 後，以實際指標 hover 並點擊中央圓形播放按鈕，原生播放器從「懸日」切換至「人什麼的最麻煩了」；原生「下一首」從「懸日」切換到「或是一首歌」後，Carousel 中央卡片同步切換。使用者手動驗證中央播放按鈕可點擊播放。

2026-08-14：seekbar 遮擋修正改以圖層處理。Carousel 黑背景仍延伸至播放器列頂端；開啟時原生播放器列由 `z-index: 4` 暫升至 `1000`，位於 Carousel 的 `z-index: 999` 上方，使 seekbar 與 handle 正常顯示及操作，同時不露出後方頁面。BrowserOS Neo 實際拖曳 seekbar 後播放進度由 0 秒變為 2:09；關閉 Carousel 後播放器列恢復 `z-index: 4`。

2026-08-14：使用者提供的灰色標記已轉為 16、32、48、128px PNG，深灰底與標記置中。`manifest.json` 已在工具列 action 與擴充套件 icons 宣告四個尺寸；所有 PNG 尺寸與 JSON 格式驗證通過。使用者重新載入後，BrowserOS Neo 的 `chrome://extensions` 已實際顯示新圖示，擴充套件維持啟用。

## 已知限制

BrowserOS Neo 啟用內容阻擋擴充套件時，YouTube 的 `/generate_204`、`log_event`、`stats/qoe` 與 `ptracking` 請求會在 DevTools console 顯示 `ERR_BLOCKED_BY_CLIENT`；這是環境噪音，不是 Cover Flow 錯誤。

## 下一步

目前沒有已排定的下一階段。已離開 BrowserOS 瀏覽器環境，但 BrowserOS 與 BrowserOS Neo MCP 工具仍可用於實站驗證，不依賴其瀏覽器視窗或其工作區。開始下一階段前，依 `docs/rules.md` 另提 Definition of Done 並取得核准。

## 開發紀錄

### 2026-08-14

建立本交接文件並更新 `AGENTS.md` 與文件入口。使用者核准第二階段 DoD，開始實作佇列擷取與正規化。

完成 queue 直接子項目擷取、active Song／Video row 選擇、資料正規化、目前曲目辨識、最大圖片選取、Placeholder、空佇列與索引邊界。Node Unit Test 從 3 項增加到 11 項並全數通過；實站 selector 驗證通過，但因 BrowserOS 設定檔未載入擴充套件，實際注入驗收未執行。

新增遇到阻礙時的協作規則：Agent 應及時向使用者求助，附上可直接照做且包含完成確認方式的 step-by-step，並在使用者通知完成後接續驗證與工作。

補充 BrowserOS Neo 開發流程：需要安裝開發中的擴充套件或在擴充功能管理頁按下「重新整理」時，Agent 必須停下來請使用者操作，收到完成通知後才能接續實站驗證。

完成第一、二階段工作目錄的完整 diff review，未發現規格或 DoD 衝突；11 項 Unit Test、三個 JavaScript 檔案語法檢查與 diff 格式檢查通過，等待使用者核准 draft commit message。

第一、二階段以 commit `b61d299` 完成。第三階段 DoD 獲得核准後，完成 Cover Flow 封面窗口、透視排列、倒影、中央曲目文字、圖片錯誤 Placeholder、連續拖曳、滾輪／觸控板、方向鍵、側邊點擊、吸附動畫與邊界處理；16 項 Unit Test、靜態檢查、BrowserOS Neo 實站功能與 console 驗證通過，完整 diff 與 commit 草稿獲得使用者核准。

第三階段以 commit `1226559` 完成。使用者核准移除方向鍵操作時 viewport 外圍的白色 focus box；修正只移除視覺樣式，保留程式化焦點、方向鍵、`Esc` 與播放列按鈕的鍵盤焦點提示。

完成 focus box 修正的 16 項 Unit Test、靜態檢查與 BrowserOS Neo 方向鍵實站驗證；完整 diff 與 commit 草稿獲得使用者核准。

移除 `AGENTS.md` 的 BrowserOS 管理區塊。後續仍可使用 BrowserOS 與 BrowserOS Neo MCP 工具，但驗證不依賴 BrowserOS 瀏覽器視窗或其工作區。

使用者核准將所有公開名稱由 Cover Flow 改為 YouTube Music Queue Carousel；內部 `ytm-cover-flow` 識別字維持不變以避免影響既有整合。`npm test` 16 項通過，四個 JavaScript 檔案通過 `node --check`，`manifest.json` 與 `package.json` JSON 解析通過，`git diff --check` 通過。

完成第四階段：中央封面懸浮時顯示可存取的播放按鈕，中央封面、播放按鈕與 `Enter` 都委派至原生 queue 播放控制；側邊選取仍只瀏覽。覆蓋層開啟期間使用 MAIN world queue bridge 同步原生目前曲目，避免 isolated content script 讀取 Polymer row data 與跨世界 MutationObserver 更新不穩定的限制。17 項 Unit Test、靜態檢查與 BrowserOS Neo 實站播放及同步驗證通過，待使用者核准完整 diff 與 commit 草稿。

第四階段以 commit `ec438b1` 完成。完成 seekbar 遮擋修正：Carousel 黑背景維持覆蓋到播放器列頂端，開啟期間暫時提高原生播放器列圖層，讓其 seekbar 與 handle 顯示在最上層。17 項 Unit Test、靜態檢查、圖層命中測試、實際拖曳與關閉後圖層復原驗證通過，待使用者核准完整 diff 與 commit 草稿。

seekbar 遮擋修正以 commit `b87e939` 完成並推送至 `origin/master`。首次非互動式 SSH push 沒有輸出且分支仍為 ahead；改以 TTY 重試相同指令後成功，已將驗證方式整理至 `docs/rules.md` 的 Git push Lessons Learned。

使用者提供灰色標記截圖，完成四個標準擴充套件圖示尺寸與 manifest 宣告；圖示直接由原圖的標記與背景製作，不重繪圖樣。以 commit `92bd081` 完成並推送至 `origin/master`。
