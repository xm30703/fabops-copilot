# 驗證紀錄 — 2026-10-04（Asia/Taipei）

以下先保留 2026-10-04 的實跑結果；後續 Angular、搬移與 GitHub 執行記錄按日期附於文末。使用合成資料；單元／mock、真實協定、資料庫與模型驗證分開說明。

本次前端遷移為 Angular 21。前端 build／瀏覽器／dev proxy 已重新驗收；下表的 .NET、pytest、三事故模型評估、k6 與 Jaeger 數據保留前次實跑結果，後端未變更，本次沒有重跑這些檢查。

環境：Windows PowerShell **5.1**、Node 24、Python 3.12、.NET SDK 8.0.425、Docker Desktop／Docker 29.8.1、Ollama portable 0.35.1。Chat 為 **qwen2.5:7b**，embedding 為 **nomic-embed-text／768 維**，7 個 SOP chunks 存於 PostgreSQL／pgvector。這台電腦有 RTX 5070 Ti；模型延遲不代表其他硬體的結果。

| 檢查 | 實際結果 | 範圍與證據 |
|---|---|---|
| PowerShell 相容性 | 通過 | 以 powershell.exe 實際執行 stop、bootstrap、verify；不需 pwsh。stop 結束本專案程序樹，重新啟動保留 DB／模型。 |
| Docker Compose | 通過 | PostgreSQL 與 Jaeger 啟動；domain readiness／模型健康檢查全為 true。 |
| 標準 .NET restore／build／xUnit | 通過，8 個 xUnit | domain policy 與向量檢查；不是完整 API 測試。見 bootstrap log（`artifacts/bootstrap.log`）。 |
| Angular 21 production build | 通過 | ng build 含 strict TypeScript／template 檢查，輸出 web/dist。見 Angular build log（`artifacts/angular-build.log`）。 |
| pytest | 18 passed | allowlist、schema、scope、budget、citation、重複步驟、降級、evidence 收斂、cross-origin、human confirmation；另含真實 MCP stdio 握手及 live DB 測試。見 verification log（`artifacts/verification.log`）。 |
| Live domain／DB | 通過 | 草稿 idempotency、60 秒核准 token、核准持久化、token 重放被拒絕；使用真實 API／PostgreSQL。測試工單有明確標記。 |
| Live embedding／RAG | 3/3 命中，離題查詢無結果 | 三症狀在 top-3 chunks 找到預期 SOP；每次為 hybrid-pgvector。見 評估 JSON（`artifacts/live-evaluation.json`）。 |
| Live autonomous agent | 3/3 通過 | INC-1001／1002／1003 全部 ollama-agent，模型選擇 read tools／搜尋詞，引用 ID 有效且沒有核准工具；耗時 11.2／10.2／11.8 秒。 |
| Angular Live Playwright | 1 passed，4 不適用測試 skipped | 真實模型→MCP→API→DB、引用定位、checkbox、核准、audit、知識搜尋（核對 payload／SOP-TEMP-02）、POST 交接摘要與切回調查；桌面／手機截圖、無水平溢出／JS page error。測試 10.7 秒，見 live log（`artifacts/angular-live-e2e.log`）。 |
| Angular Mock Playwright | 3 passed | 核准 gate、四路由／deep link／reload、查詢 payload／無結果、跨頁狀態、換事故清除確認、503 恢復與文字 escaping。見 browser log（`artifacts/angular-mock-e2e.log`）；不計為真實 AI 證據。 |
| Angular development proxy | 1 passed | 真實瀏覽器從 4200 發出 Origin=4200 的 POST，proxy 轉送至 gateway，回應 hybrid-pgvector 與預期 SOP；由 Playwright 管理 dev server 生命週期。見 metadata（`artifacts/angular-dev-proxy.json`）。 |
| Shift Handover | 通過 | 實際 Ollama 摘要引用三個 incident IDs，保留原始 facts。見 摘要 JSON（`artifacts/live-handover.json`）。 |
| OpenTelemetry／Jaeger | 通過 | 一條 trace 實際包含 32 spans、gateway／MCP／.NET 三服務與 LLM spans。見 trace metadata（`artifacts/live-trace.json`）。 |
| k6 讀取 API | 通過 | 本機 5 VUs／30 秒／150 requests，0% HTTP failure，p95 27.08 ms，兩個 thresholds 通過。見 k6 JSON（`artifacts/k6-summary.json`） 及 log（`artifacts/k6.log`）；不測 LLM 併發。 |
| GitHub Actions／cloud CD | 尚未執行／未部署 | CI workflow 已建立；未推送到 GitHub，也沒有正式部署或 rollback 驗收。 |

