# lecture-quiz-builder — 講義出題試卷工坊

多份講義 PDF→出題審題→A/B 卷試卷→Google 表單→試題分析（2026-11-27 由 tool-scaffold 建立骨架）

- 純靜態：`index.html`（CSS）＋`data.js`（計算引擎 `window.LQB`，node 可 require）＋`app.js`（畫面）＋`watermark.js`（`TOOL_WATERMARK` 馬克老師浮水印，列印用）＋`manual.html`＋PWA。
- 本機預覽 port **8909**（`.claude/launch.json` 的 `lecture-quiz-builder`）。visitor-badge `m255525.lecturequizbuilder`（手冊 `.manual`）。
- **2026-11-27 已上線** <https://m255525.github.io/lecture-quiz-builder/>（`publish.mjs`：建 repo＋push → 開 Pages → 補 master 部署規則 → workflow_dispatch）。程式牆 `REPO_META`、github-dashboard、AI 工具導航已登記。改版後升 `service-worker.js` 的 `CACHE_NAME` 再 push。

## 規則與流程
- 檔案：`data.js`（引擎，全部純函式）、`samples.js`（虛構範例講義，測試也用）、`io.js`（**複製自 `teacher-classroom-helper/io.js` 正本**，只改命名空間 `LQBIO`＋加 `readPptx`）、`pdftext.js`（`LQBPDF`：pdf.js 3.11.174 從 cdnjs 載、worker 轉 Blob、cMaps 走 jsdelivr，逐頁取字＋`renderJpeg` 給 AI 看圖）、`course-link.js`（正本在 `../course-link`，改了在那邊跑 `node sync.mjs --write`）。
- PDF 用某些字型會取出**康熙部首字**（⾥ U+2FA5 等），`pdftext.js` 與 `normKey` 都會 NFKC 轉回一般字，不然 AI 出處永遠對不到。
- 規則出題 `genRuleQuestions`：定義句（`DEF_STRONG`／`DEF_COLON`／`DEF_IS`／`DEF_TAIL`）、列舉句（`LIST_RE`）、投影片「非條列標題＋3～8 行條列」、數字句（同單位才當誘答）。**誘答只能用講義裡出現過的詞／數字，不可自己編**。`cleanText` 依「這行長度接近最長行」判斷是不是斷在句中。
- AI 出題 `aiPrompt`／`validateAiQuestions`：頁面代號 P1…，每題要 `quote` 原句，`findQuote` 正規化後比對；對不到加 `warn:['找不到出處']`、維持待審。結構錯（`checkQ`）直接丟。
- 題目欄位：`{id,type:s|m|t|f,q,opts,ans,explain,src:{doc,file,chapter,page,quote},origin:rule|ai|import|manual,status:draft|ok,diff:0-2,bloom,chapter,warn,stats}`；是非 ans A＝對 B＝錯；填空可接受答案用「／」分隔。
- 組卷：`pickByBlueprint`（只抽 status ok）、`makeVersions`（A 卷原順序；B 以後同題型群組內打亂、選項打亂，含「以上皆是」等不打亂；`perms[id][新位置]=母卷位置`）、`viewQ`／`toMaster` 互轉。印出或產生 GAS 時 `finalize()` 把試卷快照存在 `cfg.fin`，④ 只用快照對答案。
- Google 表單：`toGasCode` 產生 `.gs`（題目 `JSON.stringify` 內嵌），`FormApp.create`＋`setIsQuiz(true)`、`createChoice(text,isCorrect)`、`setPoints`、回饋、`setDestination` 回覆試算表；多卷＝多份表單。**填空題 Apps Script 不能設標準答案**。測試用假 FormApp 執行過。
- 作答解析 `parseResponses`：Google 表單（欄名「N. 題幹」、值是選項文字、多選「, 」連接）、作答表（學號｜姓名｜卷別｜1…n）、小幫手成績檔（✔/✘（字母））。卷別：欄位 → ④ 選單 → 檔名「A卷」。
- 試題分析 `analyze`：P、D（高低分組各 27%，`Math.round(N*.27)`，同分維持原順序）、點二系列（母體標準差、未校正）、KR-20、誘答（高分組選比低分組多 ≥ ceil(g×.15) 才標）。門檻：P>.9 太簡單、<.2 太難、D<.2 偏低、D<0 答案可能有誤。測試有 6 人×3 題手算案例。
- **作答名單只放 `V.resp`（記憶體）**，題庫只存統計；成績寫回 course-link `results.quiz`（百分制）。

## 架構
- localStorage 前綴 `lqb.`：`docs`（講義文字）、`bank`（題庫）、`cfg`（試卷、出題、GAS 設定、`fin` 定案快照、`mk` 課程專案 id）、`tab`、`fold`、`fsize`、`warnSeen`、`marquee`、`ai`。空間不足會跳一次提醒。
- 每個分頁各自 `panel(name)` 重繪；`data-bind="paper.title"` 這類路徑綁 `S.cfg`，input 只存不重繪（焦點不跑），change 才視需要重繪。列印用 `#printArea`＋`body.printing`。
- 備份 JSON `app:'lecture-quiz-builder'`。測試掛鉤 `window._tool`。
- 畫風：油印考卷＋紅筆批改（米黃橫線紙、左側紅色雙線、藍黑墨水、紅色「卷」印章、已審蓋紅章）。圖示由 `tools/make_icons.py` 產生。

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
- `node tools/test_engine.mjs`：147 項（範例講義擷取、規則出題、AI 驗證、組卷 A/B 對照、GAS 用假 FormApp 執行、三種作答格式、手算試題分析）。
- `python tools/e2e_lqb.py [截圖資料夾]`（Playwright，自己在 port 8919 起伺服器）：標準配備（警語、跑馬燈、收合設定、關於本工具、大字、備份還原、SW、manifest、手冊創作者、列印浮水印、390px）＋主功能（Chromium 印兩份中文 PDF 上傳 → 規則出題 → 貼回 AI 回覆 → 修改審題 → 細目表抽題 → A/B 卷列印 → GAS 語法 → 模擬作答分析 → 統計寫回 → 備份還原）。pdf.js 從 CDN 載，要有網路。
