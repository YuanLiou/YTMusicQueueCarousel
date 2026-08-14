## YouTube Music Cover Flow 專案指引

開始任何規劃、實作、測試或 review 前，先完整閱讀 `docs/README.md`。該文件會引導 Agent 依工作需要讀取其餘文件。接著完整閱讀 `docs/progress.md`，先掌握目前階段、驗證狀態、已知限制與下一步，再繼續工作。

`docs/spec.md` 是產品行為的唯一規格基準。若程式碼、其他文件或臨時想法與它衝突，先停止相關修改並向使用者確認，不得自行改變產品行為。

`docs/development.md` 是技術邊界、實作策略與驗證方式。`docs/rules.md` 是本專案必須遵守的開發與 commit 流程。`docs/findings.md` 記錄開發中實際遇到的陷阱與限制。`docs/progress.md` 是跨討論串的精簡交接紀錄；每次開發結束前都要更新，且只記錄接手者恢復工作所需的事實。

BrowserOS 與 BrowserOS Neo 的 MCP 工具仍可用於網站操作與實站驗證，但不依賴 BrowserOS 的瀏覽器視窗或其工作區。使用目前 Codex 環境提供的 MCP 工具即可。
