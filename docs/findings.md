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

## 2026-08-14：目前播放狀態應以 MAIN world bridge 為準

條件：擴充套件覆蓋層開啟時，從原生播放器切換「上一首」或「下一首」。

現象：頁面 DOM 中新 row 的 `selected` 與 `play-button-state` 會正確變更，但 isolated content script 對既有 Polymer row 讀到的資料可能滯後，跨世界 `MutationObserver` 也不能作為唯一觸發來源。

結論：覆蓋層開啟時以短週期讀取 MAIN world queue bridge 回傳的 `isCurrent`，再將對應的既有快照卡片置中；MutationObserver 僅作為加速同步，不能決定目前播放曲目。

## 2026-08-14：拖曳層的 pointer capture 會攔截內層按鈕

條件：中央卡片 hover 後，以實際滑鼠指標點擊內層圓形播放按鈕。

現象：viewport 的 `pointerdown` 會立即取得 pointer capture，後續 click 被重新導向拖曳層；程式直接呼叫按鈕 `.click()` 不會經過 pointer 流程，因此會產生錯誤的通過結果。

結論：播放按鈕必須在 `pointerdown` 停止冒泡，避免 viewport 取得 capture，並保留自己的 click handler。播放按鈕驗證必須使用實際指標 hover 與點擊，不能只用程式化 `.click()`。

## 2026-08-14：3D 透視封面的 click target 不可靠

條件：Carousel viewport 在每次 `pointerdown` 時立即取得 pointer capture，使用者直接點擊中央以外的封面，沒有進行拖曳。

現象：延後 pointer capture 後，使用者仍可穩定重現側邊封面點擊無反應。BrowserOS Neo 的實體座標事件紀錄顯示，`pointerdown`、`pointerup` 與 `click` 均有抵達 viewport，但 Chrome 將旋轉後封面的可見位置命中為 `.flow` 背景，事件路徑裡沒有 `.cover-card`。

結論：viewport 仍只在移動距離超過拖曳門檻、確定開始拖曳時取得 pointer capture。實體點擊不得依賴 `event.target` 或 `event.composedPath()` 決定 Cover；應由 Carousel 自己的位移、旋轉、縮放、深度與 perspective 計算投影後的可見四邊形。

## 2026-08-15：3D Cover 的矩形外框會讓重疊區誤選後方項目

條件：改以 click 座標與 `getBoundingClientRect()` 判定側邊 Cover 後，點擊多張旋轉封面矩形外框的重疊區。

現象：基本側邊點擊已能置中，但矩形包含旋轉後梯形以外的空白區，依中心距離選取時容易跳到視覺上位於後方的 Cover。

結論：使用連續 `selectedPosition` 與 `getCoverLayout()` 的 transform 參數直接投影 Cover 四角，以 point-in-polygon 判斷真正命中項目；多個四邊形重疊時選擇 z-index 最高者。實體指標沒有命中任何四邊形時保持原選取，不退回 Chrome 的 3D target。BrowserOS Neo 固定播放器為暫停後，左右重疊區與外緣四種座標測試均選到預期索引。

## 2026-08-15：播放列按鈕事件會冒泡至原生佇列切換器

條件：將 Carousel 按鈕插入 YouTube Music 播放列的音量控制左側，點擊或以鍵盤啟動按鈕。

現象：原生播放列的祖層也監聽指標與鍵盤事件，未隔離時會在切換 Carousel 的同時開關原生播放佇列；Carousel 開啟期間，文件層的 `Enter` 處理亦可能把按鈕啟動誤判為播放中央曲目。

結論：按鈕必須攔截指標與鍵盤的冒泡事件，click handler 也必須停止冒泡；全域 Carousel 鍵盤處理則略過焦點在播放列按鈕上的事件。BrowserOS Neo 實測滑鼠 click 與實體 `Enter` 都只切換 Carousel，原生佇列狀態維持不變。

## 2026-08-15：橡皮筋越界不應重用 Carousel 選取位置

條件：在起點或終點把超出邊界的輸入直接寫入連續選取位置，再由 `getCoverLayout()` 渲染回彈。

現象：終點往後的回彈可見，但使用者手動驗證起點往前的滾輪與鍵盤動畫卡頓且不明顯。越界分數會讓每張卡片重新計算旋轉、深度與層級，橡皮筋回彈同時改變整套 3D 佈局，而不只是內容位移。

結論：合法選取位置、未限制輸入位置與橡皮筋位移必須分離。卡片保持合法索引的既有 3D 佈局，只對 `.flow` 套用對稱水平位移與 spring 回正。BrowserOS Neo 在 21 首佇列兩端量得 `+158px` 與 `-158px` 對稱峰值，單曲佇列也能雙向位移後回到 0。

## 2026-08-15：固定像素 Overscroll 在小視窗會顯得過遠

