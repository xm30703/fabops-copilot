# AI-assisted Development Log

這份文件記錄 AI 協助產生的實作、實際驗證與仍待完成的工程審查。自動測試結果與人工審查狀態分開記錄。

| 工作 | AI 協助 | 驗證／人工責任 |
|---|---|---|
| 系統範圍 | 整理合成製造事故情境與元件分工 | Angular 前端；.NET domain API；PostgreSQL 與 Ollama 本機推論 |
| 程式骨架 | API、Angular、Python Agent、MCP adapter | 實際通過的檢查記於 VALIDATION；人工 review 待完成 |
| 安全邊界 | allowlist、scope、核准分離、token／idempotency | 工具拒絕、live DB 核准／重放拒絕與真實 UI 核准均已驗收 |
| AI-generated tests | pytest、xUnit、Playwright、live evaluation、k6 | 看測試是否會捕捉真正錯誤；不能因測試同樣由 AI 產生就當作充分證明 |
| 文件 | README、架構、ADR、runbook、demo | 對照程式、契約與實跑行為核對文件 |
| 限制處理 | 明確標示 offline fallback 與驗證缺口 | 不把未跑的模型／CI／部署說成完成 |
| 實跑修正 | 修復 PowerShell 5.1 相容性、HTTP connection pool、OTLP trace 路徑 | 直接用 Windows PowerShell 啟停、k6 與 Jaeger API 驗收 |
| 模型品質 | 限制引用 enum、拒絕重複步驟、過濾 ranking metadata、改用 qwen2.5:7b | 早期 3b 曾產生無效引用；7b 曾反覆呼叫工具，新增 evidence-complete 收斂及回歸測試 |
| Angular 遷移 | 四個 standalone components、Router、Signals store、typed HttpClient、Reactive Forms、CLI build | 修正交接摘要為 POST 與搜尋初始值 race，新增 payload／route／review reset／錯誤恢復／文字 escaping 驗證；人工 review 待完成 |
| Git／CI/CD | Dockerfiles、GitHub Actions、部署 gate、rollback、runner 啟動腳本 | 實跑 Linux build、Windows deploy、故障自動回復與手動 rollback；修復跨平台 lockfile 與 Piscina advisory；GitHub 遠端執行需另外驗收 |
| 本機專案規劃與搬移 | 固定 source/runtime、集中 paths.ps1、每個 checkout 自己的 venv、固定 compose name | 保留 .git／keys／模型／DB；核對 development 26 tickets/11 audits、staging 13 tickets/1 audit；新路徑啟動、18 pytest、真實 AI 及 browser 驗收 |
| 初次搜尋輸入 race | native disabled host attribute 與 Reactive Forms 就緒流程 | 搬移驗收捕捉舊有偶發覆蓋輸入；新增十次立即輸入的回歸，四個 mock 與真實 browser 修正後通過 |
| GitHub CI/CD 實跑 | 私人 repo、GHCR、Windows runner、BOM 修正 | Hosted CI／images／本機部署全部通過；先以 Linux／Windows packages:read token 確認 registry 權限，再用假 token 重現 .NET Framework stdin 的 UTF-8 BOM，修正後 runner 記錄 host preamble=3 bytes 且登入成功；三個真實 AI 案例通過 |

## 工程審查狀態

自動檢查結果見 [VALIDATION](VALIDATION.md)。人工程式審查尚未完成；下列項目需以程式與測試證據核對，通過自動測試不等於已完成人工審查。

- Angular component、store 與 ApiService 的狀態責任，以及切換事故時的核准確認重設。
- Agent 工具 allowlist、scope、budget、證據完整性與故障降級的邊界。
- Domain 核准 token 的原子消耗、idempotency 與 audit transaction。
- 模型建議的語意正確性、資料時效及 prompt injection 防護。

目前的量測僅涵蓋文件列出的合成情境與本機環境；尚未量測實際業務效率提升。
