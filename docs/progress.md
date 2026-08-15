# 開發進度

本文件是跨討論串的精簡交接入口。接手者應先讀 [`README.md`](./README.md) 與本文件，再依工作需要讀取規格、開發指南、規則與 findings。每次開發結束前更新「目前狀態」並新增一筆紀錄，不保留冗長對話內容。

## 目前狀態

MVP 第一、二階段已由 commit `b61d299` 完成，第三階段「Cover Flow 視覺、動畫與瀏覽輸入」已由 commit `1226559` 完成。方向鍵操作時 viewport 外圍的白色 focus box 已移除，保留焦點與鍵盤行為，並納入 commit `3b569e0`。第四階段「播放整合與狀態同步」已由 commit `ec438b1` 完成。seekbar 遮擋修正已由 commit `b87e939` 完成並推送至 `origin/master`；擴充套件圖示更新已由 commit `92bd081` 完成並推送至 `origin/master`。後續介面、播放控制與播放列入口隔離已完成，工作目錄等待完整 diff 與 commit 草稿核准。

已核准的第三階段 DoD：呈現中央與兩側透視封面、倒影、中央曲目文字及圖片 Placeholder；支援方向鍵、滾輪、觸控板橫向輸入、拖曳與側邊封面點擊；以連續位置驅動動畫並在邊界內吸附。中央封面、Play Button、`Enter` 播放與原生播放同步仍留在下一階段。

## 最新驗證

2026-08-15：播放列 Carousel 按鈕已攔截指標與鍵盤事件，並使開啟狀態下焦點留在該按鈕的 `Enter` 不觸發中央曲目播放。BrowserOS Neo 實測滑鼠 click 與實體 `Enter` 都只切換 Carousel，原生佇列由開啟狀態還原時仍保持開啟；使用者重新載入後再確認左上角 Logo 的 computed style 為 condensed、Medium 500、20px。`npm test` 共 19 項通過，四個 JavaScript 檔案通過 `node --check`，`manifest.json` JSON 解析與 `git diff --check` 通過。

2026-08-15：橡皮筋回彈以未限制輸入位置與阻尼後視覺位置分離實作。BrowserOS Neo 實測多曲佇列起點與單曲佇列的左方向鍵、滾輪向外，都產生非中央 transform frame 後回到中央；佇列索引與原生目前曲目維持不變。`drag_at` 沒有送出按住狀態的 pointer event，實體拖曳仍待使用者手動確認。`npm test` 共 20 項通過。

2026-08-15：使用者手動驗證發現起點向前的滾輪與鍵盤回彈卡頓且不明顯，終點方向則正常，並要求提高拉伸幅度。修正改為保持卡片合法索引與既有 3D 佈局，只對整個封面舞台套用對稱的水平橡皮筋位移；最大拉伸提高，鍵盤使用獨立的 56px 短回彈。重新載入後，BrowserOS Neo 在 21 首佇列以鍵盤與滾輪量得起點 `+158px`、終點 `-158px` 峰值，皆回到 0；單曲佇列雙向亦量得相同峰值並回到 0。選取與原生目前曲目沒有改變。

2026-08-15：使用者手動確認對稱回彈效果通過，並持續微調頂峰停留與鍵盤速度。滾輪結束 debounce 最終由 110ms 降為 50ms；鍵盤 spring 再降低 stiffness 與 damping，動畫上限延長至 1000ms。另完成縮放 Spike：建議依橡皮筋位移比例讓 `.flow` 最多縮小 3.5%，與水平位移共用同一 spring 回到 1；實作時需同步修正投影點擊命中的全域 scale。

2026-08-15：側邊 Cover 點擊精度改為依 Carousel transform 參數計算投影四邊形，取代互相重疊的矩形外框與 Chrome 3D target；新增 point-in-polygon Unit Test，`npm test` 共 19 項通過。BrowserOS Neo 先將原生播放器固定為暫停、中央索引固定為 12，再以實體座標驗證右側重疊區選到前方索引 13、右側外緣選到索引 14、左側重疊區選到前方索引 11、左側外緣選到索引 9。原生曲目全程維持 `Smile in your face` 且保持暫停，瀏覽沒有觸發播放。

