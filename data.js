/* 講義出題試卷工坊：計算引擎（瀏覽器 window.LQB，node 可 require）
   純函式、不碰 DOM。改了這支檔案跑 node tools/test_engine.mjs
   ── 講義文字整理 → 規則出題 → AI 回覆驗證 → 組卷（A/B 卷）→ Google 表單 GAS 程式碼 → 作答解析 → 試題分析 ── */
(function(root){
'use strict';

/* ---------- 小工具 ---------- */
var TYPES = {s:'單選', m:'多選', t:'是非', f:'填空'};
var BLOOM = ['記憶', '理解', '應用', '分析'];
var DIFF = ['易', '中', '難'];
var LETTERS = 'ABCDEFGH';
function str(v){ return v == null ? '' : String(v); }
function FW(s){ return str(s).replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(c){ return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }); }
// 比對用：去空白、標點、全形轉半形、小寫
function normKey(s){ return FW(s).replace(/[⺀-⿟]/g, function(c){ return c.normalize('NFKC'); }).toLowerCase().replace(/[\s\u3000，,。．.、；;：:！!？?「」『』（）()\[\]【】〈〉《》"'“”‘’…—\-_～~·•]/g, ''); }
function hash(s){ s = str(s); var h = 2166136261; for(var i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed){ var a = (typeof seed === 'number' ? seed : hash(seed)) >>> 0; return function(){ a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffle(arr, r){ var a = arr.slice(); for(var i = a.length - 1; i > 0; i--){ var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function uid(pfx, seedStr){ return (pfx || 'q') + hash(seedStr + '|' + Math.random() + '|' + Date.now()).toString(36); }
function clampN(v, lo, hi, d){ v = Number(v); if(!isFinite(v)) return d; return Math.min(hi, Math.max(lo, Math.round(v))); }
function len(s){ return Array.from(str(s)).length; }

/* ---------- 講義文字整理 ---------- */
var END_P = /[。！？；!?;：:」』）)]$/;
// pdf.js 取出的文字常是一行一行斷開；同一段落的行接回去，頁碼、空行丟掉
function cleanText(text){
  var lines = str(text).replace(/\r/g, '').split('\n').map(function(l){ return l.replace(/[\u3000\t ]+/g, ' ').trim(); });
  var out = [], cur = '', maxLen = 0;
  lines.forEach(function(l){ if(len(l) > maxLen) maxLen = len(l); });
  function flush(){ if(cur) out.push(cur); cur = ''; }
  lines.forEach(function(l){
    if(!l){ flush(); return; }
    if(/^(第\s*)?\d{1,3}(\s*頁)?$|^-\s*\d{1,3}\s*-$|^\d{1,3}\s*\/\s*\d{1,3}$|^page\s*\d+$/i.test(l)) return;   // 頁碼
    var bullet = /^([•●○◆◇■□▪▶►✓✔\-–\*]|\d{1,2}[.．、)]|[(（]\d{1,2}[)）]|[一二三四五六七八九十]{1,2}[、.．]|[A-Za-z][.．)])\s*/.test(l);
    if(!cur){ cur = l; return; }
    // 換行換在句子中間（這行長度接近最長行）才接回；短行視為標題
    var wrapped = /[，,、]$/.test(cur) || len(cur) >= maxLen * .7 && maxLen >= 10;
    if(bullet || END_P.test(cur) || !wrapped){ flush(); cur = l; return; }
    // 中文接中文不加空格，英文才補空格
    cur += (/[A-Za-z0-9]$/.test(cur) && /^[A-Za-z0-9]/.test(l) ? ' ' : '') + l;
  });
  flush();
  return out.join('\n');
}
function stripBullet(s){ return str(s).replace(/^([•●○◆◇■□▪▶►✓✔\-–\*]|\d{1,2}[.．、)]|[(（]\d{1,2}[)）]|[一二三四五六七八九十]{1,2}[、.．]|[A-Za-z][.．)])\s*/, '').trim(); }
// 斷句：句號、問號、驚嘆號、分號切開；換行也切
function splitSentences(text){
  var out = [];
  cleanText(text).split('\n').forEach(function(line){
    line.split(/(?<=[。！？!?；;])/).forEach(function(s){ s = s.trim(); if(s) out.push(s); });
  });
  return out;
}

/* ---------- 規則出題 ---------- */
var STOP_HEAD = /^(這|那|它|他|她|我|你|其|此|本|該|每|所有|如果|若|因為|因此|所以|但|而|也|並|且|就|還|只|都|又|才|再|即|則|於|在|當|對|從|讓|使|被|把|將|要|可|能|會|有|沒|不|很|最|更|一個|一種|以下|下列|上述|例如|比如)/;
function cleanTerm(t){
  t = str(t).replace(/^所謂的?|^何謂/, '').replace(/^[「『"“《〈]|[」』"”》〉]$/g, '').trim();
  t = stripBullet(t);
  return t;
}
function okTerm(t){
  var n = len(t);
  return n >= 2 && n <= 16 && !/[，,。、；;！？!?：:]/.test(t) && !STOP_HEAD.test(t) && !/^\d+$/.test(t);
}
function cleanDesc(d){ return str(d).replace(/^[，,：:\s]+/, '').replace(/[。．.；;！!]+$/, '').trim(); }
var DEF_STRONG = /^(.{2,20}?)\s*(?:是指|係指|指的是|意指|乃指|定義為|被定義為|的定義是|就是指)\s*(.{4,90})$/;
var DEF_IS = /^(.{2,12}?)\s*(?:就是|是)\s*(.{6,80})$/;
var DEF_COLON = /^(.{2,18}?)\s*[：:]\s*(.{6,90})$/;
var DEF_TAIL = /^(.{6,80}?)[，,]\s*(?:稱為|稱作|稱之為|叫做|簡稱為?)\s*[「『"“]?(.{2,15}?)[」』"”]?[。．.]?$/;
var LIST_RE = /^(.{2,20}?)\s*(?:包括|包含|可分為|分為|分成|主要有|共有|有以下)\s*(?:[一二三四五六七八九十\d]+\s*(?:種|類|項|個|大|點|步驟?)[，,：:]?\s*)?[：:]?\s*(.{3,120})$/;
var NUM_RE = /(\d+(?:\.\d+)?)\s*(%|％|個百分點|天|日|週|年|個月|月|小時|分鐘|秒|人|位|元|萬元|億元|次|歲|倍|項|個|頁|張|行|字|公尺|公里|公斤)/g;

function splitItems(s){
  return str(s).replace(/[。．.；;]+$/, '').replace(/^[^、，,和及與]*?[：:]/, '').split(/[、，,；;]|(?:以及|及|和|與|或)(?=[^、，,]{1,15}(?:[、，,]|$))/).map(function(x){ return cleanTerm(x.replace(/^(等|還有)/, '').replace(/等?[一二三四五六七八九十兩\d]+\s*(?:個|種|大)?(?:部分|部份|階段|步驟|類|種|項|點|個|大面向|面向)$/, '').replace(/等+$/, '')); }).filter(function(x){ return len(x) >= 1 && len(x) <= 18; });
}

// 從頁面文字找事實：定義句、列舉句、數字句，以及「短標題＋3 個以上條列」的投影片版面
function extractFacts(page){
  var facts = [], sents = splitSentences(page.text);
  var lines = cleanText(page.text).split('\n');
  function add(f){ f.src = {doc:page.doc, file:page.file, chapter:page.chapter, page:page.page, quote:f.quote}; facts.push(f); }
  sents.forEach(function(s){
    var t = stripBullet(s), m;
    if(len(t) < 8 || len(t) > 140) return;
    if((m = DEF_TAIL.exec(t))){ var T = cleanTerm(m[2]), Y = cleanDesc(m[1]); if(okTerm(T) && len(Y) >= 6 && Y.indexOf(T) < 0){ add({kind:'def', term:T, desc:Y, quote:t}); return; } }
    if((m = DEF_STRONG.exec(t)) || (m = DEF_COLON.exec(t)) || (m = DEF_IS.exec(t))){
      var T2 = cleanTerm(m[1]), Y2 = cleanDesc(m[2]);
      if(okTerm(T2) && len(Y2) >= 6 && Y2.indexOf(T2) < 0 && !/^(一個|一種|很|非常|最|不|沒有|可以|能夠|因為)/.test(Y2)){ add({kind:'def', term:T2, desc:Y2, quote:t}); return; }
    }
    if((m = LIST_RE.exec(t))){
      var X = cleanTerm(m[1]), items = splitItems(m[2]);
      if(okTerm(X) && items.length >= 3 && items.length <= 8 && items.every(function(i){ return len(i) <= 15; })){ add({kind:'list', head:X, items:items, quote:t}); return; }
    }
    var nm, nums = [];
    NUM_RE.lastIndex = 0;
    while((nm = NUM_RE.exec(t))) nums.push({v:nm[1], unit:nm[2].replace('％', '%'), i:nm.index, raw:nm[0]});
    if(nums.length === 1 && len(t) >= 10 && len(t) <= 90) add({kind:'num', value:nums[0].v, unit:nums[0].unit, raw:nums[0].raw, at:nums[0].i, sentence:t, quote:t});
  });
  // 投影片：短標題（不是條列）後面緊接 3～8 行條列
  var isBul = function(l){ return stripBullet(l) !== l; };
  for(var i = 0; i < lines.length; i++){
    if(isBul(lines[i])) continue;
    var h = lines[i].replace(/[：:]$/, '').trim();
    if(!okTerm(h) || END_P.test(lines[i]) && !/[：:]$/.test(lines[i])) continue;
    var its = [];
    for(var j = i + 1; j < lines.length && isBul(lines[j]); j++){
      var hd = stripBullet(lines[j]).split(/[：:（(，,]/)[0].trim();
      if(len(hd) < 1 || len(hd) > 15){ its = []; break; }
      its.push(hd);
    }
    if(its.length >= 3 && its.length <= 8 && new Set(its).size === its.length) add({kind:'list', head:h, items:its, quote:h + '：' + its.join('、')});
  }
  return facts;
}

function pickDistractors(answer, pool, n, r, sameCh){
  var a = normKey(answer), al = len(answer);
  var cand = pool.filter(function(p){ var k = normKey(p.v); return k && k !== a && k.indexOf(a) < 0 && a.indexOf(k) < 0; });
  var seen = {}; cand = cand.filter(function(p){ var k = normKey(p.v); if(seen[k]) return false; seen[k] = 1; return true; });
  cand = shuffle(cand, r).sort(function(x, y){
    var sx = (sameCh && x.ch === sameCh ? 0 : 2) + Math.abs(len(x.v) - al) / 4, sy = (sameCh && y.ch === sameCh ? 0 : 2) + Math.abs(len(y.v) - al) / 4;
    return sx - sy;
  });
  return cand.slice(0, n).map(function(p){ return p.v; });
}
function mkQ(o){
  return {id:o.id || uid('q', o.q), type:o.type, q:o.q, opts:o.opts || [], ans:o.ans, explain:o.explain || '', src:o.src || null,
    origin:o.origin || 'rule', status:o.status || 'draft', diff:o.diff == null ? 1 : o.diff, bloom:o.bloom || '記憶', chapter:o.chapter || (o.src && o.src.chapter) || '', warn:o.warn || [], stats:o.stats || []};
}
function placeAns(correct, wrongs, r){
  var opts = shuffle([correct].concat(wrongs), r), i = opts.indexOf(correct);
  return {opts:opts, ans:LETTERS[i]};
}
// pages: [{doc, file, chapter, page, text}]；回傳 {items, facts}
function genRuleQuestions(pages, opt){
  opt = opt || {};
  var r = rng(opt.seed == null ? 1 : opt.seed), want = opt.types || {s:1, m:1, t:1, f:1};
  var facts = []; (pages || []).forEach(function(p){ facts = facts.concat(extractFacts(p)); });
  var terms = [], listItems = [], nums = {};
  facts.forEach(function(f){
    if(f.kind === 'def') terms.push({v:f.term, ch:f.src.chapter});
    if(f.kind === 'list') f.items.forEach(function(x){ listItems.push({v:x, ch:f.src.chapter, head:f.head}); });
    if(f.kind === 'num'){ (nums[f.unit] = nums[f.unit] || []).push({v:f.value + (f.unit === '%' ? '%' : ' ' + f.unit), ch:f.src.chapter}); }
  });
  var out = [], k = 0;
  facts.forEach(function(f){
    var base = {src:f.src, chapter:f.src.chapter, origin:'rule'};
    k++;
    if(f.kind === 'def'){
      var ds = pickDistractors(f.term, terms, 3, r, f.src.chapter);
      var turn = k % 3;
      if(want.s && ds.length >= 2 && (turn === 0 || !want.f && !want.t)){
        var pa = placeAns(f.term, ds, r);
        out.push(mkQ(Object.assign({type:'s', q:'「' + f.desc + '」，指的是下列哪一項？', opts:pa.opts, ans:pa.ans, explain:f.term + '是指' + f.desc + '。'}, base)));
      } else if(want.t && ds.length >= 1 && (turn === 1 || !want.f)){
        var tf = r() < .5;
        out.push(mkQ(Object.assign({type:'t', q:(tf ? f.term : ds[0]) + '是指' + f.desc + '。', opts:[], ans:tf ? 'A' : 'B', explain:'講義原文：' + f.term + '是指' + f.desc + '。'}, base)));
      } else if(want.f){
        out.push(mkQ(Object.assign({type:'f', q:'（　　　）是指' + f.desc + '。', opts:[], ans:f.term, explain:f.term + '是指' + f.desc + '。'}, base)));
      } else if(want.s && ds.length >= 2){
        var pb = placeAns(f.term, ds, r);
        out.push(mkQ(Object.assign({type:'s', q:'「' + f.desc + '」，指的是下列哪一項？', opts:pb.opts, ans:pb.ans}, base)));
      }
    } else if(f.kind === 'list'){
      var others = listItems.filter(function(x){ return x.head !== f.head; });
      var wrong = pickDistractors(f.items.join(''), others.filter(function(x){ return f.items.every(function(i){ return normKey(i) !== normKey(x.v); }); }), 3, r, f.src.chapter);
      if(want.m && wrong.length >= 1 && (k % 2 === 0 || !want.s)){
        var right = shuffle(f.items, r).slice(0, Math.min(f.items.length, wrong.length >= 2 ? 3 : 4));
        var w = wrong.slice(0, Math.max(1, Math.min(2, 5 - right.length)));
        var opts = shuffle(right.concat(w), r);
        var ans = opts.map(function(o, i){ return right.indexOf(o) >= 0 ? LETTERS[i] : ''; }).join('');
        out.push(mkQ(Object.assign({type:'m', q:'下列哪些屬於「' + f.head + '」？（多選）', opts:opts, ans:ans, explain:f.head + '包括' + f.items.join('、') + '。'}, base)));
      } else if(want.s && wrong.length >= 1){
        var keep = shuffle(f.items, r).slice(0, 3), pc = placeAns(wrong[0], keep, r);
        out.push(mkQ(Object.assign({type:'s', q:'下列何者「不屬於」' + f.head + '？', opts:pc.opts, ans:pc.ans, explain:f.head + '包括' + f.items.join('、') + '。'}, base)));
      }
    } else if(f.kind === 'num' && want.s){
      var label = f.value + (f.unit === '%' ? '%' : ' ' + f.unit);
      var nd = pickDistractors(label, (nums[f.unit] || []).filter(function(x){ return normKey(x.v) !== normKey(label); }), 3, r, f.src.chapter);
      if(nd.length >= 2){
        var stem = f.sentence.slice(0, f.at) + '（　　）' + f.sentence.slice(f.at + f.raw.length);
        var pd = placeAns(label, nd, r);
        out.push(mkQ(Object.assign({type:'s', q:stem.replace(/[。．]$/, '') + '。括號內應填入？', opts:pd.opts, ans:pd.ans, explain:'講義原文：' + f.sentence}, base)));
      }
    }
  });
  return {items:dedupe([], out).added, facts:facts};
}

/* ---------- 題庫 ---------- */
function stemKey(q){ return normKey(q.q).replace(/（+）+|\(+\)+/g, '') + '|' + q.type; }
// 把新題目加進題庫：題幹一樣（去標點空白後）就跳過
function dedupe(bank, items){
  var seen = {}; (bank || []).forEach(function(q){ seen[stemKey(q)] = 1; });
  var added = [], dup = 0;
  (items || []).forEach(function(q){ var k = stemKey(q); if(seen[k]){ dup++; return; } seen[k] = 1; added.push(q); });
  return {added:added, dup:dup};
}
// 驗證一題的結構：回傳問題清單（空陣列＝可用）
function checkQ(q){
  var e = [];
  if(!TYPES[q.type]) e.push('題型不明');
  if(!str(q.q).trim()) e.push('沒有題幹');
  if(q.type === 's' || q.type === 'm'){
    if(q.opts.length < 2) e.push('選項少於 2 個');
    var ks = q.opts.map(normKey); if(new Set(ks).size !== ks.length) e.push('選項重複');
    if(q.opts.some(function(o){ return !str(o).trim(); })) e.push('有空白選項');
    var a = str(q.ans);
    if(!/^[A-H]+$/.test(a) || a.split('').some(function(c){ return LETTERS.indexOf(c) >= q.opts.length; })) e.push('答案不在選項裡');
    else if(q.type === 's' && a.length !== 1) e.push('單選題只能有一個答案');
  }
  if(q.type === 't' && q.ans !== 'A' && q.ans !== 'B') e.push('是非題答案要是對或錯');
  if(q.type === 'f' && !str(q.ans).trim()) e.push('填空題沒有答案');
  return e;
}
function ansText(q){
  if(q.type === 't') return q.ans === 'A' ? '○ 對' : '✕ 錯';
  if(q.type === 'f') return str(q.ans);
  return q.ans;
}
// 匯入現成題目（小幫手格式 {q,type,opts,ans}）
function fromSimple(list, chapter){
  return (list || []).map(function(x){ return mkQ({type:x.type, q:x.q, opts:x.opts || [], ans:x.ans, origin:'import', chapter:chapter || '匯入題目', diff:1, bloom:'記憶'}); });
}
// 給講師課堂小幫手：表格（題目｜選項A…｜答案），填空題不支援
function toTchRows(items){
  var max = 2; items.forEach(function(q){ if(q.opts.length > max) max = q.opts.length; });
  var rows = [['題目'].concat(LETTERS.slice(0, max).split('').map(function(L){ return '選項' + L; }), ['答案'])];
  var skipped = 0;
  items.forEach(function(q){
    if(q.type === 'f'){ skipped++; return; }
    var r = [q.q]; for(var i = 0; i < max; i++) r.push(q.opts[i] || '');
    r.push(q.type === 't' ? (q.ans === 'A' ? 'O' : 'X') : q.ans); rows.push(r);
  });
  return {rows:rows, skipped:skipped};
}
function toBankRows(items){
  var rows = [['編號', '章節', '題型', '題目', '選項A', '選項B', '選項C', '選項D', '選項E', '選項F', '答案', '難度', '認知層次', '出處檔案', '頁碼', '原文', '來源', '狀態', '解析']];
  items.forEach(function(q, i){
    var r = [i + 1, q.chapter, TYPES[q.type], q.q]; for(var k = 0; k < 6; k++) r.push(q.opts[k] || '');
    r.push(ansText(q), DIFF[q.diff] || '', q.bloom, q.src ? q.src.file : '', q.src ? q.src.page : '', q.src ? q.src.quote : '', {rule:'規則', ai:'AI', import:'匯入', manual:'手動'}[q.origin] || q.origin, q.status === 'ok' ? '已審' : '待審', q.explain || '');
    rows.push(r);
  });
  return rows;
}

/* ---------- AI 出題 ---------- */
// 把頁面切成每批 ≤ maxChars 字，頁面代號 P1、P2…
function chunkPages(pages, maxChars){
  maxChars = maxChars || 9000;
  var out = [], cur = [], n = 0;
  (pages || []).forEach(function(p){
    var t = cleanText(p.text); if(len(t) < 20) return;
    if(n && n + len(t) > maxChars){ out.push(cur); cur = []; n = 0; }
    cur.push(p); n += len(t);
  });
  if(cur.length) out.push(cur);
  return out;
}
function aiPrompt(batch, o){
  o = o || {};
  var types = [], tw = o.types || {s:1, m:1, t:1, f:0};
  if(tw.s) types.push('單選題 s（4 個選項、只有 1 個正確）');
  if(tw.m) types.push('多選題 m（4～5 個選項、2 個以上正確）');
  if(tw.t) types.push('是非題 t（ans 填「對」或「錯」）');
  if(tw.f) types.push('填空題 f（題幹用「（　　）」挖空，ans 填正確詞語）');
  var levels = (o.bloom && o.bloom.length ? o.bloom : BLOOM).join('、');
  var h = '你是一位嚴謹的課程出題老師。請「只根據下面的講義內容」出 ' + clampN(o.n, 1, 40, 10) + ' 題測驗題，使用繁體中文（台灣用語）。\n\n' +
    '題型：' + types.join('；') + '\n認知層次請分布在：' + levels + '（應用、分析題要用講義裡的觀念設計情境，但情境裡不可出現講義沒有的專業事實）\n難度：' + (o.diff || '易、中、難都要有') + '\n\n' +
    '規則：\n1. 只能使用講義裡寫到的事實與數字，不可以編造數字、人名、法條、案例結果。\n2. 每題都要附「quote」：從講義逐字複製、能證明答案的一句話（30 字內，不要改字）。\n3. 每題附「page」：quote 所在的頁面代號（例如 P2）。\n4. 選項要長度相近、看起來合理；不要用「以上皆是」「以上皆非」。\n5. 題幹不要照抄大段原文；不可以模仿真實人物的口吻，也不要出現真實人物或既有卡通角色。\n6. 題目不重複，也不要只換字的相似題。\n\n' +
    '只回傳 JSON，不要其他文字，格式：\n{"questions":[{"type":"s","q":"題幹","opts":["選項1","選項2","選項3","選項4"],"ans":"B","page":"P1","quote":"講義原句","bloom":"理解","diff":"中","explain":"一句話解析"}]}\n' +
    '（ans：單選填一個字母、多選填字母組合如 "AC"、是非填 "對" 或 "錯"、填空填答案文字；字母 A 是第一個選項）\n\n講義內容：\n';
  batch.forEach(function(p, i){ h += '\n[P' + (i + 1) + '｜' + p.file + '｜第 ' + p.page + ' 頁]\n' + cleanText(p.text) + '\n'; });
  return h;
}
function parseAiJson(text){
  var t = str(text).replace(/```(?:json)?/gi, '').trim(), j = null;
  try{ j = JSON.parse(t); }catch(e){
    var a = t.indexOf('{'), b = t.lastIndexOf('}'), c = t.indexOf('['), d = t.lastIndexOf(']');
    try{ if(a >= 0 && b > a) j = JSON.parse(t.slice(a, b + 1)); }catch(e2){ j = null; }
    if(!j){ try{ if(c >= 0 && d > c) j = JSON.parse(t.slice(c, d + 1)); }catch(e3){ j = null; } }
  }
  if(Array.isArray(j)) return j;
  if(j && Array.isArray(j.questions)) return j.questions;
  if(j && Array.isArray(j.items)) return j.items;
  return null;
}
function findQuote(quote, batch){
  var qk = normKey(quote); if(len(qk) < 4) return -1;
  var parts = qk.split(/…|\.\.\./).filter(function(x){ return len(x) >= 4; }); if(!parts.length) parts = [qk];
  for(var i = 0; i < batch.length; i++){ var pk = normKey(cleanText(batch[i].text)); if(parts.every(function(x){ return pk.indexOf(x) >= 0; })) return i; }
  return -1;
}
// AI 回覆 → 題目；引句在講義裡找不到就加警告、維持待審
function validateAiQuestions(list, batch){
  var out = [], bad = 0;
  (list || []).forEach(function(x){
    if(!x || typeof x !== 'object'){ bad++; return; }
    var type = {'單選':'s', '多選':'m', '是非':'t', '填空':'f'}[x.type] || str(x.type).toLowerCase().charAt(0);
    var opts = Array.isArray(x.opts) ? x.opts.map(function(o){ return str(o).replace(/^\s*[(（]?[A-Ha-h][)）.．、]\s*/, '').trim(); }).filter(Boolean).slice(0, 8) : [];
    var ans = str(x.ans).trim();
    if(type === 't'){ ans = /^(對|是|o|○|true|t|正確|a)$/i.test(FW(ans)) ? 'A' : /^(錯|否|x|✕|×|false|f|錯誤|b)$/i.test(FW(ans)) ? 'B' : ''; opts = []; }
    else if(type === 's' || type === 'm'){
      var L = FW(ans).toUpperCase().replace(/[^A-H]/g, '');
      if(!L){ var ix = opts.map(normKey).indexOf(normKey(ans)); if(ix >= 0) L = LETTERS[ix]; }
      ans = Array.from(new Set(L.split(''))).sort().join('');
      if(type === 's' && ans.length > 1) type = 'm';
    }
    var warn = [], pi = -1, pm = /\d+/.exec(str(x.page));
    if(pm) pi = +pm[0] - 1;
    var fi = findQuote(x.quote, batch);
    if(fi < 0) warn.push('找不到出處');
    else pi = fi;
    var p = batch[pi] || null;
    var q = mkQ({type:type, q:str(x.q).trim(), opts:opts, ans:ans, explain:str(x.explain).trim(), origin:'ai',
      bloom:BLOOM.indexOf(x.bloom) >= 0 ? x.bloom : '理解', diff:Math.max(0, DIFF.indexOf(x.diff)),
      src:p ? {doc:p.doc, file:p.file, chapter:p.chapter, page:p.page, quote:str(x.quote).trim()} : null, chapter:p ? p.chapter : (batch[0] && batch[0].chapter) || ''});
    if(x.diff == null || DIFF.indexOf(x.diff) < 0) q.diff = 1;
    var errs = checkQ(q);
    if(errs.length){ bad++; return; }
    q.warn = warn; out.push(q);
  });
  return {items:out, bad:bad};
}

/* ---------- 組卷 ---------- */
var LOCK_OPT = /以上皆|皆是|皆非|都對|都不對|都正確|都錯|全部皆|以上都/;
function seedOf(v){ return typeof v === 'number' ? v : hash(v); }
// 雙向細目表：cells = [{chapter, bloom, n}]，types = 可以出的題型；只抽「已審」題目
function pickByBlueprint(bank, cells, o){
  o = o || {}; var r = rng(seedOf(o.seed == null ? 1 : o.seed)), types = o.types || {s:1, m:1, t:1, f:1};
  var used = {}, ids = [], short = [];
  (cells || []).forEach(function(c){
    var n = clampN(c.n, 0, 200, 0); if(!n) return;
    var pool = bank.filter(function(q){ return q.status === 'ok' && types[q.type] && !used[q.id] && (q.chapter || '') === (c.chapter || '') && (!c.bloom || q.bloom === c.bloom); });
    var pick = shuffle(pool, r).slice(0, n);
    pick.forEach(function(q){ used[q.id] = 1; ids.push(q.id); });
    if(pick.length < n) short.push({chapter:c.chapter, bloom:c.bloom, want:n, got:pick.length});
  });
  // 依題型排：是非 → 單選 → 多選 → 填空（同題型內維持抽到的順序）
  var ord = {t:0, s:1, m:2, f:3}, byId = {}; bank.forEach(function(q){ byId[q.id] = q; });
  ids.sort(function(a, b){ return ord[byId[a].type] - ord[byId[b].type]; });
  return {ids:ids, short:short};
}
// 卷別：A 卷＝母卷原順序；B 卷以後題目順序與選項順序都打亂（同題型群組內打亂，保持大題順序）
function makeVersions(items, n, o){
  o = o || {}; n = clampN(n, 1, 4, 1);
  var vers = [];
  for(var v = 0; v < n; v++){
    var r = rng(seedOf(o.seed == null ? 1 : o.seed) + v * 7919);
    var order = items.map(function(q){ return q.id; }), perms = {};
    if(v > 0){
      var groups = [], cur = null;
      items.forEach(function(q){ if(!cur || cur.t !== q.type){ cur = {t:q.type, ids:[]}; groups.push(cur); } cur.ids.push(q.id); });
      order = []; groups.forEach(function(g){ order = order.concat(shuffle(g.ids, r)); });
    }
    items.forEach(function(q){
      var idx = q.opts.map(function(_, i){ return i; });
      if(v > 0 && o.shuffleOpts !== false && (q.type === 's' || q.type === 'm') && !q.opts.some(function(x){ return LOCK_OPT.test(x); })) idx = shuffle(idx, r);
      perms[q.id] = idx;   // perms[id][新位置] = 母卷位置
    });
    vers.push({name:LETTERS[v], order:order, perms:perms});
  }
  return vers;
}
// 這一題在某卷的樣子：選項順序與答案字母都換成該卷
function viewQ(q, ver){
  var p = ver && ver.perms[q.id] || q.opts.map(function(_, i){ return i; });
  var opts = p.map(function(i){ return q.opts[i]; });
  var ans = q.ans;
  if(q.type === 's' || q.type === 'm') ans = p.map(function(oi, ni){ return q.ans.indexOf(LETTERS[oi]) >= 0 ? LETTERS[ni] : ''; }).join('');
  return Object.assign({}, q, {opts:opts, ans:ans});
}
// 卷上作答字母 → 母卷字母
function toMaster(q, ver, letters){
  var p = ver && ver.perms[q.id]; if(!p || q.type === 't' || q.type === 'f') return letters;
  return Array.from(new Set(str(letters).split('').map(function(L){ var i = LETTERS.indexOf(L); return i >= 0 && p[i] != null ? LETTERS[p[i]] : ''; }).filter(Boolean))).sort().join('');
}
function pointsOf(q, pts){ var v = Number(pts && pts[q.type]); return isFinite(v) && v > 0 ? v : 1; }
// 雙向細目表統計（章節 × 認知層次 題數）
function blueprintTable(items){
  var chs = [], t = {};
  items.forEach(function(q){ var c = q.chapter || '（未分章）'; if(chs.indexOf(c) < 0) chs.push(c); t[c] = t[c] || {}; t[c][q.bloom] = (t[c][q.bloom] || 0) + 1; });
  return {chapters:chs, levels:BLOOM, cells:t};
}

/* ---------- Google 表單：產生 Apps Script 程式碼 ---------- */
// 表單風格：Apps Script 不能改表單的主題顏色與字型，所以「風格」＝橫幅圖片＋說明文字＋分段方式＋題號格式＋進度列＋完成訊息；
// 主題顏色、字型只給建議，由使用者在表單右上角 🎨 自行設定。
var FORM_STYLES = [
  {id:'formal', name:'正式考試', desc:'深藍橫幅、每個大題一頁、題目標配分，適合期中期末與結訓測驗。',
    banner:{bg1:'#1F2E4A', bg2:'#2D4470', fg:'#FFFFFF', accent:'#E8C36A', pattern:'rule', font:'serif', mark:''},
    theme:{color:'#1F2E4A', font:'正式（例如 Noto Serif）'},
    intro:'本測驗共 {n} 題，滿分 {full} 分{min}。請獨立作答，送出前再檢查一次。', sec:'page', secTitle:'cn', secHelp:'', title:'numPts', progress:false,
    confirm:'作答已送出。成績與解答將由講師另行公布。'},
  {id:'quiz', name:'課堂小測驗', desc:'明亮的黃色橫幅、全部題目在同一頁、語氣輕鬆，適合上課中的隨堂小考。',
    banner:{bg1:'#FFC93C', bg2:'#FF9A3C', fg:'#3A2500', accent:'#FFFFFF', pattern:'dots', font:'sans', mark:'📝'},
    theme:{color:'#F4A100', font:'活潑'},
    intro:'📝 小測驗時間！共 {n} 題{min}，看看剛剛學到多少。', sec:'header', secTitle:'emoji', secHelp:'', title:'num', progress:false,
    confirm:'🎉 完成！可以按「查看分數」看看自己答對幾題。'},
  {id:'corp', name:'企業內訓', desc:'沉穩的藍綠色橫幅、每個大題一頁、說明文字較正式，適合企業內訓與研習。',
    banner:{bg1:'#0F5257', bg2:'#1B7A72', fg:'#FFFFFF', accent:'#9FE2D6', pattern:'grid', font:'sans', mark:''},
    theme:{color:'#0F5257', font:'基本'},
    intro:'感謝參加{cls}。以下測驗共 {n} 題，滿分 {full} 分{min}，結果作為訓練成效評估參考。', sec:'page', secTitle:'cn', secHelp:'', title:'num', progress:true,
    confirm:'感謝您完成測驗，訓練成效結果將提供給承辦單位參考。'},
  {id:'game', name:'闖關挑戰', desc:'紫色星空橫幅、每個大題是一關、有進度列與鼓勵文字，適合青少年或遊戲化課程。',
    banner:{bg1:'#3B1E78', bg2:'#7A2E8E', fg:'#FFFFFF', accent:'#FFD84D', pattern:'stars', font:'sans', mark:'🏆'},
    theme:{color:'#5B2A86', font:'活潑'},
    intro:'🚀 闖關開始！一共 {n} 題，過完所有關卡就完成挑戰{min}。', sec:'page', secTitle:'level', secHelp:'加油！這一關有 {k} 題。', title:'num', progress:true,
    confirm:'🏆 全部過關！按「查看分數」看看你的成績。'},
  {id:'gentle', name:'溫和易讀', desc:'暖綠色大字橫幅、每 5 題一頁、說明簡短，適合樂齡班或不常用手機填表的學員。',
    banner:{bg1:'#3F7D4E', bg2:'#5E9E5C', fg:'#FFFFFF', accent:'#FFF3B0', pattern:'wave', font:'sans', mark:''},
    theme:{color:'#3F7D4E', font:'基本（題目字級建議調到 14 以上）'},
    intro:'共 {n} 題，慢慢作答就好。每頁做完按「繼續」。', sec:'page5', secTitle:'part', secHelp:'慢慢來，不用急。', title:'num', progress:true,
    confirm:'謝謝您！已經送出了。'},
  {id:'plain', name:'極簡', desc:'沒有橫幅與分段，只有題目，適合快速收集答案。',
    banner:null, theme:{color:'#5F6368', font:'基本'},
    intro:'共 {n} 題{min}。', sec:'none', secTitle:'cn', secHelp:'', title:'num', progress:false, confirm:'已送出。'}
];
var styleById = {}; FORM_STYLES.forEach(function(s){ styleById[s.id] = s; });
var SEC_MODES = {style:'依風格', none:'不分段', header:'大題標題（同一頁）', page:'每個大題換一頁', page5:'每 5 題換一頁'};
var FIELD_TYPES = {text:'簡答', para:'段落', mc:'單選', dd:'下拉選單', cb:'核取方塊', date:'日期'};
var FIELD_VALID = {none:'不檢查', num:'只能填數字', email:'要是 Email', len:'字數上限', regex:'符合格式（規則運算式）'};
var FIELD_PRESETS = [
  {label:'班級', type:'dd', opts:'甲班\n乙班', req:1},
  {label:'單位', type:'text', req:1},
  {label:'職稱', type:'text', req:0},
  {label:'座號', type:'text', req:1, valid:'num'},
  {label:'Email', type:'text', req:0, valid:'email'},
  {label:'手機', type:'text', req:0, valid:'regex', arg:'^09\\d{8}$', help:'請填 09 開頭的 10 碼數字'},
  {label:'上課日期', type:'date', req:0},
  {label:'給講師的話', type:'para', req:0, valid:'len', arg:'200'}
];
var CN_NUM = '一二三四五六七八九十';
function fill(t, v){ return str(t).replace(/\{(\w+)\}/g, function(_, k){ return v[k] == null ? '' : v[k]; }); }
function cleanField(f){
  f = f || {};
  var type = FIELD_TYPES[f.type] ? f.type : 'text', valid = FIELD_VALID[f.valid] ? f.valid : 'none';
  if(type !== 'text' && !(type === 'para' && valid === 'len')) valid = 'none';
  var opts = /^(mc|dd|cb)$/.test(type) ? str(f.opts).split('\n').map(function(x){ return x.trim(); }).filter(Boolean) : [];
  return {label:str(f.label).trim(), type:type, opts:opts, req:!!+f.req, valid:valid, arg:str(f.arg).trim(), help:str(f.help).trim()};
}
// 檢查自訂欄位，回傳問題清單
function checkFields(fields){
  var e = [], seen = {};
  (fields || []).forEach(function(raw, i){
    var f = cleanField(raw), n = '第 ' + (i + 1) + ' 個欄位';
    if(!f.label) e.push(n + '沒有名稱');
    else if(seen[f.label]) e.push('欄位「' + f.label + '」重複'); else seen[f.label] = 1;
    if(/^\s*(?:Q|第)?\s*\d{1,3}\s*(?:題)?\s*[.．、:：)）]/i.test(f.label)) e.push('欄位「' + f.label + '」不要用數字開頭，會被當成題目');
    if(/^(mc|dd|cb)$/.test(f.type) && f.opts.length < 2) e.push('欄位「' + (f.label || i + 1) + '」至少要 2 個選項');
    if(f.valid === 'len' && !(+f.arg > 0)) e.push('欄位「' + f.label + '」字數上限要填數字');
    if(f.valid === 'regex'){ try{ new RegExp(f.arg); if(!f.arg) throw 0; }catch(x){ e.push('欄位「' + f.label + '」的格式規則寫錯了'); } }
  });
  return e;
}
function qTitle(fmt, n, q, pts){
  if(fmt === 'cn') return '第 ' + n + ' 題：' + q.q;
  if(fmt === 'numPts') return n + '. ' + q.q + '（' + pts + ' 分）';
  return n + '. ' + q.q;
}
// 一份表單的題目分段：依風格（或覆寫的 sec）切成 [{title, help, items:[…]}]
function sectionsOf(list, st, secMode){
  var mode = secMode && secMode !== 'style' ? secMode : st.sec, out = [];
  if(mode === 'none') return [{title:'', help:'', page:false, items:list}];
  if(mode === 'page5'){
    for(var i = 0; i < list.length; i += 5){ var k = Math.floor(i / 5); out.push({title:st.secTitle === 'level' ? '第 ' + (k + 1) + ' 關' : '第 ' + (k + 1) + ' 部分（第 ' + (i + 1) + '～' + Math.min(list.length, i + 5) + ' 題）', help:fill(st.secHelp, {k:Math.min(5, list.length - i)}), page:true, items:list.slice(i, i + 5)}); }
    return out;
  }
  var cur = null;
  list.forEach(function(x){ if(!cur || cur.t !== x.type){ cur = {t:x.type, items:[]}; out.push(cur); } cur.items.push(x); });
  var icon = {t:'⭕', s:'🔘', m:'☑️', f:'✏️'};
  return out.map(function(g, i){
    var name = TYPES[g.t] + '題', p = g.items[0].points, same = g.items.every(function(x){ return x.points === p; });
    var t = st.secTitle === 'level' ? '第 ' + (i + 1) + ' 關：' + name : st.secTitle === 'emoji' ? icon[g.t] + ' ' + name : st.secTitle === 'part' ? '第 ' + (i + 1) + ' 部分：' + name : CN_NUM[i] + '、' + name;
    var help = (same ? '每題 ' + p + ' 分，共 ' + g.items.length + ' 題' : '共 ' + g.items.length + ' 題') + (g.t === 'm' ? '；每題至少有兩個正確答案，全對才給分' : '') + '。' + (st.secHelp ? fill(st.secHelp, {k:g.items.length}) : '');
    return {title:t, help:help, page:mode === 'page', items:g.items};
  });
}
// paper: {title, desc, cls, minutes}；versions 每卷一份表單
function gasData(paper, items, versions, pts, o){
  o = o || {};
  var st = styleById[o.style] || FORM_STYLES[0];
  var full = items.reduce(function(a, q){ return a + pointsOf(q, pts); }, 0);
  var byId = {}; items.forEach(function(q){ byId[q.id] = q; });
  var vars = {n:items.length, full:full, min:+paper.minutes ? '，作答時間 ' + paper.minutes + ' 分鐘' : '', cls:paper.cls ? '「' + paper.cls + '」' : '本課程', title:paper.title};
  var intro = [fill(st.intro, vars), str(paper.desc).trim()].filter(Boolean).join('\n\n');
  var forms = versions.map(function(ver){
    var list = ver.order.map(function(id, i){
      var q = viewQ(byId[id], ver), p = pointsOf(q, pts);
      var correct = q.type === 't' ? [q.ans === 'A' ? 0 : 1] : q.type === 'f' ? [] : q.ans.split('').map(function(L){ return LETTERS.indexOf(L); });
      var fb = o.feedback && q.src ? '出處：' + q.src.file + ' 第 ' + q.src.page + ' 頁' + (q.explain ? '。' + q.explain : '') : (o.feedback && q.explain ? q.explain : '');
      return {type:q.type, title:qTitle(st.title, i + 1, q, p), opts:q.type === 't' ? ['○ 對', '✕ 錯'] : q.opts.slice(), correct:correct, points:p, feedback:fb, answer:q.type === 'f' ? str(q.ans) : ''};
    });
    return {title:str(paper.title || '測驗') + (versions.length > 1 ? '（' + ver.name + ' 卷）' : ''), desc:intro, sections:sectionsOf(list, st, o.sec)};
  });
  return {style:st.id, forms:forms, banner:st.banner && o.banner !== false && o.bannerB64 ? o.bannerB64 : '',
    progress:o.progress == null ? st.progress : !!o.progress, confirm:str(o.confirm).trim() || st.confirm,
    askId:o.askId !== false, askName:o.askName !== false, collectEmail:!!o.collectEmail, required:o.required !== false, sheet:o.sheet !== false,
    shuffle:!!o.shuffleQuestions, once:!!o.once, edit:!!o.edit, fields:(o.fields || []).map(cleanField).filter(function(f){ return f.label; })};
}
function toGasCode(paper, items, versions, pts, o){
  var data = gasData(paper, items, versions, pts, o), st = styleById[data.style];
  var json = JSON.stringify(data, null, 1).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return [
    '/**',
    ' * 由「講義出題試卷工坊」產生的 Google 表單測驗程式（產生時間 ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + '，風格：' + st.name + '）',
    ' * 用法：1. 開 https://script.google.com 新增專案　2. 全部貼上取代原本內容並儲存',
    ' *       3. 上方函式選 createQuiz → 按「執行」→ 依畫面授權　4. 在「執行記錄」看表單網址',
    ' * 主題顏色與字型 Apps Script 不能設定，建議到表單右上角 🎨 自訂主題：顏色 ' + st.theme.color + '、字型 ' + st.theme.font + '。',
    ' * 注意：填空題 Apps Script 不能設定標準答案，請在表單「回覆」裡手動評分。題目請自行確認後再發給學員。',
    ' */',
    'var QUIZ = ' + json + ';',
    '',
    'function addField_(form, f) {',
    '  var it;',
    '  if (f.type === \'para\') it = form.addParagraphTextItem();',
    '  else if (f.type === \'mc\') it = form.addMultipleChoiceItem().setChoiceValues(f.opts);',
    '  else if (f.type === \'dd\') it = form.addListItem().setChoiceValues(f.opts);',
    '  else if (f.type === \'cb\') it = form.addCheckboxItem().setChoiceValues(f.opts);',
    '  else if (f.type === \'date\') it = form.addDateItem();',
    '  else it = form.addTextItem();',
    '  it.setTitle(f.label).setRequired(f.req);',
    '  if (f.help) it.setHelpText(f.help);',
    '  if (f.type === \'text\' && f.valid !== \'none\') {',
    '    var v = FormApp.createTextValidation();',
    '    if (f.valid === \'num\') v.requireNumber().setHelpText(\'請填數字\');',
    '    else if (f.valid === \'email\') v.requireTextIsEmail().setHelpText(\'請填正確的 Email\');',
    '    else if (f.valid === \'len\') v.requireTextLengthLessThanOrEqualTo(Number(f.arg)).setHelpText(\'最多 \' + f.arg + \' 個字\');',
    '    else if (f.valid === \'regex\') v.requireTextMatchesPattern(f.arg).setHelpText(f.help || \'格式不對，請再檢查\');',
    '    it.setValidation(v.build());',
    '  }',
    '  if (f.type === \'para\' && f.valid === \'len\') it.setValidation(FormApp.createParagraphTextValidation().requireTextLengthLessThanOrEqualTo(Number(f.arg)).setHelpText(\'最多 \' + f.arg + \' 個字\').build());',
    '}',
    '',
    'function addQuestion_(form, q) {',
    '  var it;',
    '  if (q.type === \'f\') {',
    '    it = form.addTextItem();',
    '    it.setTitle(q.title).setPoints(q.points).setRequired(QUIZ.required);',
    '    if (q.feedback) it.setGeneralFeedback(FormApp.createFeedback().setText(\'參考答案：\' + q.answer + \'。\' + q.feedback).build());',
    '    return;',
    '  }',
    '  it = q.type === \'m\' ? form.addCheckboxItem() : form.addMultipleChoiceItem();',
    '  it.setTitle(q.title).setPoints(q.points).setRequired(QUIZ.required);',
    '  it.setChoices(q.opts.map(function (o, k) { return it.createChoice(o, q.correct.indexOf(k) >= 0); }));',
    '  if (q.feedback) {',
    '    it.setFeedbackForCorrect(FormApp.createFeedback().setText(\'答對了！\' + q.feedback).build());',
    '    it.setFeedbackForIncorrect(FormApp.createFeedback().setText(q.feedback).build());',
    '  }',
    '}',
    '',
    'function createQuiz() {',
    '  QUIZ.forms.forEach(function (F) {',
    '    var form = FormApp.create(F.title);',
    '    form.setIsQuiz(true);',
    '    if (F.desc) form.setDescription(F.desc);',
    '    form.setProgressBar(QUIZ.progress);',
    '    if (QUIZ.confirm) form.setConfirmationMessage(QUIZ.confirm);',
    '    if (QUIZ.collectEmail) form.setCollectEmail(true);',
    '    if (QUIZ.once) form.setLimitOneResponsePerUser(true);',
    '    if (QUIZ.edit) form.setAllowResponseEdits(true);',
    '    if (QUIZ.shuffle) form.setShuffleQuestions(true);',
    '    if (QUIZ.banner) form.addImageItem().setImage(Utilities.newBlob(Utilities.base64Decode(QUIZ.banner), \'image/png\', \'banner.png\')).setAlignment(FormApp.Alignment.CENTER);',
    '    if (QUIZ.askId) form.addTextItem().setTitle(\'學號\').setRequired(true);',
    '    if (QUIZ.askName) form.addTextItem().setTitle(\'姓名\').setRequired(true);',
    '    QUIZ.fields.forEach(function (f) { addField_(form, f); });',
    '    F.sections.forEach(function (s) {',
    '      if (s.title) {',
    '        var h = s.page ? form.addPageBreakItem() : form.addSectionHeaderItem();',
    '        h.setTitle(s.title);',
    '        if (s.help) h.setHelpText(s.help);',
    '      }',
    '      s.items.forEach(function (q) { addQuestion_(form, q); });',
    '    });',
    '    var msg = \'【\' + F.title + \'】\\n填答網址：\' + form.getPublishedUrl() + \'\\n編輯網址：\' + form.getEditUrl();',
    '    if (QUIZ.sheet) {',
    '      var ss = SpreadsheetApp.create(F.title + \'（回覆）\');',
    '      form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());',
    '      msg += \'\\n回覆試算表：\' + ss.getUrl();',
    '    }',
    '    Logger.log(msg);',
    '  });',
    '}',
    ''
  ].join('\n');
}

/* ---------- 作答解析 ---------- */
// ctx: {items（母卷，含 id/type/opts/ans）, versions}
function cellStr(v){ return str(v).replace(/^="(.*)"$/, '$1').trim(); }
function verIndex(v, versions){ var s = FW(cellStr(v)).toUpperCase().replace(/卷|版|式|VERSION|\s/g, ''); var i = LETTERS.indexOf(s.charAt(0)); return i >= 0 && i < versions.length && s.length <= 2 ? i : -1; }
function parseResponses(rows, ctx, o){
  o = o || {};
  rows = (rows || []).map(function(r){ return (r || []).map(cellStr); }).filter(function(r){ return r.some(Boolean); });
  var res = {students:[], warn:[], format:''};
  if(rows.length < 2){ res.warn.push('檔案裡沒有作答資料'); return res; }
  var H = rows[0], body = rows.slice(1), versions = ctx.versions, items = ctx.items, byId = {};
  items.forEach(function(q){ byId[q.id] = q; });
  var hk = H.map(function(h){ return FW(h).replace(/\s/g, '').toLowerCase(); });
  var si = hk.findIndex(function(h){ return /學號|studentid|座號|員編|編號/.test(h); });
  var ni = hk.findIndex(function(h){ return /姓名|名字|^name$/.test(h); });
  var vi = hk.findIndex(function(h){ return /卷別|卷|版本|version|試卷/.test(h) && !/題/.test(h); });
  var fileVer = o.ver == null ? -1 : o.ver;
  // 題目欄：(1) 標題「1. 題幹」（Google 表單） (2) Q1／第1題／1 (3) 小幫手成績檔的 ✔/✘ 欄
  var qcols = [];
  H.forEach(function(h, c){
    if(c === si || c === ni || c === vi) return;
    var t = FW(h).trim(), m;
    if((m = /^(?:Q|第)?\s*(\d{1,3})\s*(?:題)?\s*(?:[.．、:：)）]\s*(.*))?$/i.exec(t))) qcols.push({c:c, n:+m[1], title:m[2] || ''});
  });
  if(!qcols.length){
    H.forEach(function(h, c){ if(body.some(function(r){ return /^(✔|✘|✓|✗)|未作答/.test(r[c] || ''); })) qcols.push({c:c, n:qcols.length + 1, title:''}); });
    if(qcols.length) res.format = '小幫手成績檔';
  }
  if(!qcols.length){ res.warn.push('找不到題目欄位：標題要是「1」「Q1」「第1題」或 Google 表單的「1. 題目」'); return res; }
  if(!res.format) res.format = qcols.some(function(q){ return q.title; }) ? 'Google 表單回覆' : '作答表';
  body.forEach(function(r, ri){
    var sid = si >= 0 ? r[si] : '', name = ni >= 0 ? r[ni] : '';
    if(!sid && !name) sid = '第' + (ri + 2) + '列';
    var v = vi >= 0 ? verIndex(r[vi], versions) : fileVer;
    if(v < 0) v = versions.length === 1 ? 0 : -1;
    if(v < 0){ res.warn.push((name || sid) + '：不知道是哪一卷，已略過'); return; }
    var ver = versions[v], answers = {};
    qcols.forEach(function(qc){
      var id = ver.order[qc.n - 1]; if(!id) return;
      var q = byId[id], vq = viewQ(q, ver), raw = r[qc.c] || '', a = '';
      var tm = /[（(]\s*([A-HＡ-Ｈ]+|[OX○✕╳])\s*[)）]/.exec(raw);   // 小幫手「✘ 答錯（C）」
      if(/^(✔|✓)/.test(raw)) a = vq.type === 'f' ? '__right__' : vq.ans;
      else if(tm && /^(✘|✗)/.test(raw)) a = FW(tm[1]).toUpperCase();
      else if(/未作答/.test(raw)) a = '';
      else if(q.type === 'f') a = raw;
      else if(q.type === 't') a = /^(○|o|對|是|true|t|v|✓)/i.test(FW(raw)) || /對/.test(raw) ? 'A' : /^(✕|x|×|╳|錯|否|false|f)/i.test(FW(raw)) || /錯/.test(raw) ? 'B' : /^[AB]$/i.test(raw) ? raw.toUpperCase() : '';
      else {
        var L = FW(raw).toUpperCase();
        if(/^[A-H\s,，、;；]+$/.test(L)) a = L.replace(/[^A-H]/g, '');
        else { // Google 表單：回覆是選項文字（多選用「, 」連接）
          var hit = [], rest = raw;
          vq.opts.map(function(o, i){ return {o:o, i:i}; }).sort(function(x, y){ return len(y.o) - len(x.o); }).forEach(function(x){ var p = rest.indexOf(x.o); if(x.o && p >= 0){ hit.push(LETTERS[x.i]); rest = rest.slice(0, p) + rest.slice(p + x.o.length); } });
          a = hit.sort().join('');
        }
        a = toMaster(q, ver, Array.from(new Set(a.split(''))).sort().join(''));
      }
      if(q.type === 't' && tm && /^(✘|✗)/.test(raw)) a = /[OＯ○A]/.test(tm[1]) ? 'A' : 'B';
      answers[id] = a;
    });
    res.students.push({sid:sid, name:name, ver:ver.name, answers:answers});
  });
  return res;
}
function isRight(q, a){
  if(a === '__right__') return true;
  if(!a) return false;
  if(q.type === 'f'){ var alts = str(q.ans).split(/[／\/|｜;；]/).map(normKey).filter(Boolean); return alts.indexOf(normKey(a)) >= 0; }
  return a === q.ans;
}

/* ---------- 試題分析 ---------- */
function mean(a){ return a.length ? a.reduce(function(s, x){ return s + x; }, 0) / a.length : 0; }
function sdPop(a){ var m = mean(a); return a.length ? Math.sqrt(a.reduce(function(s, x){ return s + (x - m) * (x - m); }, 0) / a.length) : 0; }
// items：母卷題目；students：parseResponses 的結果；pts：各題型配分
function analyze(items, students, pts, o){
  o = o || {};
  var N = students.length, k = items.length;
  var R = students.map(function(s){
    var right = items.map(function(q){ return isRight(q, s.answers[q.id]) ? 1 : 0; });
    var raw = right.reduce(function(a, b){ return a + b; }, 0);
    var score = items.reduce(function(a, q, i){ return a + right[i] * pointsOf(q, pts); }, 0);
    return {s:s, right:right, raw:raw, score:score};
  });
  var full = items.reduce(function(a, q){ return a + pointsOf(q, pts); }, 0);
  var raws = R.map(function(x){ return x.raw; }), scores = R.map(function(x){ return x.score; });
  var varRaw = Math.pow(sdPop(raws), 2), St = sdPop(raws);
  // 高低分組：依答對題數排序（同分維持原順序），各取 27%
  var sorted = R.map(function(x, i){ return {x:x, i:i}; }).sort(function(a, b){ return b.x.raw - a.x.raw || a.i - b.i; }).map(function(o){ return o.x; });
  var g = N ? Math.max(1, Math.round(N * (o.groupRatio || .27))) : 0;
  var upper = sorted.slice(0, g), lower = sorted.slice(N - g);
  var sumPQ = 0;
  var per = items.map(function(q, i){
    var c = R.filter(function(x){ return x.right[i]; }).length, p = N ? c / N : 0;
    sumPQ += p * (1 - p);
    var PH = g ? upper.filter(function(x){ return x.right[i]; }).length / g : 0, PL = g ? lower.filter(function(x){ return x.right[i]; }).length / g : 0;
    var D = PH - PL;
    var Mp = mean(R.filter(function(x){ return x.right[i]; }).map(function(x){ return x.raw; })), Mq = mean(R.filter(function(x){ return !x.right[i]; }).map(function(x){ return x.raw; }));
    var rpb = St > 0 && p > 0 && p < 1 ? (Mp - Mq) / St * Math.sqrt(p * (1 - p)) : null;
    var dist = null, flags = [];
    if(q.type === 's' || q.type === 't'){
      var nOpt = q.type === 't' ? 2 : q.opts.length;
      dist = [];
      for(var oi = 0; oi < nOpt; oi++){
        var L = LETTERS[oi];
        var pick = function(arr){ return arr.filter(function(x){ return x.s.answers[q.id] === L; }).length; };
        dist.push({L:L, text:q.type === 't' ? (oi ? '✕ 錯' : '○ 對') : q.opts[oi], key:q.ans === L, all:pick(R), hi:pick(upper), lo:pick(lower)});
      }
      dist.push({L:'—', text:'未作答／其他', key:false, all:R.filter(function(x){ var a = x.s.answers[q.id]; return !a || LETTERS.indexOf(a) >= nOpt || a.length > 1; }).length, hi:0, lo:0});
      if(N >= 5) dist.forEach(function(d){
        if(d.key || d.L === '—') return;
        if(d.all === 0 && q.type === 's') flags.push({k:'dead', t:'選項 ' + d.L + ' 沒人選（誘答力不足）'});
        else if(d.hi - d.lo >= Math.max(1, Math.ceil(g * .15))) flags.push({k:'lure', t:'選項 ' + d.L + ' 高分組選得比低分組多（可能有爭議）'});
      });
    }
    if(N){
      if(p > .9) flags.unshift({k:'easy', t:'太簡單（答對率 ' + Math.round(p * 100) + '%）'});
      else if(p < .2) flags.unshift({k:'hard', t:'太難（答對率 ' + Math.round(p * 100) + '%）'});
      if(D < 0) flags.unshift({k:'neg', t:'鑑別度是負的：低分組答得比高分組好，請檢查答案是否有誤'});
      else if(D < .2) flags.unshift({k:'low', t:'鑑別度偏低（D＝' + D.toFixed(2) + '）'});
    }
    return {id:q.id, n:i + 1, P:p, PH:PH, PL:PL, D:D, rpb:rpb, right:c, dist:dist, flags:flags};
  });
  var kr20 = k > 1 && varRaw > 0 ? (k / (k - 1)) * (1 - sumPQ / varRaw) : null;
  var bins = []; for(var b = 0; b < 10; b++) bins.push(0);
  scores.forEach(function(s){ var pct = full ? s / full * 100 : 0; bins[Math.min(9, Math.floor(pct / 10))]++; });
  return {N:N, k:k, full:full, mean:mean(scores), sd:sdPop(scores), meanRaw:mean(raws), max:N ? Math.max.apply(null, scores) : 0, min:N ? Math.min.apply(null, scores) : 0,
    kr20:kr20, g:g, items:per, students:R.map(function(x){ return {sid:x.s.sid, name:x.s.name, ver:x.s.ver, raw:x.raw, score:x.score, right:x.right}; }), bins:bins};
}
function krLabel(v){ if(v == null) return '無法計算'; if(v >= .8) return '很好'; if(v >= .7) return '可接受'; if(v >= .5) return '偏低（隨堂小考常見）'; return '偏低'; }

// 範例作答：依能力模型模擬，給「試試看」與測試用
function simulate(items, versions, n, seed){
  var r = rng(seed == null ? 7 : seed), rows = [['學號', '姓名', '卷別']];
  var nq = items.length; for(var i = 1; i <= nq; i++) rows[0].push(String(i));
  var byId = {}; items.forEach(function(q){ byId[q.id] = q; });
  for(var s = 0; s < n; s++){
    var ver = versions[s % versions.length], ab = r() * 2 - .6, row = ['S' + ('00' + (s + 1)).slice(-3), '學員' + (s + 1), ver.name];
    ver.order.forEach(function(id){
      var q = viewQ(byId[id], ver), d = (q.diff == null ? 1 : q.diff) - 1, pr = 1 / (1 + Math.exp(-(ab * 1.6 - d)));
      if(r() < .03){ row.push(''); return; }
      if(q.type === 'f'){ row.push(r() < pr ? str(q.ans).split(/[／\/|]/)[0] : '不知道'); return; }
      if(q.type === 't'){ var ok = r() < pr; row.push(ok ? (q.ans === 'A' ? '對' : '錯') : (q.ans === 'A' ? '錯' : '對')); return; }
      if(r() < pr){ row.push(q.ans); return; }
      var wrong = LETTERS.slice(0, q.opts.length).split('').filter(function(L){ return q.ans.indexOf(L) < 0; });
      row.push(wrong.length ? wrong[Math.floor(r() * wrong.length)] : q.ans);
    });
    rows.push(row);
  }
  return rows;
}

var API = {TYPES:TYPES, BLOOM:BLOOM, DIFF:DIFF, LETTERS:LETTERS, normKey:normKey, hash:hash, rng:rng, shuffle:shuffle,
  cleanText:cleanText, splitSentences:splitSentences, extractFacts:extractFacts, genRuleQuestions:genRuleQuestions,
  mkQ:mkQ, checkQ:checkQ, dedupe:dedupe, stemKey:stemKey, ansText:ansText, fromSimple:fromSimple, toTchRows:toTchRows, toBankRows:toBankRows,
  chunkPages:chunkPages, aiPrompt:aiPrompt, parseAiJson:parseAiJson, findQuote:findQuote, validateAiQuestions:validateAiQuestions,
  pickByBlueprint:pickByBlueprint, makeVersions:makeVersions, viewQ:viewQ, toMaster:toMaster, pointsOf:pointsOf, blueprintTable:blueprintTable,
  FORM_STYLES:FORM_STYLES, SEC_MODES:SEC_MODES, FIELD_TYPES:FIELD_TYPES, FIELD_VALID:FIELD_VALID, FIELD_PRESETS:FIELD_PRESETS, cleanField:cleanField, checkFields:checkFields, sectionsOf:sectionsOf,
  gasData:gasData, toGasCode:toGasCode, parseResponses:parseResponses, isRight:isRight, analyze:analyze, krLabel:krLabel, simulate:simulate};
if(typeof module !== 'undefined' && module.exports) module.exports = API; else root.LQB = API;
})(this);
