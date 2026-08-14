# Rules

本文件記錄使用者已確認的開發流程，以及從實作、測試與除錯中驗證過的 Lessons Learned。所有新進 Agent 在開始工作前都必須閱讀本文件。

## 規格與 Definition of Done

任何實作都必須以 [`spec.md`](./spec.md) 為產品行為基準。開始一個尚未取得核准的功能階段前，先提出可驗收的 Definition of Done，等待使用者確認後才修改程式碼。若實作需要改變已確認的產品行為，先停止並更新規格，不得讓程式碼默默偏離。

## 小步驟開發

開發必須拆成單一責任、容易 review 與回復的小階段。不要把擴充套件骨架、資料擷取、動畫 UI、播放整合與實站修正塞進同一個大型 commit。

目前規劃的 MVP 階段是：文件基準；Manifest V3 骨架、工具列訊息與播放列按鈕；佇列擷取、正規化與 Unit Test；Cover Flow 視覺、動畫與輸入；播放整合、狀態同步、BrowserOS 實站驗證與文件更新。實際開發若發現更自然的切分點，可以再拆小，不可任意合併成更大的階段。

每個階段依「實作、執行 Unit Test、以 BrowserOS Neo 或適合的工具驗證、更新相關文件、報告結果」進行。驗證失敗或尚未執行的項目必須明確標示，不得當成通過。

## 遇到阻礙時的協作方式

Agent 一旦發現工作難以繼續、不適合自行處理，或需要使用者介入排除阻礙，應立即向使用者求助，不必反覆嘗試到耗盡時間才回報。

求助時必須清楚說明目前阻礙，並提供使用者可直接照做的 step-by-step 操作。步驟應包含要前往的位置、要執行的動作，以及如何確認操作完成。最後請使用者完成後通知 Agent，再由 Agent 接續驗證與後續工作。

需要把開發中的擴充套件安裝到 BrowserOS Neo，或需要在擴充功能管理頁按下「重新整理」時，Agent 必須停下來請使用者操作，不得假設已安裝、已重新整理或自行跳過。求助內容必須依上述格式提供 step-by-step 與完成確認方式，並請使用者操作完成後通知 Agent，再繼續實站驗證。

## Commit 核准流程

完成一個階段後，先報告變更範圍與驗證結果，並提供完整 draft commit message。未取得使用者明確核准前，不得 stage 或 commit。

Draft 使用 Conventional Commit 風格，包含簡潔 subject、說明行為與驗證的 body，以及下列格式的 trailer：

```text
Assisted-by: AGENT_NAME:MODEL_VERSION [TOOL1] [TOOL2]
```

使用者核准後，只能逐檔 stage draft 所對應的檔案。Commit 前必須執行 `git diff --cached --check`、核對 `git diff --cached --name-only`，並確認沒有夾帶未核准或無關檔案。若檢查發現問題，先修正並重新檢查，不得直接 commit。

Commit 完成後，報告 commit hash、subject、實際檔案範圍與簽署驗證狀態。工作目錄中其他未追蹤或未提交檔案必須保留，不得順手納入、覆寫或刪除。

## Git push Lessons Learned

使用 SSH remote 執行 `git push` 後，不能只依工具執行結束或沒有錯誤輸出判定成功；必須再以 `git status -sb` 確認本地分支不再顯示 ahead。若非互動式 push 沒有輸出，且分支仍為 ahead，應以配置 TTY 的互動式終端重試相同的 `git push origin <branch>`。本專案最後以 TTY 執行 `git push origin master`，成功將 `b87e939` 推送至 `origin/master`。

## Findings 與 Lessons Learned

可重現的頁面陷阱、selector 失效、圖片限制、效能問題與工具限制先記錄在 [`findings.md`](./findings.md)，包含條件、現象與驗證證據。

只有證據足以支持可重複採用的做法時，才把它整理成本文件的新規則。不得把猜測或一次性的 workaround 寫成 Lessons Learned。