真實畫面：桌面（`artifacts/live-workflow-desktop.png`）、手機（`artifacts/live-workflow-mobile.png`）。

## 可重現命令

在專案根目錄執行。若服務已運行，先 stop；資料與模型仍保留。

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\bootstrap.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify.ps1 -RequireAI
```

verify 會新增模擬調查／工單。Bootstrap 的一般 pytest 會略過 live DB case；verify 設定 FABOPS_INTEGRATION=1 後執行全部 18 個測試。--require-ai 不接受 offline 或 lexical fallback 當成完整 AI 通過。

## 實跑發現與修正

- 先前受限執行環境無法啟動 Docker／Ollama；使用者授權完整存取後，已直接啟動並完成整合。
- 原指令錯誤假設有 PowerShell 7。已改寫 RNG、UTF-8 寫檔、JSON array、npm invocation，實際在 Windows PowerShell 5.1 驗收。
- 早期 qwen2.5:3b 曾產生不存在的引用，系統正確降級。新增生成 schema 的引用 enum 與 coverage feedback，後續也拒絕重複步驟，並把 ranking metadata 移出 synthesis context。
- qwen2.5:7b 的 INC-1002 曾取得證據後反覆選工具，直到 turn budget。Host 現在於 evidence contract 滿足後結束 discovery；新增回歸測試，三案例重新通過。
- .NET OTLP HTTP endpoint 補上 /v1/traces；以 Jaeger API 確認資料實際送達。HTTP client 改為 lifespan connection pool，另以 k6 留下量測。
- OpenTelemetry NuGet 依賴已升級至 1.19.x，standard restore 沒有先前 1.12.0 的 NU1902 警告。
- Angular 遷移移除 Vue 元件與依賴，保留 gateway／domain API。交接頁改用 POST；搜尋表單加入 Reactive Forms 與 render readiness，修正剛切換頁面時首次輸入被初始化覆蓋，瀏覽器直接核對送出的 query。

## 結果界線

只有三個固定事故及小型 corpus。有效引用 ID、正常工具紀錄與通過測試，**不代表建議在語意上正確，也不代表量產系統可靠性**；模型仍可能錯誤解讀證據、混用字體或需要降級。內容評分、prompt injection 對抗、資料時效、更多模型／硬體與大 corpus 尚待擴充。

Operator identity 是本機 demo，未實作正式個人帳號／OIDC／RBAC。MCP child 和 gateway 共享 OS 身分；移除 operator credential 不構成 OS sandbox。測試包含一個非阻擋的 Starlette TestClient deprecation warning。

這是本機 staging；cloud staging、正式企業系統串接與實際 24x7 on-call 經驗不在已驗收範圍。GitHub hosted CI／本機 runner 的後續實跑結果見文末。

## 2026-10-05：本機 Git／容器／部署驗收

- API 與 Angular/Python gateway 多階段 Docker build 成功，runtime 使用非 root 帳號。
- Windows PowerShell 5.1 真正部署 staging，獨立 PostgreSQL volume、4319／16687 loopback ports；7 個 SOP chunks 匯入 pgvector。
- Staging smoke：Angular assets、domain/DB、seed data、跨 origin mutation 拒絕、Ollama chat/embedding readiness 通過。
- 三事故均為 ollama-agent、三個 retrieval top-3 命中、out-of-domain 無 evidence、所有步驟引用為實際 chunk ID，完整 AI release gate 通過。
- 人為製造 gateway 啟動失敗 image `failure-probe`：部署正確失敗，重建為 local-cd-v1 並重新通過 AI release gate；release state 沒有誤記失敗版本。
- 使用相同 image 的 local-cd-v2 作回復演練，手動 `-Rollback` 回到 local-cd-v1，真實 AI release gate 再次通過。這兩個 local tags 是部署演練，並非兩次功能改版。
- xUnit 8 passed；pytest 17 passed／1 live DB case 因未設 FABOPS_INTEGRATION 而 skipped；Angular build 與 3 mock browser cases passed。
- Linux gateway image 中的 pytest 也為 17 passed／1 skipped；staging 真實瀏覽器調查、人工核准、搜尋與交接摘要 1 passed（10.8 秒），並確認 staging Jaeger 實際收到 32 spans、trace link 使用 16687。
- Linux npm ci 發現 Windows lockfile 缺少 @emnapi entries，已於乾淨 Linux container 重建 lockfile，Windows npm ci/build/browser 重新通過。
- Piscina build dependency 鎖至 5.3.2，npm audit 為 0。修補依據 [上游 advisory](https://github.com/advisories/GHSA-67c8-pqhq-4rmx)。
- CI/CD 與 rollback workflows 通過 actionlint 1.7.12；PowerShell scripts 通過 parser 檢查。GitHub workflow 的實際執行仍待 GitHub CLI 登入後確認，不能用本機結果代替。
- 用另一套暫時的 Docker project／volume 實跑 CI image job 的 offline 流程：容器 readiness、smoke、lexical ingestion、三事故 baseline evaluation 全部通過，之後只清除該暫時環境。
- 已建立 main 分支與本地 commits，Git 工作目錄乾淨。修正原 sandbox 建立的 repository 根目錄／.git ownership，使用者可正常執行 Git，不需全域 safe.directory exception。82 個 source files 的已知本機 secrets／private key／GitHub token scan 通過，環境設定與 evidence 不進版控。

原始證據在忽略版控的 `artifacts/container-build.log`、`staging-deploy.log`、`automatic-recovery.log`、`second-release.log`、`manual-rollback.log`。部署評估原在 `.deploy/evaluation-*.json`，2026-10-05 搬移時完整保留至 `C:\Dev\fabops-runtime\staging`。

## 2026-10-05：固定開發目錄搬移

- Source checkout／.git 已搬到 C:\Dev\fabops-copilot，完整保留既有 commits；git fsck 無損壞。
- 工具、模型、瀏覽器、GitHub CLI 設定、runner、部署 state 搬至 C:\Dev\fabops-runtime；各 script 經 paths.ps1 解析，沒有聊天目錄依賴。GitHub CLI 登入在新位置仍有效。
- 開發 compose 固定 name=fabops-mvp；搬移前後 development 的 26 個 ticket IDs／11 audits，staging 的 13 個 ticket IDs／1 audit 完全一致，保留資料 volume 及 credentials。
- 以 Windows PowerShell 5.1 在新路徑 bootstrap；重新建立 .venv，Python／API／Ollama 皆從 C:\Dev 執行。Angular build、xUnit 8 passed、pytest 17 passed/1 skipped。
- 新路徑 live verification：pytest 全 18 passed（含 DB 核准／重放），三事故實際 ollama-agent 11.7／10.5／11.6 秒，RAG 與合法引用通過。
- 初次 browser 驗收發現原搜尋欄位尚未接上 FormControlName 時可提前輸入，預設值會覆蓋使用者 query。增加 native initial-disabled directive，Angular build 321.61 kB、四個 mock cases（含十次切頁立即輸入）passed；真實 browser 調查／核准／搜尋／交接重新 1 passed，22.1 秒。保留失敗與修正後證據。
- GitHub hosted workflow 與 CD 的遠端執行結果需另行記錄；以上屬實際本機搬移驗收。

## 2026-10-05：GitHub CI／GHCR／本機 runner 部署成功

[成功的 Actions run 37271684688](https://github.com/xm30703/fabops-copilot/actions/runs/37271684688) 對應 application commit `10f26e271a088dc82c3d10d0944bd89510943edc`。三個 job 全為 success，2026-10-05 14:22:55（Asia/Taipei）寫入成功 release state。Repository 為私人 [xm30703/fabops-copilot](https://github.com/xm30703/fabops-copilot)。

| Job／檢查 | 實際結果 |
|---|---|
| GitHub hosted verify | xUnit 8 passed；pytest 18 passed（含 live DB／MCP）；Angular production build；4 mock Playwright cases passed；domain／gateway smoke 與 offline baseline evaluation 通過 |
| GitHub hosted images | .NET 與 Angular/Python images 建置、容器 smoke、lexical ingestion／baseline evaluation 通過，再推送兩個完整 commit SHA tags 至私人 GHCR |
| Windows self-hosted deploy | packages:read job token 登入、下載 images、compose readiness、domain／DB／Ollama smoke、7 SOP chunks 向量匯入、真實 AI release gate 全部通過；job 結束時 registry logout 成功 |
| Live staging AI | INC-1001／1002／1003 均為 ollama-agent，引用 ID 有效；耗時 10.2／9.4／10.2 秒；三個 hybrid-pgvector top-3 命中，離題檢索無 evidence |
| 部署身份 | 容器 tag 與 OCI revision 等於上述 commit；OCI source 為此 GitHub repo。Gateway digest 為 ca9abe2bc162f894c86e35bdbd535d74ce3eb8a1e4d7dc00b52754970c53fa7d；API digest 為 43644aef811a52f597c9406fecb8c0c3881dc1f75e0b3408d83aaadcb27b1abc |
| 搬移資料保留 | 再次核對全部 26 個 development、13 個 staging 原有 ticket IDs 都存在；驗收後 development 32 tickets／14 audits、staging 19 tickets／1 audit。新增皆為合成測試草稿／核准紀錄 |

成功 run 的完整 log 位於忽略版控的 `artifacts/github-ci-cd.log`；嚴格 AI 報告位於 `C:\Dev\fabops-runtime\staging\evaluation-10f26e271a088dc82c3d10d0944bd89510943edc.json`，current／previous 記於同目錄的 release.json。Previous 保留本機 local-cd-v1。回復功能曾在本機實跑；GitHub 手動 rollback workflow 尚未 dispatch，不將它列為遠端回復證據。

初次遠端部署卡在 registry login。診斷中曾誤把 package metadata 的 repository=null 當成權限不足；[跨平台診斷 run](https://github.com/xm30703/fabops-copilot/actions/runs/37271072475) 證實 hosted Linux 和本機 Windows 的 packages:read token 都能登入與讀取私人 manifest。此暫時 diagnostic workflow 已移除，執行與 source 留在 GitHub history。

真正的 byte 問題可用假 token 重現：將 Console.InputEncoding 設為 UTF-8 時，.NET Framework Process.StandardInput 會加上 EF BB BF；BaseStream 寫入也受影響。registry-login.ps1 明確設定無 BOM UTF-8 後再取得 StandardInput，並在結束時還原 host encoding。成功 runner log 確認原 host preamble 為 3 bytes，修正後 Login Succeeded。保留失敗 run，未提高 deploy token 的 packages 權限，也未加入個人 registry token。

此處部署目的地是這台電腦的 Docker staging。Windows、Docker Desktop、Ollama 與 runner 需要運作；雲端模型、cloud application hosting 與正式製造環境仍未部署。只有文件／驗證紀錄的後續 commit 使用 `[skip ci]`，不改變已驗收 application image。

## 2026-10-08：公開文件導覽整理

- README 保留系統用途、合成資料邊界、架構、啟動、操作情境、測試與 CI/CD；工程設計與驗證文件維持可讀。
- 檢查公開 source tree 的 20 個 Markdown、HTML 與 JavaScript 文件，不含個人準備內容或相關入口；21 個相對連結皆指向版控內的實際檔案。原始本機驗收證據改以檔案位置表示，避免連到不公開的 raw logs。
- 此次僅修改文件與忽略規則，沒有更改應用程式、模型、資料庫、憑證或部署狀態，也沒有重新執行 mock、offline baseline、live DB 或 live AI 測試。上述各類證據仍引用既有實跑結果。