2026-08-14：播放控制與開啟體驗優化後，`npm test` 共 18 項通過，四個 JavaScript 檔案通過 `node --check`，`manifest.json` JSON 解析與 `git diff --check` 通過。BrowserOS Neo 重新載入擴充套件後，實際確認左上角單色 YouTube Music Logo、Carousel 黑色舞台、原生播放佇列在開啟時為 `display: none`、關閉後顯示還原。中央播放控制在原生歌曲播放後由「播放」變為「暫停」，點擊後原生播放器同步變為暫停且控制回到「播放」。使用者兩次手動驗證發現側邊封面點擊無法置中；事件紀錄確認 Chrome 將 3D 旋轉封面的可見位置命中為 `.flow` 背景。改以 click 座標與可見 Cover 實際範圍判定後，BrowserOS Neo 重新整理頁面並以實體座標點擊右側 `お化けひまわり`，中央索引從 12 移至 13；再點擊左側 `Smile in your face`，索引從 13 回到 12。原生播放器全程維持 `Smile in your face`，沒有因瀏覽切歌。Hover 按鈕維持深色背景；點擊後 `is-activated` 狀態的 transform 實際進入縮放中間值，再回彈至原尺寸。

2026-08-14：第三階段新增 Cover Flow 佈局、連續位置、可見範圍、拖曳、滾輪及可信圖片 URL 測試；`npm test` 共 16 項通過，四個 JavaScript 檔案通過 `node --check`，`git diff --check` 通過。BrowserOS Neo 已確認 33 首快照、目前曲目置中、側邊透視、中央文字、方向鍵、wheel、拖曳、側邊選取、起點／終點邊界、`Esc` 與「沒有曲目」空狀態，且瀏覽未切換播放。實站發現 isolated content script 造成前段只載入 120×120、後段透明 GIF 退回 Placeholder；MAIN world queue bridge 修正後，索引 0、20、32 與所有可見卡片均實際解碼為 544×544 且無 image failure。重新載入磁碟版本後，索引 0、20、32 的獨立倒影均有實際尺寸且畫面可見；插入非歌曲佇列節點後仍維持 33 首、前七首順序及封面對應正確。`chrome://extensions` 沒有記錄擴充套件錯誤。DevTools console 只有 YouTube 遙測與播放統計請求的 `ERR_BLOCKED_BY_CLIENT`，沒有 Cover Flow 未處理錯誤。

2026-08-14：focus box 修正後 `npm test` 共 16 項通過，`src/content-script.js` 通過 `node --check`，`git diff --check` 通過。BrowserOS Neo 實際按下右方向鍵後，選取從索引 0 移至 1，viewport 仍保有焦點；其 `::after` content 為 `none`、border 為 `0px`，畫面不再顯示外圍白框。

2026-08-14：第四階段新增中央封面懸浮播放按鈕、中央封面及 `Enter` 播放、原生 queue row 播放委派與目前播放曲目同步。`npm test` 共 17 項通過，四個 JavaScript 檔案通過 `node --check`，`git diff --check` 通過。BrowserOS Neo 已實測側邊選取「人什麼的最麻煩了」不切換播放，按 `Enter` 後原生播放器切換至該曲；修正拖曳層 pointer capture 後，以實際指標 hover 並點擊中央圓形播放按鈕，原生播放器從「懸日」切換至「人什麼的最麻煩了」；原生「下一首」從「懸日」切換到「或是一首歌」後，Carousel 中央卡片同步切換。使用者手動驗證中央播放按鈕可點擊播放。

2026-08-14：seekbar 遮擋修正改以圖層處理。Carousel 黑背景仍延伸至播放器列頂端；開啟時原生播放器列由 `z-index: 4` 暫升至 `1000`，位於 Carousel 的 `z-index: 999` 上方，使 seekbar 與 handle 正常顯示及操作，同時不露出後方頁面。BrowserOS Neo 實際拖曳 seekbar 後播放進度由 0 秒變為 2:09；關閉 Carousel 後播放器列恢復 `z-index: 4`。

