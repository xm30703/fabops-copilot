# API 與 MCP 契約

`.NET API http://127.0.0.1:5080`：一般 domain endpoint 需 `X-Service-Key`；`/operator/*` 需不同的 `X-Operator-Key`。`/health/*` 不需 key。瀏覽器不持有這兩個 key。

| API | 功能 |
|---|---|
| GET /health/live, /health/ready | 程序存活／schema 與 DB 可用；readiness 不等於模型準備完成 |
| POST /initialize | DB 啟動後重試 migrations／seed；需 service key |
| GET /machines, /machines/{id} | 模擬設備快照與 telemetry |
| GET /incidents, /incidents/{id} | 事故與影響 |
| GET /maintenance/{machineId}, /shifts | 維修紀錄與交班範圍 |
| POST /knowledge/documents | Atomic replace，包含 documentId 與完整 chunks |
| POST /knowledge/search | query、optional 768-dim embedding、limit |
| POST /runs, GET /runs/{id} | 保存與讀取完整調查 evidence snapshot |
| POST /tickets/drafts, GET /tickets | 驗證 run／citations；同一 run idempotent |
| POST /operator/tickets/{id}/token | 僅限 draft，取得 60 秒一次性核准 token |
| POST /operator/tickets/{id}/approve | 消耗 token、更新 approved、寫 audit 的同一交易 |
| GET /audit | 最近 100 次核准稽核事件 |

MCP stdio 啟动：`python -m agent.mcp_server`，或使用 venv Python 的絕對路徑。`cwd` 必須設為 repo root；一般 logs 寫 stderr，stdout 是 MCP protocol。

| Tool | 輸入 | 能力 |
|---|---|---|
| get_incident | incident_id | Read |
| get_machine | machine_id | Read |
| get_maintenance | machine_id | Read |
| search_sop | query | Embedding + domain search |
| create_ticket_draft | run_id, incident_id, title, summary, citations | Simulated draft only |

`traceparent` 由 host 注入，不由模型控制。沒有 approve、restart、SQL、shell、recipe-change、queue-replay tool。

Gateway `http://127.0.0.1:4317/api` 提供 UI 同源 API，`POST /investigate` `{incidentId,question}`、`POST /search` `{query}`、`POST /handover`、`POST /tickets/{id}/approve` `{confirmed:true}`。單次 investigation 最多 10 分鐘，只有一個推論請求可執行；這是單 worker 本機實作，不適合多 instance。
