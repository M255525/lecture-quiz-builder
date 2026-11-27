// node tools/test_engine.mjs
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const M = require('../data.js');
const {SAMPLES} = require('../samples.js');
let n = 0, bad = 0;
const near = (a, b, e = 1e-4) => a === b || Math.abs(a - b) <= e * Math.max(1, Math.abs(b));
function eq(name, got, want){ n++; const ok = typeof want === 'number' ? near(got, want) : JSON.stringify(got) === JSON.stringify(want); if(!ok){ bad++; console.log('✗', name, '\n  得到', JSON.stringify(got), '\n  應為', JSON.stringify(want)); } }
function ok(name, cond, extra){ n++; if(!cond){ bad++; console.log('✗', name, extra === undefined ? '' : JSON.stringify(extra)); } }

const pages = [];
SAMPLES.forEach((d, di) => d.pages.forEach((t, pi) => pages.push({doc:'d' + di, file:d.file, chapter:d.chapter, page:pi + 1, text:t})));

// ── 文字整理 ──
eq('斷行接回', M.cleanText('顧客旅程是指顧客從認識\n品牌到回購的經驗。\n12\n下一段'), '顧客旅程是指顧客從認識品牌到回購的經驗。\n下一段');
eq('斷句', M.splitSentences('甲是乙。丙是丁；戊'), ['甲是乙。', '丙是丁；', '戊']);

// ── 事實擷取 ──
const facts = [].concat(...pages.map(M.extractFacts));
const defs = facts.filter(f => f.kind === 'def').map(f => f.term);
['顧客旅程', '服務接觸點', '服務補救', '淨推薦值', '聽眾分析', '電梯簡報', '結論先行', '視覺輔助'].forEach(t => ok('定義句抓到 ' + t, defs.includes(t), defs));
const lists = facts.filter(f => f.kind === 'list');
const steps = lists.find(f => f.head === '處理抱怨的步驟');
ok('列舉句：處理抱怨的步驟', steps && steps.items.join('|') === '傾聽|道歉|提出方案|追蹤', steps);
const body = lists.find(f => f.head === '肢體語言');
ok('列舉句：肢體語言 4 項', body && body.items.length === 4, body);
const dims = lists.find(f => f.head === '常見的服務品質構面');
ok('投影片條列：服務品質構面 5 項', dims && dims.items.length === 5, lists.map(l => l.head));
const nums = facts.filter(f => f.kind === 'num');
ok('數字句：24 小時', nums.some(f => f.value === '24' && f.unit === '小時'));
ok('頁碼頁不出題', !facts.some(f => f.src.page === 4));
ok('出處：檔名頁碼', facts.every(f => f.src.file && f.src.page >= 1 && f.src.quote));

// ── 規則出題 ──
const g = M.genRuleQuestions(pages, {seed:3});
ok('規則出題 ≥ 12 題', g.items.length >= 12, g.items.length);
['s', 'm', 't', 'f'].forEach(t => ok('有題型 ' + t, g.items.some(q => q.type === t)));
g.items.forEach((q, i) => {
  ok('#' + i + ' 結構正確', M.checkQ(q).length === 0, [q, M.checkQ(q)]);
  ok('#' + i + ' 有出處', q.src && q.src.quote && q.src.page, q);
  ok('#' + i + ' 待審', q.status === 'draft' && q.origin === 'rule');
  if(q.type === 's'){ const right = q.opts[M.LETTERS.indexOf(q.ans)]; ok('#' + i + ' 誘答不等於答案', q.opts.filter(o => M.normKey(o) === M.normKey(right)).length === 1, q); }
});
// 數字題的誘答選項只用講義裡出現過的數字
g.items.filter(q => /括號內應填入/.test(q.q)).forEach(q => q.opts.forEach(o => ok('數字選項來自講義：' + o, pages.some(p => p.text.replace(/\s/g, '').includes(o.replace(/\s/g, ''))), q)));
eq('種子相同結果相同', JSON.stringify(M.genRuleQuestions(pages, {seed:3}).items.map(q => [q.q, q.opts, q.ans])), JSON.stringify(g.items.map(q => [q.q, q.opts, q.ans])));
const only = M.genRuleQuestions(pages, {seed:1, types:{s:1}});
ok('只出單選', only.items.length > 0 && only.items.every(q => q.type === 's'), only.items.map(q => q.type));