2026-08-14：使用者提供的灰色標記已轉為 16、32、48、128px PNG，深灰底與標記置中。`manifest.json` 已在工具列 action 與擴充套件 icons 宣告四個尺寸；所有 PNG 尺寸與 JSON 格式驗證通過。使用者重新載入後，BrowserOS Neo 的 `chrome://extensions` 已實際顯示新圖示，擴充套件維持啟用。

## 已知限制

BrowserOS Neo 啟用內容阻擋擴充套件時，YouTube 的 `/generate_204`、`log_event`、`stats/qoe` 與 `ptracking` 請求會在 DevTools console 顯示 `ERR_BLOCKED_BY_CLIENT`；這是環境噪音，不是 Cover Flow 錯誤。

## 下一步

已確認以 `Ray Yuan Liu` 為權利人，採用 PolyForm Noncommercial 1.0.0 source-available 授權；等待 diff 檢查與 commit 草稿核准。

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

使用者核准播放控制與開啟體驗優化 DoD。完成目前播放曲目的暫停圖示與原生暫停委派、點擊後縮小回彈、任一封面僅置中、原生播放佇列開啟時隱藏與關閉後還原、快速淡入，以及左上角單色 YouTube Music Logo；同步更新產品規格。使用者回報側邊封面點擊失敗與 Hover 紅色過強後，移除紅色 Hover，並依實體事件紀錄修正 viewport pointer capture 與 3D Cover 命中判定。18 項 Unit Test、靜態檢查與 BrowserOS Neo 實站驗證結果已記於「最新驗證」，等待完整 diff 與 commit 草稿核准。

### 2026-08-15

使用者確認以 `Ray Yuan Liu` 為權利人，改採 PolyForm Noncommercial 1.0.0。根目錄 `LICENSE` 已包含官方完整條文與 `Required Notice: Copyright © 2026 Ray Yuan Liu`；這是允許非商業使用、修改與散布的 source-available 授權，不是 OSI 開源授權。未修改程式碼或產品規格，等待 diff 檢查與 commit 草稿核准。

使用者核准 1.0 版號、英文 UI 文字與空佇列入口規則。`manifest.json` 與 `package.json` 版號已由 `0.1.0` 升為 `1.0.0`；播放列按鈕、Carousel 可存取名稱、播放／暫停、封面選取、Unknown track 與 No tracks available 均改為英文。空佇列時，播放列按鈕隱藏且工具列 action 不建立 Carousel；佇列 DOM 再次出現歌曲時按鈕會自動恢復，若開啟期間佇列變空則關閉 Carousel。新增純函式回歸測試；25 項 Unit Test、四個 JavaScript 語法、manifest／package JSON 與 `git diff --check` 通過。使用者重新載入後，BrowserOS Neo 實測 21 首佇列時播放列按鈕顯示英文名稱且可開啟 Carousel，對話框、封面選取與播放按鈕的可存取文字均為英文；在代理驗證分頁暫時清空佇列 DOM 後，按鈕立即 hidden、已開啟的 Carousel 關閉，重新載入後曲目與按鈕皆恢復。BrowserOS Neo 無法直接操作瀏覽器外框的工具列圖示，但其 message handler 與播放列入口共用相同的空佇列 guard。

使用者回報側邊 Cover 的矩形命中在邊緣容易選到後方項目。改以 Carousel transform 參數投影可見四邊形，重疊區依 z-index 選擇前方 Cover，實體點擊不再退回 Chrome 的 3D target。19 項 Unit Test、左右重疊區與外緣實站驗證通過，等待完整 diff 與 commit 草稿核准。

使用者要求將 YouTube Music「自動加入」相似歌曲的動態佇列同步列為未來強化。`spec.md` 已新增 FE-001 與 FE-002，現行 MVP 的固定快照行為不變。

使用者核准播放列按鈕隔離與 condensed Logo DoD。播放列按鈕現會攔截指標與鍵盤事件，click 只切換 Carousel；Carousel 開啟時，焦點位於該按鈕的 `Enter` 不會再誤觸中央曲目播放。Logo 改為 condensed、Medium 500、20px 字體風格。19 項 Unit Test、靜態檢查、JSON 解析、diff 檢查與 BrowserOS Neo 的滑鼠／鍵盤實站驗證通過，等待完整 diff 與 commit 草稿核准。

