# AI-assisted Development Log

這份文件記錄 AI 在開發中產生的內容與人工需要審查的事項。**沒有宣稱你已審查、寫出或精通任何尚未親自檢查的程式。**

| 工作 | AI 協助 | 驗證／人工責任 |
|---|---|---|
| 職缺映射 | 選製造事故應變 domain，建立能力對應表 | 使用者依職缺要求將前端調整為 Angular；後端為 .NET／PostgreSQL／Ollama |
| 程式骨架 | API、Angular、Python Agent、MCP adapter | 實際通過的檢查記於 VALIDATION；人工 review 待完成 |
| 安全邊界 | allowlist、scope、核准分離、token／idempotency | 工具拒絕、live DB 核准／重放拒絕與真實 UI 核准均已驗收 |
| AI-generated tests | pytest、xUnit、Playwright、live evaluation、k6 | 看測試是否會捕捉真正錯誤；不能因測試同樣由 AI 產生就當作充分證明 |
| 文件 | README、架構、ADR、runbook、demo | 對照程式與實跑行為，修改你不同意的決策 |
| 限制處理 | 明確標示 offline fallback 與驗證缺口 | 不把未跑的模型／CI／部署說成完成 |
| 實跑修正 | 修復 PowerShell 5.1 相容性、HTTP connection pool、OTLP trace 路徑 | 直接用 Windows PowerShell 啟停、k6 與 Jaeger API 驗收 |
| 模型品質 | 限制引用 enum、拒絕重複步驟、過濾 ranking metadata、改用 qwen2.5:7b | 早期 3b 曾產生無效引用；7b 曾反覆呼叫工具，新增 evidence-complete 收斂及回歸測試 |
| Angular 遷移 | 四個 standalone components、Router、Signals store、typed HttpClient、Reactive Forms、CLI build | 依最新職缺需求遷移；修正交接摘要為 POST 與搜尋初始值 race，新增 payload／route／review reset／錯誤恢復／文字 escaping 驗證；人工 review 待完成 |
| Git／CI/CD | Dockerfiles、GitHub Actions、部署 gate、rollback、runner 啟動腳本 | 實跑 Linux build、Windows deploy、故障自動回復與手動 rollback；修復跨平台 lockfile 與 Piscina advisory；GitHub 遠端執行需另外驗收 |
| 本機專案規劃與搬移 | 固定 source/runtime、集中 paths.ps1、每個 checkout 自己的 venv、固定 compose name | 保留 .git／keys／模型／DB；核對 development 26 tickets/11 audits、staging 13 tickets/1 audit；新路徑啟動、18 pytest、真實 AI 及 browser 驗收 |
| 初次搜尋輸入 race | native disabled host attribute 與 Reactive Forms 就緒流程 | 搬移驗收捕捉舊有偶發覆蓋輸入；新增十次立即輸入的回歸，四個 mock 與真實 browser 修正後通過 |

人工 code review 建議依序完成：

- [ ] 讀懂 Angular 的 component→store→ApiService 資料流，解釋 Signals 如何更新畫面，以及換事故時為何要重設人工審查狀態。
- [ ] 讀懂 `agent/core.py` 的工具 loop，解釋模型決定與 host 強制規則的界線。
- [ ] 在測試中故意暴露 `approve_ticket` 或移除 allowlist，確認拒絕測試會失敗，再恢復。
- [ ] 讀懂 `Repository.Approve` 的單次 token 原子 UPDATE 與 audit transaction；跑 live token replay 測試。
- [ ] 找一個模型錯誤案例，保留 bad answer、修改 prompt／validator，再比較評估報告。
- [ ] 親自新增「sensor offline」或「telemetry stale」情境、SOP、測試與 ADR。
- [ ] 練習不看文件說明資料流、一次事故排查、RAG 取捨與降級模式。

履歷可在親自驗收後寫：「以 AI 輔助開發製造事故應變作品，使用 Angular、.NET、PostgreSQL／pgvector 與 MCP；透過測試及人工審查驗證工具權限、來源引用與工單核准流程。」不要把作品等同工作中的正式製造系統，也不要聲稱產生了尚未量測的效率提升百分比。
