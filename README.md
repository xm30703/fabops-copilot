# FabOps Copilot — 製造事故應變助手

把一個合成製造告警，轉成可以核對來源、審查並核准的模擬 Ticket。這是針對 AI-enabled full-stack engineer 職缺的作品集專案。

**技術：Angular 21／TypeScript、.NET 8 Web API、PostgreSQL 16／pgvector、Python 官方 MCP SDK、Ollama、OpenTelemetry／Jaeger。**

全部設備、批次、保養紀錄、SOP 與交接資料都是自行虛構；沒有公司程式、資料或流程。設備數值為固定的模擬快照。作品只能建立、核准模擬工單，沒有設備控制或真實工單系統介接。

## 先看目前完成與驗證狀態

- 已實作：四個 Angular 頁面、.NET domain API／schema、模型自主選工具的 bounded agent、真實 MCP client/server、SOP chunking／embedding／pgvector 檢索、Ticket 草稿與核准、交接摘要、tracing、測試及 CI workflow。
- 已驗證：Windows PowerShell 5.1 啟動、Angular production build、標準 .NET build／8 個 xUnit、18 個 pytest（含 live DB 核准與 MCP 協定）、真實 Ollama／pgvector 三事故評估、桌面與手機的 live Playwright 核准流程、跨三服務的 Jaeger trace，以及 k6 本機讀取 API 測試。
- 本機 Docker staging 已實際部署，通過真實 AI 驗收、故障版本自動回復與手動 rollback。GitHub Actions 的 CI／image publish／本機 CD workflows 已建立；GitHub 推送與 runner 註冊待 CLI 帳號授權。

詳見 [驗證紀錄](docs/VALIDATION.md)。`artifacts/live-workflow-*.png` 是真實本機服務截圖；`workflow-*.png` 是較早的 mock API 測試。

## 第一步：本機啟動

這台電腦已準備 Node 24、Python 3.12 venv、下載並校驗的 .NET 8.0.425 SDK，以及 Ollama portable 0.35.1。後兩者位於本聊天 workspace 的 `work/tools/`，bootstrap 會自動偵測。本機模型為 qwen2.5:7b 與 nomic-embed-text。

在 **Windows PowerShell 5.1** 執行，工作目錄設為本 README 所在資料夾；不需要另外安裝 PowerShell 7：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\bootstrap.ps1
```

腳本會：建立忽略版控的 `.env` 與不同的隨機 service/operator keys → 啟動 PostgreSQL 與 Jaeger → 還原／建置 .NET 與執行 xUnit → 建置 Angular → 啟動 Ollama → 下載 chat 與 embedding 模型 → 分段並匯入 SOP → 執行 Python 測試 → 啟動 gateway。模型下載需要網路與數 GB 磁碟空間；推論使用本機。

啟動後：應用程式 `http://127.0.0.1:4317`；Jaeger `http://127.0.0.1:16686`。

先驗證不使用模型的流程：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\bootstrap.ps1 -Offline
```

Offline 使用 PostgreSQL lexical search 與固定流程，不是自主 AI Agent，也不是 embedding RAG。UI 和結果會明確標示。之後先執行 `scripts/stop.ps1`，再不帶 `-Offline` 啟動即可重建向量。

服務已啟動時先執行 scripts/stop.ps1 再啟動。停止腳本只結束 PID、執行檔與啟動時間吻合的本專案程序及其子程序，並保留資料庫與模型。

在其他電腦使用：安裝 Node 24、Python 3.12、.NET 8 SDK、Docker Desktop 和 Ollama，然後同樣執行 bootstrap。腳本優先使用本 workspace portable 工具，否則使用系統工具。日誌與 PID 位於 `artifacts/`；`.env`、模型、套件及日誌不應提交 Git。

停止服務（保留資料庫與模型）：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop.ps1
```