使用者核准橡皮筋回彈 DoD。拖曳與滾輪在起點／終點提供有限的阻尼視覺越界，單曲也能雙向回彈；鍵盤在邊界再往外時以較小、較短的 spring 回彈，減少動態效果時直接停在邊界。20 項 Unit Test 與 BrowserOS Neo 的鍵盤／滾輪實站驗證通過；實體拖曳驗證待使用者手動確認。

使用者手動驗證指出初版在起點向前的滾輪與鍵盤回彈卡頓且不明顯，終點方向正常。改以整體舞台水平位移取代越界分數索引，避免邊界外重新計算卡片旋轉、深度與層級；同時提高最大拉伸並將鍵盤回彈設為 56px。BrowserOS Neo 已確認多曲佇列兩端與單曲雙向的位移峰值對稱、皆能回正且不改變播放；等待使用者再次手動確認手感。

使用者手動確認第二版回彈效果通過。依兩次後續微調，滾輪結束 debounce 最終縮短為 50ms，鍵盤回彈降低至 stiffness 180、damping 16 並延長至最多 1000ms。縮放 Spike 建議只縮放 `.flow` 內的封面與倒影，最大約 3.5%，Logo 與曲目文字保持固定；尚未實作。

使用者希望兩端能再往外拉一些。桌面 360px 封面下，滾輪與拖曳的最大視覺拉伸由約 158px 提高至約 198px，鍵盤邊界回彈由 56px 提高至 72px；較小視窗則改依封面尺寸縮放為約 55% 與 20%，避免固定像素造成相對位移過大。上一輪確認的 50ms 滾輪結束等待與鍵盤回彈速度維持不變。重新載入後，BrowserOS Neo 實測起點與終點分別為 `+198px`／`-198px`，鍵盤為 `+72px`／`-72px`，皆保持邊界索引並回到 0；使用者手動確認小視窗比例手感通過。

使用者核准垂直縮小視窗版面修正 DoD。覆蓋層高度小於等於 620px 時，單色 YouTube Music Logo 保留圖示並隱藏文字，中央播放控制改為覆蓋整張封面；Shadow host 也提供黑色裁切背景，避免後方頁面從舞台邊緣露出。等待重新載入後手動驗證。

重新載入後，BrowserOS Neo 確認 Shadow host 與舞台的計算背景皆為 `rgb(0, 0, 0)`，host 為 `overflow: hidden`；正常高度播放控制仍為 76px 圓形，小高度 Logo 隱藏與全封面控制規則已載入。BrowserOS Neo 無法調整測試視窗高度，等待使用者手動縮小視窗驗證視覺效果。

使用者提供四張截圖，確認小高度 Logo 與全封面播放控制通過，但 Carousel 舞台與播放器實色控制列之間有透明區帶露出頁面內容。初步在 active 播放器列補上黑色背景，重新載入後仍失敗。

使用者再提供五張失敗截圖。BrowserOS Neo 量得 host 底邊與播放器列頂邊同為 922px，但 seekbar 從 907px 延伸到 939px，跨過兩者邊界。修正改為讓黑色 host 涵蓋完整 viewport，舞台則透過 CSS custom property 依播放器列高度內縮；播放器列維持較高 z-index，等待重新載入後驗證透明區帶、seekbar 操作與 Carousel 佈局。

使用者回報全 viewport host 用力過猛，部分尺寸會把播放器列整列覆蓋。修正收斂為依播放器列與 seekbar 的矩形動態計算 backing 深度：host 只延伸至 seekbar 底緣，舞台在 host 內回縮相同深度並維持停在播放器列頂端。等待自動測試與重新載入後手動驗證。

重新載入後，21 項 Unit Test、`src/content-script.js` 語法、manifest JSON 與 `git diff --check` 通過。BrowserOS Neo 在 1372×765 viewport 實測播放器列為 72px、seekbar 跨入播放器列 17px；host 底邊與 seekbar 底緣同為 710px，舞台底邊與播放器列頂緣同為 693px。播放與 Cover Flow 按鈕仍為最上層命中目標，畫面沒有漏出後方內容；等待使用者手動調整不同視窗尺寸驗證。

