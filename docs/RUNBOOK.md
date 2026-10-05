# 本機維運與事故演練

先從 UI「檢查服務」與 `/api/health` 看依賴，然後檢查 `artifacts` 的 API／agent／Ollama logs。不要公開 `.env` 或包含秘密的 dump。

| 症狀 | 調查與恢復 |
|---|---|
| domain=false | `docker compose ps`；檢查 PostgreSQL port 5439、credentials、API logs。DB 啟動較晚時用 service key 呼叫 POST /initialize。 |
| ollama=false | 確認 11434 listening 與 Ollama logs；只保留一個 serve instance。 |
| chatModel=false | `ollama pull qwen2.5:7b`；確認 .env model name。 |
| embeddingModel=false | `ollama pull nomic-embed-text`；重新 `python -m agent.ingest`。 |
| lexical-postgres | 模型沒有 embedding 或 corpus 尚未 vector ingest；不能把它當作完整 embedding RAG。 |
| offline-fallback | 查看 run warnings 與 events；可能模型無法連線、缺必要工具、schema／引用失敗。 |
| 429 | 前一個調查仍在執行；等待完成。此 MVP 無多 worker job queue。 |
| 409 approval | token 過期、被消耗或工單已核准；先查 ticket 狀態。 |
| Jaeger 空白 | 確認 Jaeger 4318 endpoint、Python 與 .NET exporter logs，搜尋 fabops-agent-gateway／fabops-domain-api。 |

可逆故障演練：停止 Ollama → 調查 → 驗證 offline-fallback 明確標示 → 重啟並重跑 eval。停止 PostgreSQL → readiness 應失敗，UI 應顯示依賴錯誤 → 重啟 DB／initialize → 驗證資料仍在。

不得把這份合成演練 runbook 用於真實設備。沒有真實 on-call 排班、告警通路、RTO／RPO／SLO 或值班經驗證明。