條件：封面尺寸使用 `min(30vw, 40vh, 360px)` 響應式縮小，但橡皮筋最大位移仍使用固定像素。

現象：視窗縮小時位移像素沒有變少，相對於封面寬度的比例會快速增加，視覺上像是拉伸距離變得更遠。

結論：滾輪、拖曳與鍵盤的最大位移應依同一套封面尺寸公式縮放，桌面尺寸保留固定上限；以純數值計算 viewport 對應的封面尺寸，避免在連續輸入期間讀取 DOM layout。

## 2026-08-15：seekbar 跨出播放器列邊界時會露出頁面

條件：Carousel host 的底邊依原生 `ytmusic-player-bar` 高度內縮，播放器列與 seekbar 為保持可操作而提高到 Carousel 之上；在特定視窗高度與播放器列布局下檢視畫面底部。

現象：Carousel 舞台與播放器實色控制列之間會出現一條透明區帶，露出後方頁面縮圖。替播放器列根節點設定黑色背景後，使用者提供五張截圖確認問題仍存在。BrowserOS Neo 實測 host 底邊與播放器列頂邊皆為 922px，但 32px 高的 seekbar 從 907px 延伸至 939px，跨過兩者邊界；在部分響應式布局下，其透明合成區會顯示 host 範圍外的頁面內容。

後續現象：把黑色 host 擴張到完整 viewport 後，部分視窗尺寸的 YouTube Music stacking context 會讓 host 蓋住整個播放器控制列，範圍過大。

結論：不可只替播放器列上色，也不可讓 host 涵蓋完整 viewport。黑色 host 的底邊應由播放器列與 seekbar 的實測矩形計算，只延伸到 seekbar 跨界區的底緣；Carousel 舞台則在 host 內回縮相同深度，維持停在播放器列頂端。這能替透明 seekbar 提供黑色 backing layer，同時不讓 host 進入其餘播放器控制列。

後續 Root Cause：在 609×882 的窄視窗中，頁面同時存在兩個可見的 `ytmusic-player-bar`。DOM 第一個是 `ytmusic-player-page` 內、位於頂端的 `#top-player-bar`，高 64px且 progress bar 隱藏；第二個才是固定於 viewport 底部的 64px 播放器列，其 31px seekbar 跨過播放列頂緣。直接使用 `querySelector()` 會量到頂端列，造成黑色 backing 的底部邊界錯誤；若選對底部列後仍強制使用桌面版 72px 最小高度，也會讓 backing 與實際 64px 播放器列相差 8px。

修正原則：先由所有可見播放器列候選中，選擇底緣最接近 viewport 底部者，讓按鈕與 Carousel 版面都以實際底部列為範圍。版面採用該列的實測高度，只有完全找不到有效矩形時才使用 fallback；按鈕 anchor 則與版面測量邏輯分離，依序選擇可見音量控制、mobile controls 或 desktop controls。不得依賴 DOM 順序、固定高度或單一 selector 的第一筆結果。

按鈕 RWD 現象：原本注入流程只尋找 `#right-controls #volume-slider`。YouTube Music 切換 compact 播放列時，音量控制會成為 0×0 且 `display: none`，改顯示 `#right-controls-mweb`；若原生重繪同時移除舊按鈕，流程因找不到可用音量 anchor 提前結束，按鈕不會自行恢復。修正後 resize 與播放器列子樹變更都會重新選擇可見 anchor，並重掛同一個按鈕。

600px 現象：`ytmusic-app-layout` 進入 `player-ui-state="PLAYER_PAGE_OPEN"` 後，底部播放器列會被 YouTube Music 寫入 inline `visibility: hidden`，頂端 `#top-player-bar` 也進入 opacity 0／hidden；底部露出 mobile player page 的「即將播放／歌詞／留言／相關內容」分頁列。Cover Flow 按鈕仍連線且已位於 `#right-controls-mweb`，只是隨整個播放器列隱藏。

600px 後續：若候選過濾把 `visibility: hidden` 視為節點不存在，原生自動隱藏後會將 `layoutPlayerBar` 清為 `null`，使 active class 無法套用，host 也退回桌面版 fallback inset；此時看起來像 seekbar 被 Cover Flow 遮住。播放器列與 control anchor 應只排除 `display: none` 或沒有尺寸的候選，保留具有 layout 但 visibility 暫時 hidden 的底部列。

600px 結論：此狀態不是按鈕注入失敗。Cover Flow 開啟期間，active 底部播放器列必須以 `!important` 暫時維持 `visibility: visible` 與 `opacity: 1`；BrowserOS Neo 即時套用後，64px 播放列、mobile controls 與按鈕穩定顯示，按鈕命中正常，mobile tabs 不再露出。關閉時移除 active class，還原原生自動隱藏。