使用者在 BrowserOS Neo 窄視窗指出播放佇列版面不同。609×882 viewport 唯讀確認頁面同時存在頂端 `#top-player-bar` 與底部播放器列；前者 progress bar 隱藏，後者高 64px，其 31px seekbar 從 803.5px 延伸到 834.5px。修正將按鈕掛載與版面測量分離，依 viewport 底緣選擇可見播放器列，並在有實測值時不再強制桌面版 72px 高度；新增候選選擇與桌面／窄版 inset 回歸測試。23 項 Unit Test、四個 JavaScript 語法、manifest／package JSON 與 `git diff --check` 通過，等待重新載入後實站驗證。

重新載入後，使用者補充 Cover Flow 按鈕會在播放器列 RWD 變化後永久消失。BrowserOS Neo 在 desktop 版確認按鈕位於可見音量控制左側；先前 609px 窄版證據則顯示音量控制隱藏並改用 `#right-controls-mweb`。修正改為讓按鈕與版面都鎖定實際底部播放器列，並在 resize 或原生子樹重繪後依序選擇可見音量、mobile controls、desktop controls anchor，移動同一個既有按鈕。24 項 Unit Test、四個 JavaScript 語法、manifest／package JSON 與 `git diff --check` 通過。再次重新載入後，BrowserOS Neo 在 1728×996 desktop 版確認僅有一個按鈕、位於底部播放器列音量左側且可命中；host 底邊與 seekbar 底緣同為 941px，舞台底邊與播放列頂緣同為 924px。BrowserOS 不允許程式化縮放既有視窗，等待使用者手動縮到 compact 再驗證往返恢復。

使用者手動把 BrowserOS Neo 依序縮至 1103px、800px 與約 600px。1103px 的音量隱藏 desktop controls、800px 的 64px 播放列 desktop controls，按鈕皆維持單一、可命中且黑底邊界正確。600px 切換到 `#right-controls-mweb` 後，按鈕仍正確掛載，但 YouTube Music 在 `PLAYER_PAGE_OPEN` 對底部列寫入 inline `visibility: hidden`，造成整列閃現後消失並露出 mobile tabs。BrowserOS Neo 即時強制 active 底部列可見後，64px 播放列與按鈕穩定顯示、按鈕可命中、host 底邊 949px 對齊 seekbar 底緣 948.5px、舞台底邊 932px 對齊播放列頂緣。已將 active 可見性規則正式加入；24 項 Unit Test、四個 JavaScript 語法、manifest／package JSON 與 `git diff --check` 通過，等待重新載入驗證磁碟版本。

重新載入後，使用者目測 seekbar 邊界被遮住。BrowserOS Neo 確認磁碟版在原生 auto-hide 後把 visibility hidden 的底部列排除，`layoutPlayerBar` 變成 `null`，host 使用 72／16px fallback 且 active class 未套用。修正候選規則為保留具有 display 與尺寸的 hidden 節點，讓底部列可被 active class 恢復，並同步修正 mobile control anchor 判定。24 項 Unit Test、四個 JavaScript 語法、manifest／package JSON 與 `git diff --check` 通過，等待重新載入驗證。

再次重新載入後，BrowserOS Neo 在 615×996 viewport 驗證磁碟版本：底部列即使仍帶有 YouTube Music 的 inline `visibility: hidden`，計算樣式已由 active 規則恢復為 visible；底部列高 64px、頂緣 932px，舞台底緣同為 932px。seekbar 的 1px 軌道位於 932.5–933.5px，完整落在播放器列內；host 底緣 949px 對齊 seekbar 31px hit area 的 948.5px，且播放器列 z-index 1000 高於 host 999。截圖與逐點堆疊檢查均未發現 Cover Flow 遮住 seekbar 或播放器列，等待使用者手動確認。

使用者手動回報最終窄版畫面 Pass，可進入 commit 草稿核准流程。
