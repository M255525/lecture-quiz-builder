# lecture-quiz-builder — 講義出題試卷工坊

多份講義 PDF→出題審題→A/B 卷試卷→Google 表單→試題分析（2026-11-27 由 tool-scaffold 建立骨架）

- 純靜態：`index.html`（CSS）＋`data.js`（計算引擎 `window.LQB`，node 可 require）＋`app.js`（畫面）＋`watermark.js`（`TOOL_WATERMARK` 馬克老師浮水印，列印用）＋`manual.html`＋PWA。
- 本機預覽 port **8909**（`.claude/launch.json` 的 `lecture-quiz-builder`）。visitor-badge `m255525.lecturequizbuilder`（手冊 `.manual`）。
- 尚未上線。上線後在這裡記網址與日期；改版要升 `service-worker.js` 的 `CACHE_NAME` 再 push。

## 規則
- （待補）計算規則、資料來源與查證日期、自訂門檻。改了 `data.js` 跑 `node tools/test_engine.mjs`。

## 架構
- localStorage 前綴 `lqb.`：`state`、`tab`、`fold`、`fsize`、`warnSeen`、`marquee`。
- 輸入只呼叫 `refresh()`，不重繪表單（焦點才不會跑掉）；欄位 change 時**只有數值真的被修正才重繪**，否則會吃掉使用者的下一次點擊。
- 備份 JSON `app:'lecture-quiz-builder'`。測試掛鉤 `window._tool`。
- 畫風：（待設計）範本配色 `kraft` 只是起點；姊妹作的畫面要明顯不同。圖示由 `tools/make_icons.py` 產生。

## AI（BYOK）
- `ai.js`：7 家 `callLLM`＋`geminiModelFix` 複製自 `政府補助認證產生器/shop-opening-checklist/ai.js`（正本改了這裡也要改）。金鑰存 `lqb.ai`，只在這台瀏覽器。⚙「🤖 AI 設定」。
- 原則：AI 只做解說與文字，數字與判斷一律由 `data.js` 規則決定；每個 AI 功能都要有「📋 複製提示詞」（沒金鑰也能用）。

## 登入序號閘門（六件套）
- 序號表分頁「講義出題試卷工坊」，驗證打 `https://script.google.com/macros/s/AKfycbw2qz-sTKRVkVHGQZLTj73xlJdDiaHG8eNexjAN9XWMrly5BnxVcP8dC0qE3kADHeIl/exec`，請求帶 `sheet`（驗證、背景重驗、登出 release 都要帶）。**分頁要自己在試算表建好**（表頭：序號／開始日期／結束日期，選填人數限制），新部署的 Apps Script 要請使用者本人授權一次。
- `#entryGate` 開啟 fail-closed，登入後每 20 分鐘背景重驗；序號存 `lectureQuizBuilderEntrySerial`（不用 `lqb.` 前綴，清資料不登出）；⚙「🔑 登入序號」可登出；上方 `#licTop` 顯示到期日。首訪警語在第一次解鎖後才跳。
- e2e 用 `ctx.route` 假造授權回應（GOOD 有效、OLD 過期、其他查無），不碰真的試算表。上線前記得在 github-dashboard `LICENSED_REPOS` 與 AI 工具導航第 6 欄標需序號。

## 標準配備
跑馬燈（工作區公告 GAS，滑鼠移入暫停，不可關）、⚙ 常用設定（收合式：資料／顯示／關於本工具）、首訪警語＋頁面入口、`manual.html#creator` 完整版（改 `tools/manual_body.html` 後跑 `python tools/build_manual.py`，創作者區塊從賞鳥地圖範本複製）、PWA、訪客計數器、列印浮水印。

## 測試
- `node tools/test_engine.mjs`：（待補手算案例）＋亂數。
- `python tools/e2e_lqb.py [截圖資料夾]`（Playwright，自己在 port 8919 起伺服器）：標準配備（警語、跑馬燈、收合設定、關於本工具、大字、備份還原、SW、manifest、手冊創作者、列印浮水印、390px）＋主功能。