// ── 去重 ──
const d1 = M.dedupe(g.items, [Object.assign({}, g.items[0], {id:'x', q:g.items[0].q + ' '})]);
eq('去重：只差空白算重複', d1.dup, 1);

// ── AI 回覆驗證 ──
const batch = M.chunkPages(pages, 9000)[0];
ok('切批', batch.length >= 3);
ok('提示詞含頁面代號與禁止模仿', /\[P1｜/.test(M.aiPrompt(batch, {n:5})) && /不可以模仿真實人物/.test(M.aiPrompt(batch, {n:5})));
const aiText = '```json\n{"questions":[' +
  '{"type":"s","q":"顧客抱怨後，第一次回覆最好在多久內？","opts":["12 小時","24 小時","3 天","1 週"],"ans":"B","page":"P2","quote":"企業最好在 24 小時內給予第一次回覆","bloom":"記憶","diff":"易"},' +
  '{"type":"t","q":"淨推薦值只看願意推薦的比例。","ans":"錯","page":"P3","quote":"願意推薦的顧客比例減去不願推薦的顧客比例","bloom":"理解","diff":"中"},' +
  '{"type":"s","q":"編造的題目","opts":["甲","乙","丙","丁"],"ans":"A","page":"P1","quote":"這句話講義裡完全沒有出現過喔","bloom":"記憶","diff":"易"},' +
  '{"type":"s","q":"答案錯誤的題","opts":["甲","乙"],"ans":"E","page":"P1","quote":"顧客旅程是指"},' +
  '{"type":"m","q":"哪些是肢體語言？","opts":["A. 眼神","B. 手勢","C. 字型"],"ans":"A,B","quote":"肢體語言包括眼神、手勢、站姿、表情"}]}\n```';
const arr = M.parseAiJson(aiText);
eq('解析 AI JSON（含 ``` 包裝）', arr.length, 5);
const v = M.validateAiQuestions(arr, batch);
eq('結構錯的被擋', v.bad, 1);
eq('通過 4 題', v.items.length, 4);
eq('第 1 題頁碼', v.items[0].src.page, 2);
eq('是非「錯」→ B', v.items[1].ans, 'B');
ok('假出處加警告', v.items[2].warn.includes('找不到出處'), v.items[2]);
ok('真出處沒警告', !v.items[0].warn.length);
eq('多選 A,B → AB、選項去掉字母', [v.items[3].ans, v.items[3].opts[0]], ['AB', '眼神']);
ok('引句跨頁也找得到正確頁', v.items[3].src.file === '範例講義_簡報表達技巧.pdf', v.items[3].src);

// ── 組卷 ──
const bank = g.items.map(q => Object.assign({}, q, {status:'ok'}));
const chs = [...new Set(bank.map(q => q.chapter))];
const pick = M.pickByBlueprint(bank, chs.map(c => ({chapter:c, bloom:'記憶', n:4})).concat([{chapter:chs[0], bloom:'分析', n:2}]), {seed:9});
eq('細目表抽 8 題', pick.ids.length, 8);
eq('不足的格子回報', pick.short, [{chapter:chs[0], bloom:'分析', want:2, got:0}]);
eq('種子相同抽題相同', M.pickByBlueprint(bank, chs.map(c => ({chapter:c, bloom:'記憶', n:4})), {seed:9}).ids, pick.ids);
ok('只抽已審', M.pickByBlueprint(g.items, [{chapter:chs[0], n:5}]).ids.length === 0);
const paper = pick.ids.map(id => bank.find(q => q.id === id));
const vers = M.makeVersions(paper, 2, {seed:5});
eq('A 卷維持母卷順序', vers[0].order, paper.map(q => q.id));
ok('B 卷題目是同一批', vers[1].order.slice().sort().join() === vers[0].order.slice().sort().join());
let changed = 0;
paper.forEach(q => {
  const vb = M.viewQ(q, vers[1]);
  ok('B 卷答案對應同一個選項文字：' + q.q.slice(0, 10), q.type === 't' || q.type === 'f' || vb.ans.split('').map(L => vb.opts[M.LETTERS.indexOf(L)]).sort().join('|') === q.ans.split('').map(L => q.opts[M.LETTERS.indexOf(L)]).sort().join('|'), [q, vb]);
  eq('B 卷字母轉回母卷', M.toMaster(q, vers[1], vb.ans), q.ans);
  if(vb.opts.join() !== q.opts.join()) changed++;
});
ok('B 卷有打亂選項', changed > 0);
const lockQ = M.mkQ({type:'s', q:'鎖定', opts:['甲', '乙', '丙', '以上皆是'], ans:'D'});
eq('有「以上皆是」不打亂', M.makeVersions([lockQ], 3, {seed:1})[2].perms[lockQ.id], [0, 1, 2, 3]);
const bp = M.blueprintTable(paper);
eq('細目表統計章節數', bp.chapters.length, 2);

// ── Google 表單 GAS ──
const weird = M.mkQ({type:'s', q:'含"引號"、\'單引號\'、反斜線\\ 與\n換行', opts:['a"b', 'c\\d', "e'f", '</script>'], ans:'C', src:{file:'x.pdf', page:2, quote:'q'}});
const fill = M.mkQ({type:'f', q:'（　）是指甲。', ans:'乙'});
const tf = M.mkQ({type:'t', q:'甲是乙。', ans:'B'});
const multi = M.mkQ({type:'m', q:'多選', opts:['1', '2', '3'], ans:'AC'});
const gitems = [tf, weird, multi, fill];
const gv = M.makeVersions(gitems, 2, {seed:2});
// 假的 FormApp：記下每個呼叫
function runGas(code){
  let fn; try{ fn = new Function('FormApp', 'SpreadsheetApp', 'Logger', 'Utilities', code + '\nreturn createQuiz;'); }catch(e){ return {err:e}; }
  const made = [], logs = [];
  const chain = (o) => new Proxy(o, {get:(t, k) => k in t ? t[k] : (...a) => { (t.calls = t.calls || []).push([k, ...a]); return t.self; }});
  function item(kind){ const it = {kind, title:'', points:0, choices:[], req:false, fb:{}, help:'', values:null, valid:null};
    it.self = it;
    it.setTitle = t => { it.title = t; return it; }; it.setPoints = p => { it.points = p; return it; }; it.setRequired = r => { it.req = r; return it; };
    it.setHelpText = h => { it.help = h; return it; }; it.setChoiceValues = v => { it.values = v; return it; }; it.setValidation = v => { it.valid = v; return it; };
    it.createChoice = (v, c) => ({v, c}); it.setChoices = c => { it.choices = c; return it; }; it.setFeedbackForCorrect = f => { it.fb.ok = f; return it; }; it.setFeedbackForIncorrect = f => { it.fb.no = f; return it; }; it.setGeneralFeedback = f => { it.fb.g = f; return it; };
    it.setImage = b => { it.img = b; return it; }; it.setAlignment = () => it; return it; }
  function validation(){ const v = {rules:[]}; const add = (k) => (...a) => { v.rules.push([k, ...a]); return v; };
    ['requireNumber', 'requireTextIsEmail', 'requireTextLengthLessThanOrEqualTo', 'requireTextMatchesPattern', 'setHelpText'].forEach(k => v[k] = add(k)); v.build = () => v.rules; return v; }
  const FA = {create:(t) => { const f = {title:t, items:[], quiz:false, dest:null, opt:{}}; made.push(f);
      ['setIsQuiz', 'setDescription', 'setCollectEmail', 'setShuffleQuestions', 'setProgressBar', 'setConfirmationMessage', 'setLimitOneResponsePerUser', 'setAllowResponseEdits'].forEach(m => { f[m] = (x) => { f.opt[m] = x; if(m === 'setIsQuiz') f.quiz = x; return f; }; });
      const adder = (kind) => () => { const i = item(kind); f.items.push(i); return i; };
      f.addTextItem = adder('text'); f.addParagraphTextItem = adder('para'); f.addMultipleChoiceItem = adder('mc'); f.addCheckboxItem = adder('cb'); f.addListItem = adder('dd'); f.addDateItem = adder('date');
      f.addPageBreakItem = adder('page'); f.addSectionHeaderItem = adder('header'); f.addImageItem = adder('image');
      f.getPublishedUrl = () => 'https://forms/x'; f.getEditUrl = () => 'https://forms/e'; f.setDestination = (t, id) => { f.dest = id; return f; }; return f; },
    createFeedback:() => { const b = {t:''}; b.setText = (t) => { b.t = t; return b; }; b.build = () => b.t; return b; },
    createTextValidation:validation, createParagraphTextValidation:validation, DestinationType:{SPREADSHEET:'S'}, Alignment:{CENTER:'C'}};
  const SA = {create:() => ({getId:() => 'ss1', getUrl:() => 'https://sheet'})};
  const UT = {base64Decode:(b) => 'bytes:' + b, newBlob:(d, m, n) => ({d, m, n})};
  fn(FA, SA, {log:(m) => logs.push(m)}, UT)();
  return {made, logs};
}
const paperInfo = {title:'期中測驗', desc:'說明', cls:'行銷實務班', minutes:30};
const pts = {s:2, m:3, t:1, f:2};
const code = M.toGasCode(paperInfo, gitems, gv, pts, {feedback:true, style:'formal', bannerB64:'QUJD'});
let g1 = runGas(code);
ok('GAS 程式碼語法正確、可執行', !g1.err, g1.err);
const made = g1.made;
eq('建兩份表單（A、B 卷）', made.map(f => f.title), ['期中測驗（A 卷）', '期中測驗（B 卷）']);
ok('設為測驗', made.every(f => f.quiz));
const A = made[0].items;
eq('正式考試：橫幅圖片在最前面', [A[0].kind, A[0].img.d, A[0].img.m], ['image', 'bytes:QUJD', 'image/png']);
eq('學號、姓名必填', [A[1].title, A[1].req, A[2].title], ['學號', true, '姓名']);
const qs = A.filter(i => /^\d+\. /.test(i.title));
eq('四題', qs.length, 4);
eq('正式考試：每大題一頁（是非、單選、多選、填空）', A.filter(i => i.kind === 'page').map(i => i.title), ['一、是非題', '二、單選題', '三、多選題', '四、填空題']);
ok('大題說明有配分', /每題 2 分，共 1 題/.test(A.find(i => i.title === '二、單選題').help));
const sq = qs.find(i => i.title.indexOf('引號') >= 0);
eq('題號格式：1. 題幹（2 分）＋特殊字元原樣', sq.title, '2. ' + weird.q + '（2 分）');
eq('單選：正確答案是第 3 個', sq.choices.map(c => c.c), [false, false, true, false]);
eq('單選：選項原樣', sq.choices.map(c => c.v), weird.opts);
eq('填空：文字題、配分 2', [qs[3].kind, qs[3].points], ['text', 2]);
eq('是非：錯是正確', [qs[0].kind, qs[0].choices.map(c => c.c)], ['mc', [false, true]]);
eq('多選：核取方塊、AC、3 分', [qs[2].kind, qs[2].choices.map(c => c.c), qs[2].points], ['cb', [true, false, true], 3]);
ok('回饋含出處頁碼', /第 2 頁/.test(sq.fb.ok), sq.fb);
ok('說明含題數滿分時間與自訂說明', /共 4 題，滿分 8 分，作答時間 30 分鐘/.test(made[0].opt.setDescription) && /說明$/.test(made[0].opt.setDescription), made[0].opt.setDescription);
eq('正式考試：完成訊息、沒有進度列', [made[0].opt.setConfirmationMessage, made[0].opt.setProgressBar], [M.FORM_STYLES[0].confirm, false]);
ok('B 卷的正確選項仍是同一個文字', (() => { const B = made[1].items.find(i => i.title.indexOf(weird.q) >= 0); return B.choices.find(c => c.c).v === "e'f"; })());
ok('建了回覆試算表', made.every(f => f.dest === 'ss1') && /回覆試算表/.test(g1.logs[0]));
ok('程式碼註明主題顏色建議', /🎨 自訂主題：顏色 #1F2E4A/.test(code));

// 其他風格
M.FORM_STYLES.forEach(st => {
  const r = runGas(M.toGasCode(paperInfo, gitems, [gv[0]], pts, {style:st.id, bannerB64:'QUJD'}));
  ok('風格「' + st.name + '」可執行', !r.err && r.made.length === 1, r.err);
  if(r.err) return;
  const it = r.made[0].items;
  eq('風格「' + st.name + '」題目數', it.filter(i => /^\d+\. |^第 \d+ 題：/.test(i.title)).length, 4);
  eq('風格「' + st.name + '」橫幅', it[0].kind === 'image', !!st.banner);
  eq('風格「' + st.name + '」進度列', r.made[0].opt.setProgressBar, st.progress);
});
const gm = runGas(M.toGasCode(paperInfo, gitems, [gv[0]], pts, {style:'game'})).made[0];
ok('闖關：第 1 關、鼓勵文字、進度列', gm.items.some(i => i.kind === 'page' && i.title === '第 1 關：是非題' && /加油/.test(i.help)) && gm.opt.setProgressBar === true);
ok('沒給橫幅圖就不放', !gm.items.some(i => i.kind === 'image'));
const qz = runGas(M.toGasCode(paperInfo, gitems, [gv[0]], pts, {style:'quiz'})).made[0];
ok('課堂小測驗：大題標題同一頁（不換頁）', qz.items.some(i => i.kind === 'header') && !qz.items.some(i => i.kind === 'page'));
const pl = runGas(M.toGasCode(paperInfo, gitems, [gv[0]], pts, {style:'plain'})).made[0];
ok('極簡：沒有分段', !pl.items.some(i => i.kind === 'page' || i.kind === 'header'));
const many = Array.from({length:12}, (_, i) => M.mkQ({id:'z' + i, type:'s', q:'題' + i, opts:['甲', '乙'], ans:'A'}));
const ge = runGas(M.toGasCode(paperInfo, many, M.makeVersions(many, 1), pts, {style:'gentle'})).made[0];
eq('溫和易讀：每 5 題一頁', ge.items.filter(i => i.kind === 'page').map(i => i.title), ['第 1 部分（第 1～5 題）', '第 2 部分（第 6～10 題）', '第 3 部分（第 11～12 題）']);
const ov = runGas(M.toGasCode(paperInfo, gitems, [gv[0]], pts, {style:'formal', sec:'none', progress:true, confirm:'自訂訊息'})).made[0];
ok('可覆寫：不分段、進度列、完成訊息', !ov.items.some(i => i.kind === 'page') && ov.opt.setProgressBar === true && ov.opt.setConfirmationMessage === '自訂訊息');

// 自訂欄位與條件
const fields = [
  {label:'班級', type:'dd', opts:'甲班\n乙班\n', req:1},
  {label:'座號', type:'text', req:1, valid:'num'},
  {label:'Email', type:'text', valid:'email'},
  {label:'手機', type:'text', valid:'regex', arg:'^09\\d{8}$', help:'09 開頭'},
  {label:'心得', type:'para', valid:'len', arg:'200'},
  {label:'日期', type:'date'},
  {label:'興趣', type:'cb', opts:'閱讀\n運動'},
  {label:'  ', type:'text'}
];
eq('欄位檢查：沒問題的', M.checkFields(fields.slice(0, 7)), []);
ok('欄位檢查：選項不足、重複、數字開頭、規則錯', M.checkFields([{label:'A', type:'mc', opts:'只有一個'}, {label:'A'}, {label:'1. 班級'}, {label:'R', valid:'regex', arg:'('}]).length === 4);
const fr = runGas(M.toGasCode(paperInfo, gitems, [gv[0]], pts, {style:'plain', fields:fields, once:true, edit:true, askId:false})).made[0];
const fi = fr.items;
eq('沒勾學號就不放；自訂欄位依序（空名稱略過）', fi.slice(0, 8).map(i => i.title), ['姓名', '班級', '座號', 'Email', '手機', '心得', '日期', '興趣']);
eq('下拉選單選項', [fi[1].kind, fi[1].values, fi[1].req], ['dd', ['甲班', '乙班'], true]);
eq('數字驗證', fi[2].valid, [['requireNumber'], ['setHelpText', '請填數字']]);
eq('Email 驗證', fi[3].valid[0], ['requireTextIsEmail']);
eq('格式驗證＋說明', [fi[4].valid[0], fi[4].help], [['requireTextMatchesPattern', '^09\\d{8}$'], '09 開頭']);
eq('段落字數上限', [fi[5].kind, fi[5].valid[0]], ['para', ['requireTextLengthLessThanOrEqualTo', 200]]);
eq('日期、核取方塊', [fi[6].kind, fi[7].kind, fi[7].values], ['date', 'cb', ['閱讀', '運動']]);
eq('條件：每人限填一次、可修改答案', [fr.opt.setLimitOneResponsePerUser, fr.opt.setAllowResponseEdits], [true, true]);
// 回覆檔：自訂欄位不會被當成題目；第 N 題：格式也認得
const fvv = M.makeVersions(gitems, 1);
const cnCode = M.gasData(paperInfo, gitems, fvv, pts, {style:'formal'});
ok('題目標題都以題號開頭（回覆檔才對得回去）', cnCode.forms[0].sections.every(s => s.items.every(q => /^\d+\. /.test(q.title))));

// ── 作答解析 ──
const pv = M.makeVersions(paper, 2, {seed:5});
const ctx = {items:paper, versions:pv};
// 一般作答表：學號｜姓名｜卷別｜1…n，填各卷上的字母
const rowB = ['S1', '王小明', 'B'], rowA = ['S2', '李小華', 'A'];
pv[1].order.forEach(id => { const q = paper.find(x => x.id === id); const vq = M.viewQ(q, pv[1]); rowB.push(q.type === 't' ? (q.ans === 'A' ? '○' : '✕') : q.type === 'f' ? q.ans : vq.ans); });
pv[0].order.forEach(() => rowA.push(''));
const head = ['學號', '姓名', '卷別'].concat(paper.map((_, i) => String(i + 1)));
const pr = M.parseResponses([head, rowB, rowA], ctx);
eq('作答表 2 人', pr.students.length, 2);
ok('B 卷全對（轉回母卷）', paper.every(q => M.isRight(q, pr.students[0].answers[q.id])), pr.students[0]);
ok('空白作答算錯', paper.every(q => !M.isRight(q, pr.students[1].answers[q.id])));
// Google 表單回覆：欄位「1. 題幹」、值是選項文字
const gq = [M.mkQ({id:'g1', type:'s', q:'甲？', opts:['紅色', '藍色', '綠色'], ans:'B'}), M.mkQ({id:'g2', type:'m', q:'乙？', opts:['貓, 狗', '鳥', '魚'], ans:'AC'}), M.mkQ({id:'g3', type:'t', q:'丙。', ans:'A'}), M.mkQ({id:'g4', type:'f', q:'丁', ans:'台北／臺北'})];
const gvv = M.makeVersions(gq, 1);
const gr = M.parseResponses([['時間戳記', '分數', '學號', '姓名', '1. 甲？', '2. 乙？', '3. 丙。', '4. 丁'], ['2026/11/27', '7 / 8', '="0012"', '陳同學', '藍色', '貓, 狗, 魚', '○ 對', '臺北']], {items:gq, versions:gvv});
eq('Google 表單格式', gr.format, 'Google 表單回覆');
eq('學號保留前導 0', gr.students[0].sid, '0012');
eq('Google 表單答案轉字母', [gr.students[0].answers.g1, gr.students[0].answers.g2, gr.students[0].answers.g3], ['B', 'AC', 'A']);
ok('填空題多個可接受答案', M.isRight(gq[3], gr.students[0].answers.g4));
// 小幫手成績檔
const tr = M.parseResponses([['名次', '學號', '姓名', '甲？', '乙？', '丙。', '丁'], ['1', 'A1', '林', '✔ 答對（B）', '✘ 答錯（B）', '未作答', '✔ 答對']], {items:gq, versions:gvv});
eq('小幫手成績檔', tr.format, '小幫手成績檔');
eq('小幫手：答對／答錯選項', [tr.students[0].answers.g1, tr.students[0].answers.g2, tr.students[0].answers.g3], ['B', 'B', '']);
ok('沒有題目欄給警告', M.parseResponses([['學號', '姓名'], ['1', '2']], ctx).warn.length === 1);

// ── 試題分析：6 人 × 3 題手算 ──
const iq = [1, 2, 3].map(i => M.mkQ({id:'i' + i, type:'s', q:'題' + i, opts:['甲', '乙', '丙', '丁'], ans:'A'}));
const pat = [[1, 1, 1], [1, 1, 0], [1, 0, 1], [1, 1, 0], [0, 0, 1], [0, 0, 0]];
const wrongPick = ['B', 'B', 'C'];
const st = pat.map((p, s) => ({sid:'S' + s, name:'', ver:'A', answers:{i1:p[0] ? 'A' : wrongPick[s % 3], i2:p[1] ? 'A' : 'B', i3:p[2] ? 'A' : 'C'}}));
const an = M.analyze(iq, st, {s:1});
eq('N', an.N, 6);
eq('平均 10/6', an.meanRaw, 10 / 6);
eq('KR-20 = 0.28125', an.kr20, .28125);
eq('高低分組各 2 人', an.g, 2);
eq('第1題 P', an.items[0].P, 4 / 6);
eq('第1題 D', an.items[0].D, 1);
eq('第3題 D', an.items[2].D, 0);
eq('第1題點二系列 0.875', an.items[0].rpb, .875);
eq('第3題點二系列 0.35355', an.items[2].rpb, .353553);
eq('第2題選 B 的人數', an.items[1].dist.find(d => d.L === 'B').all, 3);
ok('第3題標鑑別度低', an.items[2].flags.some(f => f.k === 'low'), an.items[2].flags);
ok('第2題選項 D 沒人選', an.items[1].flags.some(f => f.k === 'dead'));
// 負鑑別：高分組答錯、低分組答對
const neg = pat.map((p, s) => ({sid:'S' + s, answers:{i1:p[0] ? 'A' : 'B', i2:p[1] ? 'A' : 'B', i3:s >= 4 ? 'A' : 'C'}}));
ok('負鑑別度標「答案可能有誤」', M.analyze(iq, neg, {}).items[2].flags.some(f => f.k === 'neg'));
eq('分數分布 10 格加總 = 人數', an.bins.reduce((a, b) => a + b, 0), 6);
eq('配分：多選 3 分', M.analyze([multi], [{answers:{[multi.id]:'AC'}}], {m:3}).students[0].score, 3);

// ── 模擬作答＋分析不會壞 ──
const sim = M.simulate(paper, pv, 40, 1);
const sp = M.parseResponses(sim, ctx);
eq('模擬 40 人全部解析', sp.students.length, 40);
const sa = M.analyze(paper, sp.students, {s:2, m:3, t:1, f:2});
ok('模擬分析數值有限', isFinite(sa.mean) && sa.items.every(i => isFinite(i.P) && isFinite(i.D)), sa);
ok('模擬 KR-20 為正', sa.kr20 > 0, sa.kr20);

// ── 小幫手匯出 ──
const tch = M.toTchRows([weird, fill, tf]);
eq('小幫手：填空略過', tch.skipped, 1);
eq('小幫手：是非答案 X', tch.rows[2][tch.rows[0].length - 1], 'X');

console.log((bad ? '✗ ' : '✓ ') + (n - bad) + '/' + n + ' 通過');
process.exit(bad ? 1 : 0);
