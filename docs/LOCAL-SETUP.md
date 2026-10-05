# 本機目錄與環境

## 固定配置

| 位置 | 用途 | Git |
|---|---|---|
| `C:\Dev\fabops-copilot` | source checkout，包含 .git、api、agent、web、knowledge、tests、docs、scripts | 原始碼／文件提交 |
| `<checkout>\.venv` | Python 3.12 專案環境，以 requirements-lock.txt 建立 | 忽略；不搬用另一個路徑的 venv |
| `<checkout>\.env` | native 開發環境的本機 keys／模型設定 | 忽略 |
| `<checkout>\.tools`、`artifacts` | build caches、程序 PID、驗收證據 | 忽略 |
| `C:\Dev\fabops-runtime\tools` | .NET SDK、Ollama、GitHub CLI、k6、actionlint | 在 repo 外 |
| `<runtime>\models`、`playwright` | 本機模型與瀏覽器套件 | 在 repo 外 |
| `<runtime>\gh-config`、`actions-runner` | GitHub 登入設定與 runner | 在 repo 外 |
| `<runtime>\staging` | staging.env、release.json、部署評估 | 在 source／runner checkout 外 |
| Docker volumes | 開發與 staging 的 PostgreSQL 持久資料 | Docker 管理；不隨 source 位置搬移 |

腳本透過 `scripts/paths.ps1` 統一解析位置。預設 runtime 是 source checkout 的 sibling `fabops-runtime`；其他主機可設定 `FABOPS_RUNTIME_DIR`。原始碼沒有回溯聊天資料夾、日期或 outputs 的邏輯。

開發 compose 的固定 project name 為 `fabops-mvp`，沿用既有 `fabops-mvp_pgdata`；staging 固定為 `fabops-staging`。因此變更 Git checkout 的資料夾名稱不會建立另一個空資料庫。

## 開發

```powershell
Set-Location C:\Dev\fabops-copilot
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\bootstrap.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify.ps1 -RequireAI
```

應用程式為 http://127.0.0.1:4317，Jaeger 為 http://127.0.0.1:16686。Angular 開發模式可在 web 執行 npm run dev，使用 4200；proxy 呼叫 gateway。

停止 native 開發服務：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop.ps1
```

Ollama 同時供 staging 使用；停止包含 Ollama 的 native 服務後，staging 的 AI 功能也會暫停，直到再次啟動。停止程式保留模型與 DB volumes。

## 部署

```powershell
.\scripts\deploy.ps1 -ImagePrefix ghcr.io/xm30703/fabops-copilot -ImageTag <commit-sha> -Pull
.\scripts\deploy.ps1 -Rollback
```

應用程式為 http://127.0.0.1:4319，Jaeger 為 http://127.0.0.1:16687。部署 state 預設在 runtime/staging；CI/CD 使用明確的 FABOPS_STATE_DIR。Runner 在 runtime/actions-runner/_work 取得自己的 checkout，無需修改你正在開發的 source checkout。

## 2026-10-05 搬移

原 project、.git 歷史、.env、模型、工具與部署 state 已搬到上述位置。Python venv 在新 checkout 重新建立，以避免 Windows pip entrypoint 記住舊路徑。不可把舊聊天 workspace 的 work/venv 當作本專案依賴。

搬移前保留 development／staging 的模擬 Ticket IDs 與 audit count，搬移後逐項核對；啟動、驗收與 remote Actions 的實跑結果見 VALIDATION。舊輸出目錄只保留位置指引。