## 第二步：真正驗收

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify.ps1 -RequireAI
```

驗收腳本使用 bootstrap 選用的 Python，載入本機設定，執行 Python／live DB 測試、三事故 AI 評估與真實瀏覽器核准流程。它會建立明確標示的測試工單及其他模擬草稿。

評估檢查三個事故的 retrieval top-3、離題問題是否沒有結果、模型模式、引用 ID 與實際工具紀錄。`--require-ai` 不接受離線模式或 lexical fallback 充當完整 AI 驗收。報告存至 `artifacts/live-evaluation.json`。不檢查引用內容是否語意支持每個建議，這部分需要人員評分。

UI 操作：選 INC-1001 → 開始調查 → 檢查設備數值與維修紀錄 → 對照來源 chunk → 檢查未確認假設 → 勾選已審查 → 核准模擬工單 → 查看 audit → 產生交接摘要。模型可以選擇不建立草稿；這不是必然失敗，需檢查調查結果。

## 第三步：理解架構與設計決策

閱讀 [架構圖與資料流](docs/ARCHITECTURE.md)、[ADR](docs/ADR.md)、[API 與工具](docs/API.md)。

Angular 前端使用四個 standalone feature components、Router、Signals store 與 typed HttpClient service；專案結構、開發模式與操作狀態說明見 [Angular 前端導覽](docs/FRONTEND.md)。

`web/` 是 operator UI；`agent/app.py` 是本機 gateway；`agent/core.py` 負責模型與 MCP tool loop；`agent/mcp_server.py` 把企業能力映射到 `.NET API`；`api/` 擁有製造 domain、PostgreSQL 持久化、檢索 SQL 與最終核准；`knowledge/` 是可公開的合成文件。

Agent 自主選擇讀取工具、搜尋詞與順序。Host 固定執行一次 incident scope anchor；蒐集到 telemetry、maintenance 與 SOP 證據後結束 discovery，最多 8 輪／16 次工具呼叫，再驗證引用。草稿階段模型決定是否呼叫 draft tool，host 使用已驗證的欄位。工具不能核准工單。

## 第四步：展示工程能力

| 職缺能力 | 可展示的實作與證據 |
|---|---|
| Full stack | Angular UI → Python gateway → .NET domain API → PostgreSQL |
| 架構與平台賦能 | ADR、domain API、typed tool schemas、可重用 MCP server |
| Autonomous agent | Ollama tool calls 選工具；執行 events 展示實際順序 |
| Decision support | telemetry／incident／maintenance + SOP；假設和不確定性分開 |
| Summary | Shift Handover 頁面，保留 incident IDs 與原始 facts |
| MCP／API integration | 真實 stdio handshake；MCP tools → .NET API |
| Embedding／RAG | Markdown section chunks → nomic 768-dim → pgvector + lexical rank |
| Enterprise search | 獨立知識搜尋頁、來源 chunk IDs、無資料時不產生處置建議 |
| Reliability | 明確降級、timeouts、工具 budget、idempotent draft、readiness |
| Security | allowlist／scope checks／service vs operator keys／一次性核准 token |
| Observability | OpenTelemetry 跨 Python→MCP→.NET trace；Jaeger trace link |
| Testing | xUnit、pytest、Playwright、k6；區分 mock／live 驗證 |
| AI-assisted engineering | [AI Dev Log](docs/AI-DEV-LOG.md) 與待人工審查清單 |
| CI/CD | GitHub Actions 測試／GHCR／本機 runner workflows；Docker staging、AI release gate、失敗自動回復 |

單元／協定與 UI 測試：

```powershell
dotnet test tests/FabOps.Tests.csproj
python -m pytest tests -q
cd web
npm ci
npm run build
npx playwright install chromium
npm run test:e2e
```

Live domain integration 另設 `$env:FABOPS_INTEGRATION='1'`；需已啟動 API／資料庫並匯入知識，且設定與 `.env` 相同的 service/operator keys。此測試會新增一筆明確標示為測試的模擬 Ticket。

k6：`k6 run tests/load.js`。這是 domain-backed read API 的基礎負載測試，不測 LLM 推論吞吐。

## 第五步：面試展示與下一階段

使用 [5 分鐘展示腳本](docs/DEMO.md)，先跑 live evaluation，保留成功與失敗例子。你能說明自己的設計取捨、測試界線與修改過的內容，比只展示畫面更有說服力。

本機 Git 與容器部署的操作見 [CI/CD 導覽](docs/CICD.md)。Staging 應用程式為 `http://127.0.0.1:4319`，Jaeger 為 `http://127.0.0.1:16687`；開發環境繼續使用 4317／16686。

後續優先：人工審查模型建議與程式 → 增加 prompt injection／資料過期／模型品質評估 → 真實 OIDC／RBAC 與 async job queue → cloud staging 與正式 migration。初版仍是單機 portfolio MVP，不能聲稱已符合關鍵製造生產系統或已具備 24x7 實際支援經驗。

官方資料來源：[MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk)、[Ollama tool calling](https://docs.ollama.com/capabilities/tool-calling)、[Ollama embeddings](https://docs.ollama.com/api/embed)、[pgvector](https://github.com/pgvector/pgvector)、[.NET OpenTelemetry](https://opentelemetry.io/docs/languages/dotnet/getting-started/)。
