# 事故調查與人工核准操作情境

本情境使用 INC-1001 與合成設備、維護紀錄及 SOP，檢查 AI 蒐證、來源引用及人工核准的端到端行為。

## 前置條件

啟動方式見 [README](../README.md)。健康檢查需要 domain、Ollama、chat 與 embedding 全部 ready；以 `scripts/verify.ps1 -RequireAI` 確認真實模型與向量檢索可用。Offline 或降級模式依介面標示判讀，不能列為完整 AI 驗收。

## 操作與預期結果

| 步驟 | 操作 | 預期結果 |
|---|---|---|
| 1 | 選擇 INC-1001，開始調查 | Events 顯示實際 MCP 工具與執行順序；host 檢查 allowlist、scope 與工具 budget |
| 2 | 檢查設備 telemetry、maintenance 與 SOP 引用 | 85 mTorr 可對照原始數值及文件門檻；seal issue 保持假設，缺少 verification record 時不能視為確認根因 |
| 3 | 檢查工單草稿 | 草稿保留 run 與 evidence；模型可選擇不建立草稿，此時應核對調查結果與缺少資訊 |
| 4 | 核對證據、勾選人工審查，再核准 | 獨立 operator 權限、短效一次性 token 與 domain 原子交易完成模擬工單核准及 audit；MCP 不提供核准工具 |
| 5 | 產生交接摘要 | 保留 incident IDs、原始 facts 與未結事項，不能將摘要視為事故已復原 |
| 6 | 開啟 Jaeger trace | 可追蹤 gateway、MCP、.NET 與 LLM 呼叫；測試與量測範圍見 [驗證紀錄](VALIDATION.md) |

## 結果判讀

有效的引用 ID 與正常的工具流程不代表建議語意必然正確。處置仍需由操作人員核對原始資料。模型故障、證據不足或驗證失敗時，介面須明確呈現降級狀態。

所有工單均為本機模擬資料；本專案沒有設備控制、正式企業工單介接或個人帳號授權。設計邊界見 [ADR](ADR.md)，服務故障處理見 [Runbook](RUNBOOK.md)。
