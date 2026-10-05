# Angular 前端導覽

本作品的前端已依職缺要求改為 Angular／TypeScript。四個頁面保留同一組 gateway API 與合成 domain 資料，可展示 typed API integration、依賴注入、Signals 狀態、元件分工與瀏覽器驗收。

## 環境與啟動

目前鎖定 Angular framework 21.2.25、CLI／build 21.2.24、TypeScript 5.9.3。這台電腦的 Node 24.13.0 符合 Angular 21 的需求；選版依據為 [官方版本相容表](https://angular.dev/reference/versions)。套件依賴由 package-lock.json 鎖定，不需要全域安裝 Angular CLI。

完整本機環境依 README 的 bootstrap 啟動，瀏覽 `http://127.0.0.1:4317`。Angular CLI 產出靜態 web/dist，由原 Python gateway 提供；SSR 不在這次 MVP 範圍。

開發前端時，先啟動後端，再在 web 資料夾執行：

```powershell
npm.cmd ci
npm.cmd run dev
```

開發伺服器位於 `http://127.0.0.1:4200`。proxy.conf.json 將 /api/** 轉送至 4317，並使用 gateway 的本機 Origin；production 由同一個 gateway 提供 UI 與 API。前端沒有 service／operator key，proxy 也沒有放入任何秘密。

```powershell
npm.cmd run build
npm.cmd run test:e2e
```

一般瀏覽器測試使用 mock API 契約；完整 AI／DB 驗證仍使用專案根目錄的 scripts/verify.ps1 -RequireAI。真實測試會核准本機模擬工單。

另外可單獨驗證開發 proxy（需後端已啟動）：

```powershell
$env:FABOPS_PROXY_LIVE='1'
npx.cmd playwright test tests/dev-proxy.spec.ts
Remove-Item Env:FABOPS_PROXY_LIVE
```

此測試由 Playwright 管理 Angular dev server 的啟停，以真實瀏覽器從 4200 發出搜尋 POST，確認轉送成功與 hybrid-pgvector 回應。

## 元件與狀態

| 檔案 | 責任 |
|---|---|
| web/src/main.ts | bootstrapApplication、HttpClient 與 Router providers |
| web/src/app/app.component.* | 共用導覽、服務狀態、錯誤訊息與版面 |
| web/src/app/app.routes.ts | operations／knowledge／handover／audit 四個路由 |
| web/src/app/features/operations.component.* | telemetry、調查結果、引用定位、草稿與人工核准 |
| web/src/app/features/knowledge.component.ts | Typed Reactive Forms 知識查詢、來源與無結果情況 |
| web/src/app/features/handover.component.ts | 交接摘要、incident IDs、原始 facts |
| web/src/app/features/audit.component.ts | 模擬工單狀態與稽核紀錄 |
| web/src/app/api.service.ts | 注入 HttpClient、型別化 API 方法與一致的錯誤轉換 |
| web/src/app/fabops.store.ts | signal／computed 狀態、busy guard、調查與核准流程 |
| web/src/app/models.ts | TypeScript DTO；伺服器仍負責真正的輸入與權限驗證 |

元件使用 OnPush 與 Signals，異步請求完成後以 signal.set／update 通知畫面，不依賴 Zone.js。HTTP Observable 透過 firstValueFrom 等待一次 API 結果。

搜尋表單使用 non-nullable FormControl／FormGroup、required／maxLength validators，valueChanges 透過 takeUntilDestroyed 自動清理訂閱。InitiallyDisabledDirective 在 DOM 建立時就加上 native disabled，避免 FormControlName 尚未綁定前的輸入空窗；afterNextRender 完成後透過 control.enable() 移除 disabled。回歸測試連續切頁十次、立即輸入，直接核對 POST payload 與 textbox 值。

切換功能頁面保留調查結果與審查勾選；切換另一個事故或開始新調查會清除勾選。核准後更新畫面、工單與 audit。引用按鈕只定位來源 DOM，不改變目前 route。

Router 採用 hash location，例如 /#/knowledge，可直接開啟與重新整理；這讓目前 static gateway 不需新增 SPA fallback。若未來改用 path routes，必須一起設定伺服器 index.html fallback。

## 面試練習

先用自己的話解釋「元件→store→ApiService→gateway」與 signal/computed 的關係，再親自加一個 telemetry 過期警示與瀏覽器測試。程式由 AI 協助遷移，人工 review 尚待你完成；AI Dev Log 有建議清單。

官方參考：[Signals](https://angular.dev/guide/signals)、[HttpClient](https://angular.dev/guide/http/setup)、[Router](https://angular.dev/guide/routing)、[CLI proxy](https://angular.dev/tools/cli/serve)。
