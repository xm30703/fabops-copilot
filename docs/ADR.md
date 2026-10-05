# Architecture Decision Records

## ADR-001：先做本機，雲端留作 staging

狀態：採用。理由：公開作品用合成資料，能不依赖帳務／API key、重現故障與觀察本機推論。選 Windows native application + Docker PostgreSQL／Jaeger；Ollama 本機推論。取捨：啟動涉及多個程序，模型下載與 CPU 推論較慢；不能用本機 demo 代替雲端部署經驗。

驗證：先確認 Docker、API、模型與 vector ingestion readiness，再跑 live eval。2026-10-05 已補上 API／gateway container images、本機 staging、部署驗收與實際 rollback；GitHub 端執行狀態另記於 VALIDATION。

## ADR-002：.NET domain 與 Python Agent 分開

狀態：採用。理由：製造 domain、交易、核准與持久化放在 .NET；模型工具編排與官方 Python MCP SDK 放在 Python。MCP server 以 domain API 為邊界，便於未來接不同 Agent host。取捨：多一個 HTTP hop、兩種依賴管理，需契約測試和跨程序 trace。

## ADR-003：PostgreSQL lexical search + pgvector

狀態：採用。理由：一個資料庫管理 incident／ticket 與 SOP vectors，降低 MVP 維運需求。nomic-embed-text 768 維，cosine 與 lexical 分數混合。Embedding 不可用時明確標示 lexical fallback。取捨：權重與 threshold 尚需校準；HNSW 不代表混合查詢已優化；中文 keyword search 較弱。

驗證：三個症狀對應文件 top-3；離題查詢；paraphrase／中英查詢；版本替換與引用 snapshot。小 corpus 命中不等於 enterprise search 品質已證明。

## ADR-004：有界自主代理與兩階段寫入

狀態：採用。讀取期模型自主選 tools；host 限制 scope、schema、calls／turns、timeout 與證據 completeness。生成結果驗證後才能進入 draft phase。模型可以提出草稿，提交核准只能由 UI operator 流程執行。

取捨：部分合格的模型回答仍可能因 coverage 不足被降級；模型可能決定不建立草稿。工具事件能展示選擇行為，但不是模型「理解」或推理正確性的證明。

## ADR-005：核准權限在 domain 層

狀態：採用。服務 key 能讀取／建立草稿；operator key 能核准。token hash 存 DB、60 秒到期、一次性原子消耗，草稿 idempotency 由 UNIQUE run_id 保證。取捨：本機 operator identity 沒有個人帳號；分享部署前需正式身分與授權。人員確認是介面及 domain policy，不是 LLM prompt 裡的願望。

## ADR-006：驗證證據分層

狀態：採用。單元測試、MCP protocol integration、mock API UI、live domain／DB、live model evaluation 分開報告。沒有以 mocks 替代真正 AI 驗收；CI 第一版使用 offline baseline，模型品質另以 live evaluation 留下報告。

## ADR-007：依職缺要求改用 Angular 前端

狀態：採用。使用者確認求職需求提到 Angular，因此前端由 Vue 改成 Angular／TypeScript。鎖定 Angular 21，與現有 Node 24.13 相容，依據 [官方相容表](https://angular.dev/reference/versions)。framework 與 CLI 的最新 patch 不同，分別鎖定於 package-lock.json。

四個 standalone feature components 經 Router 導覽，共用 Signals store；typed ApiService 透過依賴注入取得 HttpClient。元件用 OnPush，沒有 Zone.js 依賴。TypeScript 型別提供編譯檢查，domain API 仍負責實際輸入與核准權限驗證。

採用 hash routes，重新整理及 deep links 可由既有 static gateway 提供。CLI outputPath 保持 web/dist，因此後端的靜態資源掛載不用調整。取捨：URL 含 #、bundle 比原先更大；未來若改成 path routes，需要設定 SPA fallback。

驗證：Angular production build、三個 mock browser cases、真實 AI／MCP／pgvector 的人工核准、知識搜尋與交接摘要。證據記於 VALIDATION；本次不重跑未變更的後端單元與負載測試。

## ADR-008：GitHub CI 與本機 GPU CD

狀態：採用。使用者選擇建立本機 Git 專案及 CI/CD。測試使用 GitHub hosted Ubuntu；main 通過後發布 GHCR commit SHA images，本機 Windows runner 將相同版本部署到 Docker staging。Ollama 維持主機 GPU，避免重複下載模型。原 native 開發服務與 staging 使用不同 port、volume、credentials。

CI 執行 offline baseline 與真實 DB／容器測試；CD 強制 real Ollama embedding、MCP agent 及三事故引用檢查，失敗自動回復上一個成功 image。Release state 與 secrets 在 runner checkout 外。手動 rollback 和失敗恢復均已本機實跑。取捨：主機關閉或 runner 停止時 CD 等待；部署有短暫重建服務；目前只回復 images，沒有破壞性 DB migration 的回復。

Main 才能觸發 self-hosted 部署；PR 僅用 hosted runner。Actions token 採 job 最小權限，登入 registry 憑證用 job temporary directory，第三方 action 綁 commit SHA。GitHub remote／runner 的首次建立仍需要使用者帳號登入。
