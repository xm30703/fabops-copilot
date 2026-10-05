# 面試 5 分鐘展示

展示前：健康檢查顯示 domain、Ollama、chat、embedding 都 ready；`evaluate.py --agent --require-ai` 通過；Jaeger 有 trace。若不通過，演示時明確說目前是 offline 或降級模式。

| 時間 | 操作與講法 |
|---|---|
| 0:00–0:40 | 說明問題：值班人員需要整合 telemetry、保養紀錄與 SOP。所有資料虛構，避開公司資料限制。 |
| 0:40–1:50 | 選 INC-1001，開始調查。顯示模型自主選 MCP tools 的順序；說明 host 的 allowlist／scope／budget。 |
| 1:50–2:40 | 核對 85 mTorr 和門檻；開引用 chunk；指出 seal issue 只是假設，缺 verification record，並非確認根因。 |
| 2:40–3:20 | 查看 Ticket 草稿。勾選人工審查後核准，展示 audit。說明 MCP 沒有 approve 或設備控制工具。 |
| 3:20–4:00 | 產生交接摘要，核對 incident IDs 和未結工單，不宣稱事故復原。 |
| 4:00–5:00 | 開 Jaeger trace、ADR、測試／評估報告；說明模型故障降級與下一階段正式身分、部署、品質評估。 |

預期追問：為何 MCP 不直接讓模型呼叫所有 API？如何避免重複工單？引用 ID 有效是否代表內容正確？模型不呼叫必要工具怎麼辦？SQL keyword 與 vector 分數如何校準？如何處理文件改版？公開部署還缺什麼？

練習新增一個變更：telemetry 超過 15 分鐘時只允許蒐證與人工升級。自己實作、測試並記錄 review，這會比背誦現有程式更能證明你的能力。
