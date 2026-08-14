# 開發進度

本文件是跨討論串的精簡交接入口。接手者應先讀 [`README.md`](./README.md) 與本文件，再依工作需要讀取規格、開發指南、規則與 findings。每次開發結束前更新「目前狀態」並新增一筆紀錄，不保留冗長對話內容。

## 目前狀態

MVP 第一、二階段已由 commit `b61d299` 完成。第三階段「Cover Flow 視覺、動畫與瀏覽輸入」已完成實作、自動化檢查、BrowserOS Neo 實站驗證與 commit review，納入本次 commit。

已核准的第三階段 DoD：呈現中央與兩側透視封面、倒影、中央曲目文字及圖片 Placeholder；支援方向鍵、滾輪、觸控板橫向輸入、拖曳與側邊封面點擊；以連續位置驅動動畫並在邊界內吸附。中央封面、Play Button、`Enter` 播放與原生播放同步仍留在下一階段。

## 最新驗證

2026-08-14：第三階段新增 Cover Flow 佈局、連續位置、可見範圍、拖曳、滾輪及可信圖片 URL 測試；`npm test` 共 16 項通過，四個 JavaScript 檔案通過 `node --check`，`git diff --check` 通過。BrowserOS Neo 已確認 33 首快照、目前曲目置中、側邊透視、中央文字、方向鍵、wheel、拖曳、側邊選取、起點／終點邊界、`Esc` 與「沒有曲目」空狀態，且瀏覽未切換播放。實站發現 isolated content script 造成前段只載入 120×120、後段透明 GIF 退回 Placeholder；MAIN world queue bridge 修正後，索引 0、20、32 與所有可見卡片均實際解碼為 544×544 且無 image failure。重新載入磁碟版本後，索引 0、20、32 的獨立倒影均有實際尺寸且畫面可見；插入非歌曲佇列節點後仍維持 33 首、前七首順序及封面對應正確。`chrome://extensions` 沒有記錄擴充套件錯誤。DevTools console 只有 YouTube 遙測與播放統計請求的 `ERR_BLOCKED_BY_CLIENT`，沒有 Cover Flow 未處理錯誤。

## 已知限制

BrowserOS Neo 啟用內容阻擋擴充套件時，YouTube 的 `/generate_204`、`log_event`、`stats/qoe` 與 `ptracking` 請求會在 DevTools console 顯示 `ERR_BLOCKED_BY_CLIENT`；這是環境噪音，不是 Cover Flow 錯誤。

## 下一步

第三階段完成。開始下一階段前，依 `docs/rules.md` 另提 Definition of Done 並取得核准。

## 開發紀錄

### 2026-08-14

建立本交接文件並更新 `AGENTS.md` 與文件入口。使用者核准第二階段 DoD，開始實作佇列擷取與正規化。

完成 queue 直接子項目擷取、active Song／Video row 選擇、資料正規化、目前曲目辨識、最大圖片選取、Placeholder、空佇列與索引邊界。Node Unit Test 從 3 項增加到 11 項並全數通過；實站 selector 驗證通過，但因 BrowserOS 設定檔未載入擴充套件，實際注入驗收未執行。

新增遇到阻礙時的協作規則：Agent 應及時向使用者求助，附上可直接照做且包含完成確認方式的 step-by-step，並在使用者通知完成後接續驗證與工作。

補充 BrowserOS Neo 開發流程：需要安裝開發中的擴充套件或在擴充功能管理頁按下「重新整理」時，Agent 必須停下來請使用者操作，收到完成通知後才能接續實站驗證。

完成第一、二階段工作目錄的完整 diff review，未發現規格或 DoD 衝突；11 項 Unit Test、三個 JavaScript 檔案語法檢查與 diff 格式檢查通過，等待使用者核准 draft commit message。

第一、二階段以 commit `b61d299` 完成。第三階段 DoD 獲得核准後，完成 Cover Flow 封面窗口、透視排列、倒影、中央曲目文字、圖片錯誤 Placeholder、連續拖曳、滾輪／觸控板、方向鍵、側邊點擊、吸附動畫與邊界處理；16 項 Unit Test、靜態檢查、BrowserOS Neo 實站功能與 console 驗證通過，完整 diff 與 commit 草稿獲得使用者核准。
