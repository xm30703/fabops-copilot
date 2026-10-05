# 本機專案、Git 與 CI/CD

本機專案根目錄為 `C:\Dev\fabops-copilot`，可直接用 VS Code 開啟。工具與部署狀態獨立存於 `C:\Dev\fabops-runtime`，目錄規劃見 [本機環境](LOCAL-SETUP.md)。所有 domain 資料及 SOP 都是合成資料；模型、虛擬環境、日誌、`.env` 與部署憑證不進 Git。

## 兩種本機環境

| 用途 | 啟動方式 | 網址 | 資料庫 |
|---|---|---|---|
| 開發 | `scripts/bootstrap.ps1` | 127.0.0.1:4317；Angular dev 4200 | 原 compose pgdata，主機 5439 |
| CD staging | `scripts/deploy.ps1` | 127.0.0.1:4319；Jaeger 16687 | 獨立 staging-pgdata，不發布 DB port |

Staging 的 Angular 靜態檔案和 Python Agent 共用 gateway image；.NET 為另一個 image。兩個容器用非 root 帳號執行。Ollama 繼續使用 Windows 主機 GPU，容器經 host.docker.internal:11434 存取，需先有 qwen2.5:7b 和 nomic-embed-text。

## GitHub 流程

`feature branch → pull request → CI → merge main → CI → build/test images → GHCR → Windows runner → local staging`

CI 使用 GitHub hosted Ubuntu，執行 xUnit、Python unit/MCP/live DB、Angular production build、四個 mock Playwright case、offline baseline retrieval 與容器內的真實 domain/DB smoke。CI 沒有 GPU 模型，所以 baseline 結果不當作 AI 驗收。

只有 main 且測試通過才推送 GHCR；image tag 使用完整 commit SHA。PR 不發布 image，也不執行本機 runner。CD 使用本機 Windows runner 與 Ollama，要求模型就緒、向量匯入成功、三個事故全為 ollama-agent 且引用合法。Actions 綁定明確 commit SHA，workflow 的 token 權限依 job 限制。

`.github/workflows/ci.yml` 負責 CI、image 與 CD；`rollback.yml` 可從 GitHub Actions 手動回復上一個成功版本。CD 紀錄以 environment `local-staging` 顯示。

## 本機部署與回復

第一次自行建置／部署（PowerShell 5.1 可用）：

```powershell
$env:IMAGE_TAG='local-v1'
$env:DB_PASSWORD='build-placeholder'
$env:SERVICE_KEY='build-service'
$env:OPERATOR_KEY='build-operator'
docker compose -f .\compose.staging.yaml build
.\scripts\deploy.ps1 -ImageTag local-v1
```

build placeholder 只供 compose 解析，不會打包到 image。deploy 使用 runtime 的 `staging/staging.env`（這台電腦為 `C:\Dev\fabops-runtime\staging\staging.env`），用隨機、不同的 key，並明確載入 staging 值。搬移保留了原有憑證；不可刪除此檔後直接沿用既有 DB volume，否則密碼會不一致。

```powershell
.\scripts\deploy.ps1 -ImageTag <commit-sha> -ImagePrefix ghcr.io/<owner>/<repo> -Pull
.\scripts\deploy.ps1 -Rollback
```

部署會鎖住 state directory，等待容器就緒、執行 smoke、重建 SOP vectors、跑 AI 評估，全部通過才更新 `release.json`。失敗時回復 current，仍以非零 exit 結束，讓 Actions 正確顯示部署失敗。Previous/current image 需保留在 Docker cache。報告位於 runtime 的 `staging/evaluation-<tag>.json`，不含 service/operator key。

目前 schema 為 idempotent additive 初始化，回復只還原 application images；不刪資料、不還原資料庫。未來破壞性 migration 需要備份與專用 migration 流程。這套 compose 會短暫重建服務，不保證零停機。

## 一次性的 GitHub 設定

1. 用 GitHub CLI 登入，授權 repo／workflow，建立私人 repository 並 push main。不要把 token 放進 `.env` 或 Git。
2. 在 repository 註冊 Windows x64 self-hosted runner，加入 label `fabops-local`。本機安裝於 `C:\Dev\fabops-runtime\actions-runner`，不在 Git 專案內。
3. repository Actions variables 設 `FABOPS_RUNTIME_DIR=C:\Dev\fabops-runtime`、`FABOPS_STATE_DIR=C:\Dev\fabops-runtime\staging`，再設 `LOCAL_CD_ENABLED=true`。持久 state 在 source checkout 與 runner checkout 之外，避免 checkout clean 刪除憑證與版本紀錄。
4. 保持 Windows、Docker Desktop、Ollama 和 runner 啟動。重開機後在本專案執行 `scripts/start-runner.ps1`，再到 Actions 手動執行 CI/CD。

這台電腦已下載並校驗 GitHub CLI 2.102.0 與 Windows Actions runner 2.337.0，位於上述 runtime。CLI 登入、local commit 都完成後，可在本專案執行以下腳本，建立私人 repository、設定 origin、註冊 runner／variables，再 push main：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\connect-github.ps1 -EnableLocalCd
```

腳本會檢查目前登入帳號、工作目錄是否乾淨，以及 origin／runner 是否符合指定 repository。Git credential helper 只設定在此專案，不修改全域 Git 設定。預設 owner 為 xm30703，repo 為 fabops-copilot；可用參數指定。完成腳本仍須查看 Actions 的實際結果。

本機 runner 只接受這個私人 repository 的 main 部署，不對外發布網站。正式開放網站之前需要登入與授權。私人 repository 可邀請面試官讀取；若之後改為公開，應先移除／隔離具有主機存取權的 runner。

## 平常開發

```powershell
git switch -c feat/sensor-offline
# 修改程式、文件，執行相應檢查
git add .
git commit -m "feat: add synthetic sensor offline scenario"
git push -u origin feat/sensor-offline
```

在 GitHub 建 PR、讀 CI evidence、審查後合併 main，即會觸發 CD。你可以展示 commit、PR、測試結果、GHCR image tag、Actions deployment 和 rollback 紀錄，說明一個變更如何到達本機 staging。

官方參考：[GitHub hosted/self-hosted runners](https://docs.github.com/en/actions/reference/runners/self-hosted-runners)、[發布容器映像](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)、[GITHUB_TOKEN 權限](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token)。
