# FabOps 從零到面試教材

用瀏覽器直接開啟 `index.html`。這是繁體中文離線教材，不必啟動 Docker、Ollama、API 或資料庫。

15 課由工作情境、RA／SA／SD、全端與資料，進入 LLM、Agent、MCP、RAG、技能與編排，再到權限、測試、可觀測性、CI/CD／LLMOps、架構審查與面試。每課有白話比喻、流程圖、程式片段、測驗、自寫回答與參考答案；面試區另有 30 題追問。

互動中的模型順序、檢索匹配、token 時間與部署版本均為教學預設，沒有呼叫實際服務，也不新增工單。課程會分開標示目前程式事實、2026-10-05 既有實跑紀錄、教學模擬與未實作能力。閱讀與自評不等同能力認證或完成人工 review。

閱讀標記、選擇與回答只存在瀏覽器 localStorage；可能受瀏覽器或檔案位置限制。清除按鈕只清除教材紀錄。外部官方文件及 GitHub 原始碼連結需要網路；FabOps repository 已公開，可匿名閱讀。

原始教材在 `src/`。使用已安裝 Node.js 從任意工作目錄重建：

```powershell
node C:\Dev\fabops-copilot\docs\learning\build.mjs
```

不需要 npm 套件。Builder 只讀取 Git HEAD、明列的程式／文件片段與合成 SOP，寫入同目錄 `index.html`。不讀 `.env`、runtime、模型、憑證或原始日誌。Source/runtime 規劃維持不變。

官方概念來源列於教材首頁，2026-10-08 查閱。最新教材驗證結果記於 `docs/VALIDATION.md`。
