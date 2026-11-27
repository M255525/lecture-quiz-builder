/* 講義出題試卷工坊：畫面
   ① 講義（PDF／PPTX／DOCX／TXT 逐頁取字）→ ② 出題審題（規則＋選用 BYOK AI）→ ③ 組卷（細目表、A/B 卷、列印、Google 表單 GAS）→ ④ 試題分析
   範本骨架：跑馬燈、⚙ 常用設定（收合式）、首訪警語、手冊／創作者／加入主畫面／訪客數、備份還原、大字、列印浮水印、序號閘門。 */
(function(){
'use strict';
var D = window.LQB, IO = window.LQBIO, PDF = window.LQBPDF, PFX = 'lqb.';
var MK = window.MKCourse && window.MKCourse.store ? window.MKCourse : null;
function lsGet(k){ try{ return localStorage.getItem(PFX + k); }catch(e){ return null; } }
function lsSet(k, v){ try{ localStorage.setItem(PFX + k, v); return true; }catch(e){ return false; } }
function lsDel(k){ try{ localStorage.removeItem(PFX + k); }catch(e){} }
function lsJson(k, d){ try{ var v = JSON.parse(lsGet(k)); return v == null ? d : v; }catch(e){ return d; } }
function $(id){ return document.getElementById(id); }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]; }); }
function today(){ var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function cut(s, n){ s = String(s || ''); return Array.from(s).length > n ? Array.from(s).slice(0, n).join('') + '…' : s; }
function pct(v){ return v == null || !isFinite(v) ? '—' : Math.round(v * 100) + '%'; }
function f2(v){ return v == null || !isFinite(v) ? '—' : (Math.round(v * 100) / 100).toFixed(2); }
var L = D.LETTERS;

var COUNTER = 'https://visitor-badge.laobi.icu/badge?page_id=m255525.lecturequizbuilder';
var standalone = window.matchMedia && matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
var TABS = [['src', '① 講義'], ['bank', '② 出題審題'], ['paper', '③ 組卷'], ['ana', '④ 試題分析'], ['about', '說明']];
var V = {tab:lsGet('tab') || 'src', files:{}, filt:{status:'all', ch:'', type:'', q:''}, show:60, resp:null, ana:null, busy:false, aiBatch:0, students:null};
if(!TABS.some(function(t){ return t[0] === V.tab; })) V.tab = 'src';

/* ---------- 資料 ---------- */
function defCfg(){
  return {paper:{title:'課後測驗', cls:'', date:today(), minutes:30, desc:'請依題目作答，選擇題請在答案卡上劃記。', ids:[], pts:{s:2, m:3, t:1, f:2}, nVer:2, seed:1234, shuffle:1, types:{s:1, m:1, t:1, f:1}, bp:{}},
    gen:{types:{s:1, m:1, t:1, f:1}, aiN:10, aiTypes:{s:1, m:1, t:1, f:0}, aiBloom:{'記憶':1, '理解':1, '應用':1, '分析':0}, aiDiff:''},
    gas:{askId:1, askName:1, email:0, sheet:1, required:1, feedback:1, shuffleQ:0}, mk:null, fin:null};
}
function loadCfg(){ var c = lsJson('cfg', null), d = defCfg(); if(!c) return d; ['paper', 'gen', 'gas'].forEach(function(k){ c[k] = Object.assign({}, d[k], c[k] || {}); }); return Object.assign(d, c); }
var S = {docs:lsJson('docs', []), bank:lsJson('bank', []), cfg:loadCfg()};
var warnedQuota = false;
function save(){
  var ok = lsSet('cfg', JSON.stringify(S.cfg)) & lsSet('bank', JSON.stringify(S.bank)) & lsSet('docs', JSON.stringify(S.docs));
  if(!ok && !warnedQuota){ warnedQuota = true; toast('⚠ 瀏覽器空間不夠，講義文字可能沒存起來；請刪掉不用的講義或下載備份'); }
}
function P(){ return S.cfg.paper; }
function byId(id){ for(var i = 0; i < S.bank.length; i++) if(S.bank[i].id === id) return S.bank[i]; return null; }
function chapters(list){ var a = []; (list || S.bank).forEach(function(q){ var c = q.chapter || '（未分章）'; if(a.indexOf(c) < 0) a.push(c); }); return a; }

// 頁碼範圍「1-3,5」→ 頁碼陣列；空白＝全部
function parseRange(s, n){
  s = String(s || '').replace(/[，、\s]+/g, ',').replace(/[～~－—]/g, '-');
  if(!s.replace(/,/g, '')) return null;
  var out = {};
  s.split(',').forEach(function(p){ var m = /^(\d+)(?:-(\d+))?$/.exec(p); if(!m) return; var a = +m[1], b = m[2] ? +m[2] : a; if(a > b){ var t = a; a = b; b = t; } for(var i = a; i <= Math.min(b, n); i++) out[i] = 1; });
  return out;
}
function selPages(){
  var out = [];
  S.docs.forEach(function(d){
    if(d.off) return;
    var r = parseRange(d.range, d.pages.length);
    d.pages.forEach(function(p){ if(!r || r[p.page]) out.push({doc:d.id, file:d.file, chapter:d.chapter || d.file, page:p.page, text:p.text}); });
  });
  return out;
}

/* ---------- 畫面 ---------- */
function render(){
  var licTop = '<button class="ibtn lictop" id="licTop" data-act="settings" hidden></button>';
  var h = '<div class="bar"><h1><span class="seal">卷</span>講義出題試卷工坊<small>多份講義 PDF → 出題審題 → A/B 卷試卷 → Google 表單 → 試題分析</small></h1>' +
    licTop + '<a class="ibtn noprint" href="manual.html">📖 操作手冊</a><button class="ibtn" data-act="settings" aria-label="常用設定">⚙</button></div>' +
    '<p class="warn-line">題目由規則或 AI 產生，須由講師審題後使用；講義與教材的著作權請自行確認<button data-act="warn">⚠ 使用警語</button></p>' +
    '<nav class="tabs" role="tablist">' + TABS.map(function(t){ return '<button role="tab" data-tab="' + t[0] + '" aria-selected="' + (V.tab === t[0]) + '">' + t[1] + '<span class="tcount" id="tc-' + t[0] + '"></span></button>'; }).join('') + '</nav>' +
    TABS.map(function(t){ return '<section class="panel" data-p="' + t[0] + '" id="panel-' + t[0] + '"' + (V.tab === t[0] ? '' : ' hidden') + '></section>'; }).join('') +
    '<footer class="foot">👤 創作者 Mark Tsai（蔡豐全）・<a href="manual.html">📖 操作手冊</a>・<a href="#" data-act="warn">⚠ 使用警語</a>' + (standalone ? '' : '・<a href="#" data-act="install">📲 加入主畫面</a>') +
    '<br><span class="small">PDF 讀取使用 Mozilla PDF.js（Apache-2.0）</span><br><img src="' + COUNTER + '" alt="訪客次數" height="20" loading="lazy" style="vertical-align:middle;margin-top:.4rem"></footer>';
  $('app').innerHTML = h;
  showLicTop();
  TABS.forEach(function(t){ panel(t[0]); });
}
function panel(name){
  var el = $('panel-' + name); if(!el) return;
  el.innerHTML = {src:srcHTML, bank:bankHTML, paper:paperHTML, ana:anaHTML, about:aboutHTML}[name]();
  counts();
}
function counts(){
  var ok = S.bank.filter(function(q){ return q.status === 'ok'; }).length;
  var set = function(id, t){ var e = $('tc-' + id); if(e) e.textContent = t; };
  set('src', S.docs.length ? ' ' + S.docs.length : '');
  set('bank', S.bank.length ? ' ' + ok + '/' + S.bank.length : '');
  set('paper', P().ids.length ? ' ' + P().ids.length + '題' : '');
  set('ana', V.ana ? ' ' + V.ana.N + '人' : '');
}
function chk(path, label, on){ return '<label class="ck"><input type="checkbox" data-bind="' + path + '"' + (on ? ' checked' : '') + '> ' + label + '</label>'; }
function get(path){ return path.split('.').reduce(function(o, k){ return o == null ? o : o[k]; }, S.cfg); }

/* ① 講義 */
function srcHTML(){
  var tp = 0, tc = 0, ts = 0;
  S.docs.forEach(function(d){ tp += d.pages.length; d.pages.forEach(function(p){ tc += p.text.length; if(p.scan) ts++; }); });
  var sel = selPages().length;
  var h = '<div class="card"><h3>匯入講義</h3><p class="small">可以一次選好幾份。支援 <b>PDF</b>（要能選取文字的版本）、<b>PowerPoint .pptx</b>、Word .docx、純文字 .txt／.md。檔案只在這台電腦的瀏覽器裡讀取，<b>不會上傳</b>；只保留取出的文字。</p>' +
    '<label class="drop" id="drop"><input type="file" id="srcFile" multiple accept=".pdf,.pptx,.docx,.txt,.md,application/pdf"><span class="big">📄 選擇或拖曳講義檔案到這裡</span><span class="small">一份檔案＝一個章節（名稱之後可以改）</span></label>' +
    '<div class="btns"><button class="btn alt" data-act="sample">🧪 載入範例講義</button><button class="btn alt" data-act="pasteSrc">📋 直接貼上講義文字</button></div>' +
    '<div id="srcProg" class="small" role="status"></div></div>';
  if(S.docs.length){
    h += '<div class="card"><h3>已匯入 ' + S.docs.length + ' 份講義</h3><p class="small">共 ' + tp + ' 頁、' + tc.toLocaleString() + ' 字；出題會用 <b>' + sel + '</b> 頁' + (ts ? '；<b class="bad">' + ts + ' 頁可能是掃描圖</b>（取不到文字）' : '') + '。</p>';
    S.docs.forEach(function(d){
      var r = parseRange(d.range, d.pages.length), scans = d.pages.filter(function(p){ return p.scan; });
      h += '<div class="doc' + (d.off ? ' off' : '') + '"><div class="doc-h"><label class="ck"><input type="checkbox" data-docon="' + d.id + '"' + (d.off ? '' : ' checked') + '> 用來出題</label>' +
        '<b class="fname">' + esc(d.file) + '</b><span class="tag">' + {pdf:'PDF', pptx:'簡報', docx:'Word', text:'文字'}[d.kind] + '・' + d.pages.length + ' ' + (d.kind === 'pptx' ? '張' : d.kind === 'pdf' ? '頁' : '段') + '</span>' +
        '<button class="ibtn sm" data-act="delDoc" data-id="' + d.id + '">🗑</button></div>' +
        '<div class="row"><label class="fld">章節名稱<input data-docch="' + d.id + '" value="' + esc(d.chapter) + '"><small>組卷的細目表依章節分</small></label>' +
        '<label class="fld">只用這些頁<input data-docrange="' + d.id + '" value="' + esc(d.range || '') + '" placeholder="空白＝全部，例如 1-5,8"><small>' + (r ? '已選 ' + Object.keys(r).length + ' 頁' : '全部 ' + d.pages.length + ' 頁') + '</small></label></div>' +
        (scans.length ? '<p class="small bad">⚠ 第 ' + scans.map(function(p){ return p.page; }).join('、') + ' 頁幾乎沒有文字，可能是掃描圖。' + (d.kind === 'pdf' ? (V.files[d.id] ? '可以按下方「🤖 AI 看圖取字」（要先在 ⚙ 設定 AI 金鑰）。' : '要用 AI 看圖取字，請重新選擇這份 PDF（PDF 檔不會存起來）。') : '') + '</p>' : '') +
        '<details><summary>看取出的文字</summary><div class="pages">' + d.pages.map(function(p){
          return '<div class="pg' + (p.scan ? ' scan' : '') + '"><div class="pg-h">第 ' + p.page + (d.kind === 'pptx' ? ' 張' : d.kind === 'pdf' ? ' 頁' : ' 段') + '・' + p.text.length + ' 字' + (p.ocr ? '・🤖 AI 看圖取字' : '') +
            (p.scan && d.kind === 'pdf' && V.files[d.id] ? ' <button class="ibtn sm" data-act="ocr" data-id="' + d.id + '" data-page="' + p.page + '">🤖 AI 看圖取字</button>' : '') + '</div><pre>' + esc(cut(p.text, 400)) + '</pre></div>';
        }).join('') + '</div></details></div>';
    });
    h += '<div class="btns"><button class="btn" data-tab="bank">下一步：② 出題 →</button></div></div>';
  }
  h += '<div class="card"><h3>或匯入現成的題目</h3><p class="small">已經有題目（Word、Excel、CSV、文字）也可以直接放進題庫，格式與講師課堂小幫手相同：「1. 題目」「(A) 選項」「答案：B」，或表格欄位「題目｜選項A…｜答案」。</p>' +
    '<div class="btns"><label class="btn alt"><input type="file" id="quizFile" accept=".docx,.xlsx,.csv,.txt,.md" hidden>📂 選擇題目檔</label></div>' +
    '<label class="fld">或貼上題目<textarea id="quizPaste" rows="4" placeholder="1. 下列何者…？\n(A) 甲 (B) 乙 (C) 丙 (D) 丁\n答案：B"></textarea></label><div class="btns"><button class="btn alt" data-act="quizPaste">匯入貼上的題目</button></div></div>';
  return h;
}

/* ② 出題審題 */
function bankFiltered(){
  var f = V.filt, q = f.q.trim().toLowerCase();
  return S.bank.filter(function(x){
    if(f.status === 'draft' && x.status === 'ok') return false;
    if(f.status === 'ok' && x.status !== 'ok') return false;
    if(f.status === 'warn' && !(x.warn && x.warn.length)) return false;
    if(f.status === 'paper' && P().ids.indexOf(x.id) < 0) return false;
    if(f.ch && (x.chapter || '（未分章）') !== f.ch) return false;
    if(f.type && x.type !== f.type) return false;
    if(q && (x.q + x.opts.join(' ') + (x.src ? x.src.quote : '')).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
}
function qCard(q, i, o){
  o = o || {};
  var inPaper = P().ids.indexOf(q.id) >= 0;
  var opts = '';
  if(q.type === 's' || q.type === 'm') opts = '<ol class="opts">' + q.opts.map(function(x, k){ var right = q.ans.indexOf(L[k]) >= 0; return '<li class="' + (right ? 'right' : '') + '"><b>(' + L[k] + ')</b> ' + esc(x) + (right ? ' <span class="mark">✔</span>' : '') + '</li>'; }).join('') + '</ol>';
  else opts = '<p class="ansline">答案：<b class="red">' + esc(D.ansText(q)) + '</b></p>';
  var org = {rule:'規則', ai:'AI', import:'匯入', manual:'手動'}[q.origin] || q.origin;
  var st = q.stats && q.stats.length ? q.stats[q.stats.length - 1] : null;
  return '<article class="qc' + (q.status === 'ok' ? ' ok' : '') + (q.warn && q.warn.length ? ' warned' : '') + '" data-qid="' + q.id + '">' +
    '<div class="qh"><span class="qn">' + (i + 1) + '</span><span class="tag t-' + q.type + '">' + D.TYPES[q.type] + '</span><span class="tag">' + org + '</span><span class="tag">' + esc(q.chapter || '未分章') + '</span><span class="tag">' + (D.DIFF[q.diff] || '中') + '・' + esc(q.bloom) + '</span>' +
    (q.status === 'ok' ? '<span class="stamp">已審</span>' : '<span class="tag draft">待審</span>') + (q.warn || []).map(function(w){ return '<span class="tag warnb">⚠ ' + esc(w) + '</span>'; }).join('') +
    (st ? '<span class="tag">上次 P=' + pct(st.P) + '・D=' + f2(st.D) + '</span>' : '') + '</div>' +
    '<p class="qq">' + esc(q.q) + '</p>' + opts +
    (q.src ? '<p class="src">📄 ' + esc(q.src.file) + ' 第 ' + q.src.page + ' 頁：「' + esc(cut(q.src.quote, 80)) + '」</p>' : '') +
    (q.explain ? '<p class="src">💡 ' + esc(cut(q.explain, 120)) + '</p>' : '') +
    (o.noBtns ? '' : '<div class="qb">' + (q.status === 'ok' ? '<button class="ibtn sm" data-act="unok" data-id="' + q.id + '">↩ 改回待審</button>' : '<button class="ibtn sm okb" data-act="ok" data-id="' + q.id + '">✓ 採用</button>') +
      '<button class="ibtn sm" data-act="edit" data-id="' + q.id + '">✎ 修改</button><button class="ibtn sm" data-act="del" data-id="' + q.id + '">🗑 刪除</button>' +
      (q.status === 'ok' ? '<button class="ibtn sm" data-act="toPaper" data-id="' + q.id + '">' + (inPaper ? '－ 移出試卷' : '＋ 加入試卷') + '</button>' : '') + '</div>') +
    '</article>';
}
function bankHTML(){
  var g = S.cfg.gen, pages = selPages(), batches = D.chunkPages(pages);
  var aiReady = window.TOOL_AI && TOOL_AI.ready();
  var h = '<div class="card"><h3>出題</h3>' + (pages.length ? '<p class="small">會從 ① 選的 <b>' + pages.length + '</b> 頁講義出題。每一題都會標出處（檔名、頁碼、原句），<b>都要經過你審題「✓ 採用」才能組卷</b>。</p>' : '<p class="bad">還沒有講義，請先到 ① 匯入講義（或按「🧪 載入範例講義」試試）。</p>') +
    '<div class="gen2"><div class="gbox"><h4>⚙ 規則出題（免金鑰）</h4><p class="small">從講義裡的定義句（「X 是指…」「…稱為 X」「X：說明」）、列舉句（「X 包括 A、B、C」、標題＋條列）、數字句出題。誘答選項只用講義裡出現過的名詞和數字。</p>' +
      '<div class="cks">' + chk('gen.types.s', '單選', g.types.s) + chk('gen.types.m', '多選', g.types.m) + chk('gen.types.t', '是非', g.types.t) + chk('gen.types.f', '填空', g.types.f) + '</div>' +
      '<div class="btns"><button class="btn" data-act="ruleGen"' + (pages.length ? '' : ' disabled') + '>⚙ 規則出題</button></div></div>' +
    '<div class="gbox"><h4>✨ AI 出題（選用）</h4><p class="small">用你自己的 AI 金鑰（⚙ 設定），可以出理解、應用題。講義會分 <b>' + batches.length + '</b> 批送出。AI 的每一題都要附講義原句，<b>原句在講義裡找不到的會標「⚠ 找不到出處」</b>。</p>' +
      '<div class="row"><label class="fld">每批題數<input type="number" min="1" max="40" data-bind="gen.aiN" value="' + esc(g.aiN) + '"></label><label class="fld">難度<select data-bind="gen.aiDiff"><option value="">易中難都要有</option><option' + (g.aiDiff === '以中等為主' ? ' selected' : '') + '>以中等為主</option><option' + (g.aiDiff === '以簡單為主' ? ' selected' : '') + '>以簡單為主</option><option' + (g.aiDiff === '以較難為主' ? ' selected' : '') + '>以較難為主</option></select></label></div>' +
      '<div class="cks">題型：' + chk('gen.aiTypes.s', '單選', g.aiTypes.s) + chk('gen.aiTypes.m', '多選', g.aiTypes.m) + chk('gen.aiTypes.t', '是非', g.aiTypes.t) + chk('gen.aiTypes.f', '填空', g.aiTypes.f) + '</div>' +
      '<div class="cks">認知層次：' + D.BLOOM.map(function(b){ return chk('gen.aiBloom.' + b, b, g.aiBloom[b]); }).join('') + '</div>' +
      '<div class="btns"><button class="btn" data-act="aiGen"' + (pages.length ? '' : ' disabled') + '>✨ AI 出題' + (aiReady ? '' : '（要先設定金鑰）') + '</button></div>' +
      '<details class="mini"><summary>沒有金鑰？複製提示詞貼到任何 AI，再把回覆貼回來</summary>' +
        '<div class="row"><label class="fld">第幾批<select id="aiBatch">' + batches.map(function(b, i){ return '<option value="' + i + '"' + (i === V.aiBatch ? ' selected' : '') + '>第 ' + (i + 1) + ' 批：' + esc(cut(b[0].file, 14)) + ' 第 ' + b[0].page + (b.length > 1 ? '～' + b[b.length - 1].page : '') + ' 頁</option>'; }).join('') + '</select></label></div>' +
        '<div class="btns"><button class="btn alt" data-act="aiCopy">📋 複製這批的提示詞</button></div>' +
        '<label class="fld">把 AI 的回覆（JSON）貼在這裡<textarea id="aiPaste" rows="4" placeholder="{&quot;questions&quot;:[ … ]}"></textarea></label><div class="btns"><button class="btn alt" data-act="aiImport">匯入 AI 回覆</button></div></details>' +
      '<div id="aiOut" class="small" role="status"></div></div></div></div>';
  var list = bankFiltered(), ok = S.bank.filter(function(q){ return q.status === 'ok'; }).length;
  h += '<div class="card"><h3>題庫　<span class="small">共 ' + S.bank.length + ' 題，已審 ' + ok + ' 題</span></h3>' +
    '<div class="filt"><select data-filt="status"><option value="all">全部</option><option value="draft"' + (V.filt.status === 'draft' ? ' selected' : '') + '>待審</option><option value="ok"' + (V.filt.status === 'ok' ? ' selected' : '') + '>已審</option><option value="warn"' + (V.filt.status === 'warn' ? ' selected' : '') + '>⚠ 有警告</option><option value="paper"' + (V.filt.status === 'paper' ? ' selected' : '') + '>在試卷裡</option></select>' +
    '<select data-filt="ch"><option value="">全部章節</option>' + chapters().map(function(c){ return '<option' + (V.filt.ch === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
    '<select data-filt="type"><option value="">全部題型</option>' + Object.keys(D.TYPES).map(function(t){ return '<option value="' + t + '"' + (V.filt.type === t ? ' selected' : '') + '>' + D.TYPES[t] + '</option>'; }).join('') + '</select>' +
    '<input data-filt="q" placeholder="搜尋題目或原文" value="' + esc(V.filt.q) + '"></div>' +
    '<div class="btns"><button class="btn alt" data-act="okAll"' + (list.length ? '' : ' disabled') + '>✓ 篩選出的 ' + list.length + ' 題全部採用</button><button class="btn alt" data-act="delAll"' + (list.length ? '' : ' disabled') + '>🗑 刪除篩選出的題目</button><button class="btn alt" data-act="newQ">＋ 手動新增</button></div>' +
    '<div class="btns"><button class="btn alt" data-act="expBank">📥 題庫 Excel</button><button class="btn alt" data-act="expTch">📥 給課堂小幫手的 Excel</button><button class="btn alt" data-act="expJson">📥 題庫 .json</button><label class="btn alt"><input type="file" id="bankFile" accept=".json" hidden>📂 匯入題庫 .json</label></div>' +
    '<div id="bankList">' + (list.length ? list.slice(0, V.show).map(function(q, i){ return qCard(q, i); }).join('') : '<p class="small">這裡還沒有題目。</p>') + '</div>' +
    (list.length > V.show ? '<div class="btns"><button class="btn alt" data-act="more">再顯示 60 題（還有 ' + (list.length - V.show) + ' 題）</button></div>' : '') + '</div>';
  return h;
}

/* ③ 組卷 */
function paperItems(){ return P().ids.map(byId).filter(Boolean); }
function paperHTML(){
  var p = P(), items = paperItems(), ok = S.bank.filter(function(q){ return q.status === 'ok'; });
  var full = items.reduce(function(a, q){ return a + D.pointsOf(q, p.pts); }, 0);
  var h = '<div class="card"><h3>試卷資料</h3><div class="row">' +
    '<label class="fld">試卷標題<input data-bind="paper.title" value="' + esc(p.title) + '"></label>' +
    '<label class="fld">課程／班級<input data-bind="paper.cls" value="' + esc(p.cls) + '"></label>' +
    '<label class="fld">日期<input type="date" data-bind="paper.date" value="' + esc(p.date) + '"></label>' +
    '<label class="fld">作答時間（分鐘）<input type="number" min="0" data-bind="paper.minutes" value="' + esc(p.minutes) + '"></label></div>' +
    '<label class="fld">作答說明<textarea rows="2" data-bind="paper.desc">' + esc(p.desc) + '</textarea></label>' +
    (MK ? '<div class="btns"><button class="btn alt" data-act="mkPick">📂 從課程專案帶入' + (S.cfg.mk ? '（已連結）' : '') + '</button></div><p class="small">帶入課程名稱與學員名單，可以印出一人一張有名字的答案卡、把成績寫回課程專案。</p>' : '') + '</div>';
  // 細目表
  var chs = chapters(ok);
  h += '<div class="card"><h3>雙向細目表抽題</h3>' + (ok.length ? '<p class="small">在每一格填要幾題（章節 × 認知層次），只會從<b>已審</b>的題目抽。格子右下角是目前可用題數。</p>' +
    '<div class="cks">可出的題型：' + chk('paper.types.s', '單選', p.types.s) + chk('paper.types.m', '多選', p.types.m) + chk('paper.types.t', '是非', p.types.t) + chk('paper.types.f', '填空', p.types.f) + '</div>' +
    '<div class="tscroll"><table class="bp"><thead><tr><th>章節＼層次</th>' + D.BLOOM.map(function(b){ return '<th>' + b + '</th>'; }).join('') + '<th>小計</th></tr></thead><tbody>' +
    chs.map(function(c){
      var sum = 0;
      return '<tr><th>' + esc(c) + '</th>' + D.BLOOM.map(function(b){
        var k = c + '|' + b, n = +(p.bp[k] || 0); sum += n;
        var av = ok.filter(function(q){ return (q.chapter || '（未分章）') === c && q.bloom === b && p.types[q.type]; }).length;
        return '<td><input type="number" min="0" max="' + av + '" data-bp="' + esc(k) + '" value="' + (n || '') + '"' + (av ? '' : ' disabled') + '><small class="' + (n > av ? 'bad' : '') + '">/' + av + '</small></td>';
      }).join('') + '<td class="num">' + sum + '</td></tr>';
    }).join('') + '</tbody></table></div>' +
    '<div class="btns"><button class="btn" data-act="pick">🎲 依細目表抽題</button><button class="btn alt" data-act="reroll">🔄 換一組題目</button><button class="btn alt" data-act="pickAll">全部已審題目都放進來</button></div><div id="pickOut" class="small"></div>'
    : '<p class="bad">題庫裡還沒有「已審」的題目，請先到 ② 審題按「✓ 採用」。</p>') + '</div>';
  // 試卷題目
  h += '<div class="card"><h3>試卷題目　<span class="small">' + items.length + ' 題・總分 ' + full + ' 分</span></h3>' +
    '<div class="row pts">' + Object.keys(D.TYPES).map(function(t){ return '<label class="fld">' + D.TYPES[t] + '每題<input type="number" min="0" step="0.5" data-bind="paper.pts.' + t + '" value="' + esc(p.pts[t]) + '"><small>分（' + items.filter(function(q){ return q.type === t; }).length + ' 題）</small></label>'; }).join('') + '</div>' +
    (items.length ? '<ol class="plist">' + items.map(function(q, i){ return '<li><span class="tag t-' + q.type + '">' + D.TYPES[q.type] + '</span> ' + esc(cut(q.q, 60)) + ' <span class="small">（' + esc(q.chapter) + '）</span><span class="pbtn"><button class="ibtn sm" data-act="up" data-i="' + i + '" aria-label="上移">↑</button><button class="ibtn sm" data-act="down" data-i="' + i + '" aria-label="下移">↓</button><button class="ibtn sm" data-act="rm" data-i="' + i + '" aria-label="移出">✕</button></span></li>'; }).join('') + '</ol>' : '<p class="small">還沒有題目：用上面的細目表抽題，或到 ② 題庫按「＋ 加入試卷」。</p>') +
    '<div class="btns"><button class="btn alt" data-act="addPick">＋ 手動挑題</button>' + (items.length ? '<button class="btn alt" data-act="clearPaper">清空試卷</button>' : '') + '</div></div>';
  // 輸出
  var hasF = items.some(function(q){ return q.type === 'f'; });
  h += '<div class="card"><h3>卷別與列印</h3><div class="row">' +
    '<label class="fld">幾種卷<select data-bind="paper.nVer" data-num="1">' + [1, 2, 3, 4].map(function(n){ return '<option value="' + n + '"' + (+p.nVer === n ? ' selected' : '') + '>' + (n === 1 ? '只有 A 卷' : 'A～' + L[n - 1] + ' 卷（' + n + ' 種）') + '</option>'; }).join('') + '</select><small>A 卷是原順序；B 卷以後同一大題內打亂題目順序</small></label>' +
    '<label class="fld">亂數種子<input type="number" data-bind="paper.seed" value="' + esc(p.seed) + '"><small>種子一樣，每次印出來的卷子都一樣</small></label></div>' +
    '<div class="cks">' + chk('paper.shuffle', 'B 卷以後選項也打亂（有「以上皆是」的題目不打亂）', p.shuffle) + '</div>' +
    '<div class="btns"><button class="btn" data-act="prPaper"' + (items.length ? '' : ' disabled') + '>🖨 試卷</button><button class="btn alt" data-act="prCard"' + (items.length ? '' : ' disabled') + '>🖨 答案卡</button><button class="btn alt" data-act="prKey"' + (items.length ? '' : ' disabled') + '>🖨 解答本</button><button class="btn alt" data-act="prBp"' + (items.length ? '' : ' disabled') + '>🖨 雙向細目表</button></div>' +
    '<p class="small">印出或產生表單時會把這份試卷「定案」，④ 試題分析就用定案的版本對答案。' + (S.cfg.fin ? '目前定案：<b>' + esc(S.cfg.fin.title) + '</b>（' + S.cfg.fin.items.length + ' 題、' + S.cfg.fin.versions.length + ' 種卷，' + esc(S.cfg.fin.at) + '）' : '') + '</p></div>';
  var g = S.cfg.gas;
  h += '<div class="card gascard"><h3>📝 轉成 Google 表單測驗</h3><p class="small">產生一段 <b>Google Apps Script</b> 程式碼，貼到 script.google.com 執行一次，就會在你自己的 Google 雲端硬碟建好「測驗模式」的 Google 表單（自動計分、標好正確答案與配分）。本工具不會連到你的 Google 帳號。</p>' +
    '<div class="cks">' + chk('gas.askId', '開頭要填學號', g.askId) + chk('gas.askName', '開頭要填姓名', g.askName) + chk('gas.email', '收集 Email', g.email) + chk('gas.required', '每題必填', g.required) + chk('gas.feedback', '答題回饋附出處頁碼與解析', g.feedback) + chk('gas.sheet', '一併建立回覆試算表', g.sheet) + chk('gas.shuffleQ', '表單也打亂題目順序', g.shuffleQ) + '</div>' +
    (hasF ? '<p class="small bad">⚠ 試卷裡有填空題：Apps Script 不能設定簡答題的標準答案，表單裡要手動評分（或先改成選擇題）。</p>' : '') +
    (+p.nVer > 1 ? '<p class="small">有 ' + p.nVer + ' 種卷：會建 ' + p.nVer + ' 份表單（每卷一份），回覆分開收。</p>' : '') +
    (g.shuffleQ ? '<p class="small bad">⚠ 表單打亂題目順序後，回覆試算表的欄位仍是原順序，可以照常分析。</p>' : '') +
    '<div class="btns"><button class="btn" data-act="gas"' + (items.length ? '' : ' disabled') + '>📋 產生 Apps Script 程式碼</button></div></div>';
  return h;
}

/* ④ 試題分析 */
function anaHTML(){
  var fin = S.cfg.fin;
  if(!fin) return '<div class="card"><h3>試題分析</h3><p class="bad">還沒有定案的試卷。請先到 ③ 組卷，按「🖨 試卷」或「📋 產生 Apps Script 程式碼」，試卷就會定案。</p></div>';
  var h = '<div class="card"><h3>作答資料</h3><p>分析的試卷：<b>' + esc(fin.title) + '</b>（' + fin.items.length + ' 題、' + fin.versions.length + ' 種卷，定案於 ' + esc(fin.at) + '）</p>' +
    '<p class="small">可以放：<b>Google 表單的回覆</b>（回覆試算表下載成 .csv 或 .xlsx）、<b>自己整理的作答表</b>（欄位：學號｜姓名｜卷別｜1｜2｜3…，填學生選的字母，是非填 O／X）、<b>講師課堂小幫手匯出的成績檔</b>。作答名單只放在這次開啟的記憶體，<b>不會存起來</b>；只把每題的統計數字寫回題庫。</p>' +
    '<div class="row"><label class="fld">沒有「卷別」欄時，這份檔案是<select id="respVer"><option value="auto">自動（看檔名的 A卷／B卷）</option>' + fin.versions.map(function(v, i){ return '<option value="' + i + '">' + v.name + ' 卷</option>'; }).join('') + '</select></label></div>' +
    '<div class="btns"><label class="btn"><input type="file" id="respFile" multiple accept=".csv,.xlsx,.tsv,.txt" hidden>📂 選擇作答檔（可多個）</label><button class="btn alt" data-act="sim">🧪 用模擬作答試試（40 人）</button>' + (V.resp ? '<button class="btn alt" data-act="respClear">清除作答</button>' : '') + '</div>' +
    '<details class="mini"><summary>或貼上作答表（從 Excel 複製）</summary><textarea id="respPaste" rows="4" placeholder="學號	姓名	卷別	1	2	3"></textarea><div class="btns"><button class="btn alt" data-act="respPaste">匯入貼上的作答</button></div></details>' +
    '<div id="respOut" class="small" role="status">' + (V.resp ? '已載入 <b>' + V.resp.students.length + '</b> 位學員的作答（' + esc(V.resp.formats.join('、')) + '）' + (V.resp.warn.length ? '<br><span class="bad">' + V.resp.warn.slice(0, 5).map(esc).join('<br>') + (V.resp.warn.length > 5 ? '<br>…還有 ' + (V.resp.warn.length - 5) + ' 則' : '') + '</span>' : '') : '') + '</div></div>';
  var a = V.ana;
  if(!a) return h;
  var byQ = {}; fin.items.forEach(function(q){ byQ[q.id] = q; });
  var maxBin = Math.max.apply(null, a.bins.concat([1]));
  h += '<div class="card" id="anaRep"><h3>整份試卷</h3><div class="kpis">' +
    kpi('作答人數', a.N + ' 人') + kpi('平均', (Math.round(a.mean * 10) / 10) + ' / ' + a.full) + kpi('標準差', f2(a.sd)) + kpi('最高／最低', a.max + '／' + a.min) +
    kpi('KR-20 信度', f2(a.kr20), D.krLabel(a.kr20)) + kpi('高低分組', '各 ' + a.g + ' 人', '前後 27%') + '</div>' +
    (a.N < 20 ? '<p class="small bad">⚠ 作答人數少於 20 人，鑑別度與信度的數字會很不穩定，只能參考。</p>' : '') +
    '<div class="dist" aria-label="分數分布">' + a.bins.map(function(n, i){ return '<div class="bcol"><span class="bn">' + (n || '') + '</span><span class="bbar" style="height:' + (n / maxBin * 100) + '%"></span><span class="bl">' + (i * 10) + (i === 9 ? '+' : '') + '</span></div>'; }).join('') + '</div><p class="small center">分數分布（百分制，每 10 分一格）</p></div>';
  var bad = a.items.filter(function(x){ return x.flags.length; }).length;
  h += '<div class="card"><h3>每一題　<span class="small">' + bad + ' 題需要注意</span></h3>' +
    '<p class="small">難度 P＝答對率（越高越簡單）；鑑別度 D＝高分組答對率 − 低分組答對率（0.4 以上很好、0.2 以下要檢討、負的通常是答案有問題）；點二系列相關＝這題答對與否和總分的相關。</p>' +
    '<div class="tscroll"><table class="ana"><thead><tr><th>題</th><th>題目</th><th>P</th><th>D</th><th>點二系列</th><th>判讀</th></tr></thead><tbody>' +
    a.items.map(function(x){
      var q = byQ[x.id];
      return '<tr class="' + (x.flags.some(function(f){ return f.k === 'neg'; }) ? 'neg' : x.flags.length ? 'flag' : '') + '"><td class="num">' + x.n + '</td><td>' + '<span class="tag t-' + q.type + '">' + D.TYPES[q.type] + '</span> ' + esc(cut(q.q, 40)) +
        (x.dist ? '<details class="mini"><summary>誘答分析</summary><table class="dt"><tr><th>選項</th><th>全體</th><th>高分組</th><th>低分組</th></tr>' + x.dist.map(function(d){ return '<tr class="' + (d.key ? 'key' : '') + '"><td>' + d.L + (d.key ? ' ✔' : '') + ' ' + esc(cut(d.text, 14)) + '</td><td class="num">' + d.all + '</td><td class="num">' + (d.L === '—' ? '' : d.hi) + '</td><td class="num">' + (d.L === '—' ? '' : d.lo) + '</td></tr>'; }).join('') + '</table></details>' : '') +
        '</td><td class="num">' + pct(x.P) + '</td><td class="num">' + f2(x.D) + '</td><td class="num">' + f2(x.rpb) + '</td><td>' + (x.flags.length ? x.flags.map(function(f){ return '<div class="fl fl-' + f.k + '">' + esc(f.t) + '</div>'; }).join('') : '<span class="okc">良好</span>') +
        (byId(x.id) ? '<button class="ibtn sm noprint" data-act="goEdit" data-id="' + x.id + '">✎ 回題庫修改</button>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>' +
    '<div class="btns noprint"><button class="btn" data-act="saveStats">📥 把統計寫回題庫</button><button class="btn alt" data-act="expScore">📥 成績 Excel</button><button class="btn alt" data-act="expScoreCsv">📥 成績 CSV</button>' + (MK ? '<button class="btn alt" data-act="mkScore">📤 成績寫回課程專案</button>' : '') + '<button class="btn alt" data-act="prAna">🖨 分析報告</button></div></div>';
  return h;
}
function kpi(t, v, s){ return '<div class="kpi"><div class="kt">' + t + '</div><div class="kv">' + esc(v) + '</div>' + (s ? '<div class="ks">' + esc(s) + '</div>' : '') + '</div>'; }

function aboutHTML(){
  return '<div class="card"><h3>這是什麼</h3><p>把好幾份講義（PDF、簡報、Word）變成題庫，審過題後組成正式試卷（A/B 卷、答案卡、解答本、雙向細目表），也能一鍵轉成 Google 表單測驗；考完把作答丟回來，算出每一題的難度、鑑別度與誘答力，找出該修改的題目。</p>' +
    '<ol><li><b>① 講義</b>：匯入檔案，逐頁取出文字（掃描圖頁面會提醒）。</li><li><b>② 出題審題</b>：規則出題（免金鑰）或 AI 出題（自己的金鑰），每題都有出處；審題後按「✓ 採用」。</li>' +
    '<li><b>③ 組卷</b>：依雙向細目表抽題 → 列印試卷／答案卡／解答本，或產生 Google 表單的 Apps Script。</li><li><b>④ 試題分析</b>：放入 Google 表單回覆或作答表 → P、D、點二系列相關、KR-20、誘答分析。</li></ol>' +
    '<p class="small">方法出處：認知層次參考布魯姆（Bloom）教育目標分類的修訂版（記憶、理解、應用、分析…）；難度、鑑別度（高低分組各 27%）、點二系列相關、KR-20 是古典測驗理論的通用統計方法。說明文字為本工具自行撰寫。Google 表單、Google Apps Script 是 Google 的服務，本工具與 Google 無關、非官方工具。</p>' +
    '<p class="small">詳細步驟請看 <a href="manual.html">📖 操作手冊</a>。</p></div>';
}

/* ---------- 匯入講義 ---------- */
function newId(p){ return (p || 'd') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function baseName(n){ return String(n).replace(/\.[^.]+$/, '').replace(/^範例講義_/, ''); }
function textPages(t){ // 純文字／Word：沒有頁，依空行分段、每段約 1200 字
  var paras = D.cleanText(t).split('\n'), out = [], cur = '';
  paras.forEach(function(p){ if(cur && (cur + p).length > 1200){ out.push(cur); cur = ''; } cur += (cur ? '\n' : '') + p; });
  if(cur) out.push(cur);
  return out.map(function(x, i){ return {page:i + 1, text:x}; });
}
function markScan(pages){ pages.forEach(function(p){ p.scan = p.text.replace(/\s/g, '').length < 30; }); return pages; }
function addDoc(d){ S.docs.push(d); save(); }
function importFiles(files){
  var list = Array.prototype.slice.call(files || []);
  if(!list.length) return;
  var prog = $('srcProg'), done = 0, errs = [];
  function next(){
    if(!list.length){ panel('src'); var e = $('srcProg'); if(e) e.innerHTML = '✓ 匯入 ' + done + ' 份' + (errs.length ? '<br><span class="bad">' + errs.map(esc).join('<br>') + '</span>' : ''); return; }
    var f = list.shift(), name = f.name, lower = name.toLowerCase();
    prog.textContent = '讀取「' + name + '」…';
    f.arrayBuffer().then(function(buf){
      if(/\.pdf$/.test(lower)) return PDF.pages(buf, function(i, n){ prog.textContent = '讀取「' + name + '」第 ' + i + '／' + n + ' 頁…'; }).then(function(pg){ var id = newId(); V.files[id] = buf; return {id:id, kind:'pdf', pages:markScan(pg)}; });
      if(/\.pptx$/.test(lower)) return IO.readPptx(buf).then(function(arr){ return {id:newId(), kind:'pptx', pages:markScan(arr.map(function(t, i){ return {page:i + 1, text:t}; }))}; });
      if(/\.docx$/.test(lower)) return IO.readDocx(buf).then(function(t){ return {id:newId(), kind:'docx', pages:textPages(t.replace(/^#[QO] /gm, ''))}; });
      if(/\.(txt|md|text)$/.test(lower)) return {id:newId(), kind:'text', pages:textPages(IO.decodeText(buf))};
      if(/\.(ppt|doc)$/.test(lower)) throw new Error('舊版 Office 檔請另存成 .pptx／.docx 或 PDF');
      throw new Error('不支援這種檔案');
    }).then(function(d){
      if(!d.pages.length || d.pages.every(function(p){ return !p.text.trim(); })){ errs.push(name + '：取不到任何文字（可能整份是掃描圖）'); if(d.kind !== 'pdf'){ next(); return; } }
      d.file = name; d.chapter = baseName(name); d.range = ''; addDoc(d); done++; next();
    }).catch(function(e){ errs.push(name + '：' + (e && e.message || e)); next(); });
  }
  next();
}
function loadSample(){
  (window.LQB_SAMPLES || []).forEach(function(s){
    if(S.docs.some(function(d){ return d.file === s.file; })) return;
    addDoc({id:newId(), kind:'pdf', file:s.file, chapter:s.chapter, range:'', sample:true, pages:markScan(s.pages.map(function(t, i){ return {page:i + 1, text:t}; }))});
  });
  panel('src'); panel('bank'); toast('已載入 2 份範例講義（內容是虛構的教材）');
}
function addToBank(items, label){
  var r = D.dedupe(S.bank, items);
  S.bank = S.bank.concat(r.added); save();
  V.filt.status = 'draft'; V.show = 60;
  panel('bank'); panel('paper');
  return '✓ ' + label + '新增 ' + r.added.length + ' 題' + (r.dup ? '（' + r.dup + ' 題和題庫重複，已略過）' : '') + '，請在下方審題。';
}

/* ---------- AI ---------- */
function aiOpts(){ var g = S.cfg.gen; return {n:g.aiN, types:g.aiTypes, bloom:D.BLOOM.filter(function(b){ return g.aiBloom[b]; }), diff:g.aiDiff}; }
function aiGen(){
  var out = $('aiOut');
  if(!window.TOOL_AI || !TOOL_AI.ready()){ out.innerHTML = '還沒有設定 AI 金鑰：到 ⚙ 常用設定 →「🤖 AI 設定」填入；或展開「沒有金鑰？」複製提示詞貼到任何 AI。'; return; }
  if(V.busy) return;
  var batches = D.chunkPages(selPages()), all = [], bad = 0, i = 0;
  if(!batches.length){ out.textContent = '講義沒有可用的文字'; return; }
  V.busy = true;
  (function one(){
    if(i >= batches.length){ V.busy = false; var msg = addToBank(all, 'AI 出題'); var o = $('aiOut'); if(o) o.innerHTML = msg + (bad ? '（' + bad + ' 題格式不對被略過）' : '') + (all.some(function(q){ return q.warn.length; }) ? '<br><span class="bad">有 ' + all.filter(function(q){ return q.warn.length; }).length + ' 題找不到出處，請特別檢查。</span>' : ''); return; }
    var b = batches[i];
    out.textContent = '第 ' + (i + 1) + '／' + batches.length + ' 批送出中…';
    TOOL_AI.callLLM(D.aiPrompt(b, aiOpts()), null, true, function(m){ out.textContent = '第 ' + (i + 1) + '／' + batches.length + ' 批：' + m; }).then(function(t){
      var arr = D.parseAiJson(t);
      if(!arr){ bad += 1; } else { var v = D.validateAiQuestions(arr, b); all = all.concat(v.items); bad += v.bad; }
      i++; one();
    }, function(e){ V.busy = false; out.textContent = '❌ 第 ' + (i + 1) + ' 批失敗：' + e.message + (all.length ? '（前面成功的 ' + all.length + ' 題已加入）' : ''); if(all.length) addToBank(all, 'AI 出題'); });
  })();
}
function ocrPage(id, page){
  var d = S.docs.filter(function(x){ return x.id === id; })[0], p = d && d.pages.filter(function(x){ return x.page === page; })[0];
  if(!p) return;
  if(!window.TOOL_AI || !TOOL_AI.ready()){ toast('要先在 ⚙ 設定 AI 金鑰'); return; }
  toast('第 ' + page + ' 頁轉成圖片，送給 AI 辨識中…');
  PDF.renderJpeg(V.files[id], page).then(function(img){
    return TOOL_AI.callLLM('這是一頁課程講義的圖片。請把頁面上的文字「逐字」轉成純文字，保留段落與條列的換行，不要摘要、不要加任何說明，也不要補上圖片裡沒有的字。只輸出文字。', [img], false);
  }).then(function(t){ p.text = String(t || '').trim(); p.scan = p.text.replace(/\s/g, '').length < 30; p.ocr = true; save(); panel('src'); toast('✓ 第 ' + page + ' 頁已取出 ' + p.text.length + ' 字，請展開檢查'); }, function(e){ toast('❌ ' + e.message); });
}

/* ---------- 題目編輯 ---------- */
function editQ(id){
  var q = id ? byId(id) : D.mkQ({type:'s', q:'', opts:['', '', '', ''], ans:'A', origin:'manual', chapter:chapters()[0] || ''});
  if(!q) return;
  V.editing = {id:id, base:q};
  openModal('<h2>' + (id ? '✎ 修改題目' : '＋ 新增題目') + '</h2>' +
    '<div class="row"><label class="fld">題型<select id="eType">' + Object.keys(D.TYPES).map(function(t){ return '<option value="' + t + '"' + (q.type === t ? ' selected' : '') + '>' + D.TYPES[t] + '</option>'; }).join('') + '</select></label>' +
    '<label class="fld">章節<input id="eCh" value="' + esc(q.chapter) + '" list="chList"><datalist id="chList">' + chapters().map(function(c){ return '<option value="' + esc(c) + '">'; }).join('') + '</datalist></label></div>' +
    '<label class="fld">題幹<textarea id="eQ" rows="3">' + esc(q.q) + '</textarea></label>' +
    '<label class="fld">選項（一行一個，選擇題用）<textarea id="eOpts" rows="4">' + esc(q.opts.join('\n')) + '</textarea></label>' +
    '<label class="fld">答案<input id="eAns" value="' + esc(q.type === 't' ? (q.ans === 'A' ? '對' : '錯') : q.ans) + '"><small>單選填 B；多選填 AC；是非填 對／錯；填空填答案文字，可接受的寫法用「／」隔開（例如 台北／臺北）</small></label>' +
    '<div class="row"><label class="fld">難度<select id="eDiff">' + D.DIFF.map(function(x, i){ return '<option value="' + i + '"' + (q.diff === i ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label>' +
    '<label class="fld">認知層次<select id="eBloom">' + D.BLOOM.map(function(x){ return '<option' + (q.bloom === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label></div>' +
    '<label class="fld">解析（選填）<textarea id="eExp" rows="2">' + esc(q.explain) + '</textarea></label>' +
    (q.src ? '<p class="src">📄 ' + esc(q.src.file) + ' 第 ' + q.src.page + ' 頁：「' + esc(q.src.quote) + '」</p>' : '') +
    '<div id="eErr" class="bad small"></div><div class="vstack"><button class="btn" data-act="eSave">儲存並採用</button><button class="btn alt" data-act="eSaveDraft">儲存（維持待審）</button><button class="btn alt" data-act="close">取消</button></div>');
}
function eSave(ok){
  var e = V.editing; if(!e) return;
  var type = $('eType').value, ans = $('eAns').value.trim();
  var opts = type === 's' || type === 'm' ? $('eOpts').value.split('\n').map(function(s){ return s.replace(/^\s*[(（]?[A-Ha-h][)）.．、]\s*/, '').trim(); }).filter(Boolean) : [];
  if(type === 't') ans = /^(對|是|o|○|a|true)$/i.test(ans) ? 'A' : /^(錯|否|x|✕|b|false)$/i.test(ans) ? 'B' : ans;
  if(type === 's' || type === 'm') ans = Array.from(new Set(ans.toUpperCase().replace(/[^A-H]/g, '').split(''))).sort().join('');
  var q = Object.assign({}, e.base, {type:type, q:$('eQ').value.trim(), opts:opts, ans:ans, chapter:$('eCh').value.trim(), diff:+$('eDiff').value, bloom:$('eBloom').value, explain:$('eExp').value.trim()});
  var errs = D.checkQ(q); if(errs.length){ $('eErr').textContent = '還不能儲存：' + errs.join('、'); return; }
  q.status = ok ? 'ok' : 'draft'; q.warn = ok ? [] : q.warn;
  if(e.id){ var i = S.bank.indexOf(byId(e.id)); S.bank[i] = q; } else S.bank.unshift(q);
  save(); closeModal(); panel('bank'); panel('paper'); toast('✓ 已儲存');
}

/* ---------- 組卷與列印 ---------- */
function versionsNow(items){ return D.makeVersions(items, P().nVer, {seed:P().seed, shuffleOpts:!!P().shuffle}); }
function finalize(){
  var items = paperItems(), p = P();
  S.cfg.fin = {title:p.title, cls:p.cls, at:new Date().toLocaleString('zh-TW', {hour12:false}).slice(0, 16), pts:Object.assign({}, p.pts),
    items:items.map(function(q){ return {id:q.id, type:q.type, q:q.q, opts:q.opts.slice(), ans:q.ans, diff:q.diff, chapter:q.chapter, bloom:q.bloom, src:q.src}; }), versions:versionsNow(items)};
  V.resp = null; V.ana = null; save(); panel('ana');
  return S.cfg.fin;
}
function printHTML(html, cls){
  var pa = $('printArea'); pa.className = cls || ''; pa.innerHTML = html;
  document.body.classList.add('printing');
  setTimeout(function(){ window.print(); }, 60);
}
window.addEventListener('afterprint', function(){ document.body.classList.remove('printing'); });
function headBox(p, ver, f){
  return '<header class="xh"><div class="xt"><h1>' + esc(p.title) + (f.versions.length > 1 ? '<span class="vbadge">' + ver.name + ' 卷</span>' : '') + '</h1>' +
    '<div class="xm">' + esc(p.cls || '') + (p.date ? '　' + esc(p.date) : '') + (+p.minutes ? '　作答時間 ' + p.minutes + ' 分鐘' : '') + '　共 ' + f.items.length + ' 題・滿分 ' + f.items.reduce(function(a, q){ return a + D.pointsOf(q, f.pts); }, 0) + ' 分</div></div>' +
    '<table class="xid"><tr><td>班級</td><td></td><td>學號</td><td></td></tr><tr><td>姓名</td><td></td><td>得分</td><td class="score"></td></tr></table></header>' +
    (p.desc ? '<p class="xdesc">' + esc(p.desc) + '</p>' : '');
}
function sections(f, ver){
  var byQ = {}; f.items.forEach(function(q){ byQ[q.id] = q; });
  var secs = [], cur = null, n = 0;
  ver.order.forEach(function(id){ var q = D.viewQ(byQ[id], ver); if(!cur || cur.t !== q.type){ cur = {t:q.type, qs:[]}; secs.push(cur); } n++; cur.qs.push({n:n, q:q}); });
  return secs;
}
var CN = '一二三四五六七八';
function paperDoc(){
  var f = finalize(), p = P();
  return f.versions.map(function(ver){
    var h = '<div class="sheet">' + headBox(p, ver, f);
    sections(f, ver).forEach(function(s, si){
      h += '<h2 class="xs">' + CN[si] + '、' + D.TYPES[s.t] + '題（每題 ' + D.pointsOf({type:s.t}, f.pts) + ' 分，共 ' + s.qs.length + ' 題）' + (s.t === 'm' ? '<small>每題至少有兩個正確答案，全對才給分</small>' : '') + '</h2>';
      s.qs.forEach(function(x){
        var q = x.q;
        h += '<div class="xq">' + (s.t === 's' || s.t === 'm' || s.t === 't' ? '<span class="blank">（　　）</span>' : '') + '<b>' + x.n + '.</b> ' + esc(q.q) +
          (q.type === 's' || q.type === 'm' ? '<div class="xo">' + q.opts.map(function(o, k){ return '<span>(' + L[k] + ') ' + esc(o) + '</span>'; }).join('') + '</div>' : '') +
          (q.type === 'f' ? '<div class="fline">答：＿＿＿＿＿＿＿＿＿＿＿＿</div>' : '') + '</div>';
      });
    });
    return h + '<p class="xend">— 試題結束，請再檢查一次 —</p></div>';
  }).join('');
}
function cardDoc(){
  var f = finalize(), p = P(), studs = V.students || mkStudents();
  var people = studs && studs.length ? studs : [null];
  var out = '';
  f.versions.forEach(function(ver){
    var secs = sections(f, ver), rows = [];
    secs.forEach(function(s){ s.qs.forEach(function(x){ rows.push(x); }); });
    var one = function(st){
      return '<div class="sheet card-sheet"><header class="xh"><div class="xt"><h1>答案卡<span class="vbadge">' + ver.name + ' 卷</span></h1><div class="xm">' + esc(p.title) + '　' + esc(p.cls || '') + '　' + esc(p.date || '') + '</div></div>' +
        '<table class="xid"><tr><td>學號</td><td>' + esc(st ? st.sid || '' : '') + '</td><td>姓名</td><td>' + esc(st ? st.name : '') + '</td></tr><tr><td>卷別</td><td>' + ver.name + '</td><td>得分</td><td class="score"></td></tr></table></header>' +
        '<p class="xdesc">請用原子筆或鉛筆把答案的圓圈塗滿；多選題可以塗好幾個；是非題對塗 ○、錯塗 ✕。</p><div class="bub">' +
        rows.map(function(x){
          var q = x.q, cells;
          if(q.type === 't') cells = '<i>○</i><i>✕</i>';
          else if(q.type === 'f') cells = '<span class="fl2"></span>';
          else cells = q.opts.map(function(_, k){ return '<i>' + L[k] + '</i>'; }).join('');
          return '<div class="br"><b>' + x.n + '</b>' + cells + '</div>';
        }).join('') + '</div></div>';
    };
    people.forEach(function(st){ out += one(st); });
  });
  return out;
}
function keyDoc(){
  var f = finalize(), p = P();
  return f.versions.map(function(ver){
    var h = '<div class="sheet"><header class="xh"><div class="xt"><h1>解答本' + (f.versions.length > 1 ? '<span class="vbadge">' + ver.name + ' 卷</span>' : '') + '</h1><div class="xm">' + esc(p.title) + '　' + esc(p.cls || '') + '</div></div></header>' +
      '<p class="xdesc">速查：' + sections(f, ver).map(function(s){ return s.qs.map(function(x){ return x.n + '.' + D.ansText(x.q); }).join('　'); }).join('　') + '</p>' +
      '<table class="kt"><thead><tr><th>題</th><th>答案</th><th>題目</th><th>出處</th></tr></thead><tbody>';
    sections(f, ver).forEach(function(s){ s.qs.forEach(function(x){ var q = x.q, full = byId(q.id) || q; h += '<tr><td class="num">' + x.n + '</td><td class="red"><b>' + esc(D.ansText(q)) + '</b></td><td>' + esc(cut(q.q, 50)) + (full.explain ? '<div class="small">💡 ' + esc(cut(full.explain, 80)) + '</div>' : '') + '</td><td class="small">' + (q.src ? esc(q.src.file) + ' p.' + q.src.page : '—') + '</td></tr>'; }); });
    return h + '</tbody></table></div>';
  }).join('');
}
function bpDoc(){
  var f = finalize(), t = D.blueprintTable(f.items), p = P();
  var tot = {}, all = 0;
  var h = '<div class="sheet"><header class="xh"><div class="xt"><h1>雙向細目表</h1><div class="xm">' + esc(p.title) + '　' + esc(p.cls || '') + '　共 ' + f.items.length + ' 題</div></div></header><table class="kt bpt"><thead><tr><th>章節＼認知層次</th>' + t.levels.map(function(l){ return '<th>' + l + '</th>'; }).join('') + '<th>小計</th><th>比例</th></tr></thead><tbody>';
  t.chapters.forEach(function(c){ var s = 0; h += '<tr><th>' + esc(c) + '</th>' + t.levels.map(function(l){ var n = t.cells[c][l] || 0; s += n; tot[l] = (tot[l] || 0) + n; return '<td class="num">' + (n || '') + '</td>'; }).join(''); all += s; h += '<td class="num"><b>' + s + '</b></td><td class="num">' + Math.round(s / f.items.length * 100) + '%</td></tr>'; });
  h += '<tr><th>小計</th>' + t.levels.map(function(l){ return '<td class="num"><b>' + (tot[l] || 0) + '</b></td>'; }).join('') + '<td class="num"><b>' + all + '</b></td><td></td></tr></tbody></table>';
  var bt = {}; f.items.forEach(function(q){ bt[q.type] = (bt[q.type] || 0) + 1; });
  h += '<p class="xdesc">題型：' + Object.keys(D.TYPES).filter(function(k){ return bt[k]; }).map(function(k){ return D.TYPES[k] + ' ' + bt[k] + ' 題（每題 ' + D.pointsOf({type:k}, f.pts) + ' 分）'; }).join('、') + '</p></div>';
  return h;
}
function gasModal(){
  var f = finalize(), g = S.cfg.gas;
  var code = D.toGasCode({title:f.title, desc:P().desc}, f.items, f.versions, f.pts, {askId:!!g.askId, askName:!!g.askName, collectEmail:!!g.email, required:!!g.required, feedback:!!g.feedback, sheet:!!g.sheet, shuffleQuestions:!!g.shuffleQ});
  V.gasCode = code;
  openModal('<h2>📝 Google 表單的 Apps Script 程式碼</h2><ol class="steps"><li>開 <b>script.google.com</b>（用你要放表單的 Google 帳號登入），按「新專案」。</li><li>把編輯區原本的內容<b>全部刪掉</b>，貼上下面的程式碼，按 💾 儲存。</li><li>上方函式選單選 <b>createQuiz</b>，按「▶ 執行」。第一次會要求授權：選你的帳號 →「進階」→「前往（不安全）」→「允許」（這是你自己的程式，只會建立表單與試算表）。</li><li>執行完到下方「執行記錄」複製<b>填答網址</b>發給學員；表單與回覆試算表也會出現在你的雲端硬碟。</li></ol>' +
    '<p class="small">考完後在回覆試算表選「檔案 → 下載 → 逗號分隔值（.csv）」，丟回 ④ 試題分析就能分析' + (f.versions.length > 1 ? '（每卷一份，檔名請保留「A 卷」「B 卷」字樣，或在 ④ 選擇卷別）' : '') + '。</p>' +
    '<textarea class="code" readonly rows="12">' + esc(code) + '</textarea>' +
    '<div class="vstack"><button class="btn" data-act="gasCopy">📋 複製程式碼</button><button class="btn alt" data-act="gasDl">📥 下載 .gs 檔</button><button class="btn alt" data-act="close">關閉</button></div>');
}

/* ---------- 試題分析 ---------- */
function verFromName(name, f){ var m = /([A-D])\s*卷|卷\s*([A-D])|[_\-\s（(]([A-D])[)）_\-\s.]/i.exec(name); if(!m) return -1; var i = L.indexOf((m[1] || m[2] || m[3]).toUpperCase()); return i < f.versions.length ? i : -1; }
function addResp(rows, name){
  var f = S.cfg.fin, sel = $('respVer') ? $('respVer').value : 'auto';
  var ver = sel === 'auto' ? verFromName(name || '', f) : +sel;
  var r = D.parseResponses(rows, {items:f.items, versions:f.versions}, {ver:ver});
  if(!V.resp) V.resp = {students:[], warn:[], formats:[]};
  V.resp.students = V.resp.students.concat(r.students);
  V.resp.warn = V.resp.warn.concat(r.warn.map(function(w){ return (name ? name + '：' : '') + w; }));
  if(r.format && V.resp.formats.indexOf(r.format) < 0) V.resp.formats.push(r.format);
  V.ana = V.resp.students.length ? D.analyze(f.items, V.resp.students, f.pts) : null;
}
function respFiles(files){
  var list = Array.prototype.slice.call(files || []), out = $('respOut');
  (function next(){
    if(!list.length){ panel('ana'); return; }
    var fl = list.shift(); if(out) out.textContent = '讀取「' + fl.name + '」…';
    IO.readFile(fl).then(function(x){ addResp(x.rows || IO.parseCsv(x.text || ''), fl.name); next(); }, function(e){ if(!V.resp) V.resp = {students:[], warn:[], formats:[]}; V.resp.warn.push(fl.name + '：' + e.message); next(); });
  })();
}
function scoreRows(){
  var a = V.ana, f = S.cfg.fin;
  var rows = [['學號', '姓名', '卷別', '答對題數', '得分', '滿分', '百分制'].concat(f.items.map(function(_, i){ return '第' + (i + 1) + '題'; }))];
  a.students.forEach(function(s){ rows.push([s.sid, s.name, s.ver, s.raw, s.score, a.full, a.full ? Math.round(s.score / a.full * 1000) / 10 : 0].concat(s.right.map(function(x){ return x ? '○' : '✕'; }))); });
  return rows;
}
function anaDoc(){
  var rep = $('panel-ana').cloneNode(true);
  rep.querySelectorAll('.noprint,.card:first-child,button').forEach(function(e){ e.remove(); });
  rep.querySelectorAll('details').forEach(function(d){ d.open = true; });
  return '<div class="sheet"><header class="xh"><div class="xt"><h1>試題分析報告</h1><div class="xm">' + esc(S.cfg.fin.title) + '　' + esc(P().cls || '') + '　列印日期 ' + today() + '</div></div></header>' + rep.innerHTML + '</div>';
}

/* ---------- 課程專案 ---------- */
function mkStudents(){ if(!MK || !S.cfg.mk) return null; var d = MK.store.get(S.cfg.mk); return d ? d.students : null; }
function mkPick(){
  var list = MK.store.list();
  openModal('<h2>📂 從課程專案帶入</h2>' + (list.length ? '<div class="vstack">' + list.map(function(d){ return '<button class="btn alt" data-act="mkIn" data-id="' + esc(d.id) + '">' + esc(MK.label(d)) + ' <small>' + (d.students || []).length + ' 位學員・' + esc(MK.when(d)) + (S.cfg.mk === d.id ? '・目前連結' : '') + '</small></button>'; }).join('') + '</div>' : '<p>這台電腦還沒有課程專案。可以先在「課程招生海報產生器」或「出席簽到 QR」存一個課程專案。</p>') +
    '<div class="vstack"><label class="btn alt"><input type="file" id="mkFile" accept=".json" hidden>📂 開啟課程專案 .json</label>' + (S.cfg.mk ? '<button class="btn alt" data-act="mkOff">取消連結</button>' : '') + '<button class="btn alt" data-act="close">關閉</button></div>');
}
function mkApply(id){
  var d = MK.store.get(id); if(!d){ toast('找不到這個課程專案'); return; }
  S.cfg.mk = d.id; var c = d.course || {};
  if(c.title){ P().cls = c.title + (c.term ? '（' + c.term + '）' : ''); if(!P().title || P().title === '課後測驗') P().title = c.title + ' 課後測驗'; }
  save(); closeModal(); panel('paper'); toast('已帶入「' + MK.label(d) + '」' + ((d.students || []).length ? '，答案卡會印 ' + d.students.length + ' 位學員的名字' : ''));
}
function mkScore(){
  var a = V.ana, d = S.cfg.mk && MK.store.get(S.cfg.mk);
  if(!d){ mkPick(); toast('請先選要寫回的課程專案'); return; }
  var bySid = {}, byName = {}; (d.students || []).forEach(function(st){ if(st.sid) bySid[String(st.sid).toUpperCase()] = st; if(st.name) byName[st.name] = byName[st.name] ? 'dup' : st; });
  var scores = {}, hit = 0;
  a.students.forEach(function(s){ var st = s.sid && bySid[String(s.sid).toUpperCase()] || (byName[s.name] !== 'dup' && byName[s.name]); if(st){ scores[MK.studentKey(st)] = a.full ? Math.round(s.score / a.full * 1000) / 10 : 0; hit++; } });
  var doc = MK.store.save(d.id, {result:{title:S.cfg.fin.title, full:a.full, n:a.N, mean:Math.round(a.mean * 100) / 100, kr20:a.kr20 == null ? null : Math.round(a.kr20 * 1000) / 1000, scores:scores}}, 'quiz');
  if(!doc){ toast('存不進這台電腦（瀏覽器空間不足或封鎖網站資料）'); return; }
  openModal('<h2>📤 已寫回課程專案</h2><p>「' + esc(MK.label(doc)) + '」：對應到 ' + hit + '／' + a.N + ' 位學員，存了百分制成績、平均與 KR-20。<b>不存作答內容。</b></p><div class="vstack"><button class="btn" data-act="close">好</button></div>');
}

/* ---------- 彈窗、警語、設定 ---------- */
function openModal(h){ $('modalBox').innerHTML = h; $('modal').classList.add('show'); $('modalBox').scrollTop = 0; var f = $('modalBox').querySelector('button,a,input,select,textarea'); if(f) f.focus(); }
function closeModal(){ $('modal').classList.remove('show'); }
var toastT;
function toast(m){ var o = document.querySelector('.toast'); if(o) o.remove(); var t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = m; document.body.appendChild(t); clearTimeout(toastT); toastT = setTimeout(function(){ t.remove(); }, 3500); }
var WARN_HTML = '<h2>⚠ 使用警語</h2><ul>' +
  '<li><b>題目由規則或 AI 自動產生，可能有錯字、答案錯誤或不夠嚴謹</b>，一定要由講師逐題審題後才能使用；試題分析出現「答案可能有誤」時請再確認。</li>' +
  '<li>AI 出題的內容屬於 AI 生成，發給學員時建議註明；AI 每題都要附講義原句，找不到原句的會標「⚠ 找不到出處」。</li>' +
  '<li>講義、教材的著作權屬於原作者。請只匯入你有權使用的講義，產生的題目也請自行確認可以使用。</li>' +
  '<li>講義檔案只在瀏覽器裡讀取、不會上傳；取出的文字、題庫存在這台裝置的瀏覽器。使用 AI 功能時，講義文字會送到你選的 AI 服務。</li>' +
  '<li>學員作答名單只放在開啟中的記憶體，不會存起來；只把每題的統計數字存進題庫。</li>' +
  '<li>難度、鑑別度、KR-20 是古典測驗理論的參考指標，人數太少（例如少於 20 人）時數字很不穩定，不能當成評量學生的唯一依據。</li>' +
  '<li>Google 表單、Google Apps Script 是 Google 的服務；本工具與 Google 無關、非官方工具，只產生程式碼讓你自己執行。</li></ul>';
function showWarn(){ openModal(WARN_HTML + '<div class="vstack"><button class="btn" data-act="close">我知道了</button></div>'); }
function sec(id, title, val, body){ return '<details class="set-sec" data-sec="' + id + '"><summary><span class="sst">' + title + '</span><span class="ssv">' + esc(val) + '</span></summary><div class="set-body">' + body + '</div></details>'; }
function openSettings(){
  var xl = lsGet('fsize') === 'xl';
  openModal('<div class="bar"><h2 style="flex:1 1 0">⚙ 常用設定</h2><button class="ibtn" data-act="foldall">全部展開／收合</button></div>' +
    sec('data', '資料', S.docs.length + ' 份講義・' + S.bank.length + ' 題', '<p class="small">講義文字與題庫只存在這台裝置。換電腦前先下載備份檔，再到新裝置還原。</p><div class="vstack"><button class="btn" data-act="backup">下載備份檔</button><button class="btn alt" data-act="restore">從備份檔還原</button><button class="btn red" data-act="wipe">清除全部資料</button></div><input type="file" id="restoreFile" accept=".json,application/json" hidden>') +
    sec('lic', '🔑 登入序號', gateInfo.text.replace(/^✓ /, ''), '<p><span class="lic ' + gateInfo.cls + '">' + esc(gateInfo.text) + '</span></p><div class="vstack"><button class="btn alt" data-act="logout">登出（換一組序號）</button></div>') +
    sec('ai', '🤖 AI 設定', window.TOOL_AI ? TOOL_AI.status() : '', window.TOOL_AI ? TOOL_AI.settingsHTML() : '') +
    sec('view', '顯示', xl ? '大字' : '標準字', '<div class="vstack"><button class="btn' + (xl ? ' alt' : '') + '" data-fontsize="m">標準字</button><button class="btn' + (xl ? '' : ' alt') + '" data-fontsize="xl">大字</button></div>') +
    sec('about', '關於本工具', '', '<p>👤 創作者 Mark Tsai（蔡豐全）<br><a href="manual.html#creator">創作者資料與聯絡方式</a></p><div class="vstack"><a class="btn alt" href="manual.html">📖 操作手冊</a><button class="btn alt" data-act="warn">⚠ 使用警語</button>' +
      (standalone ? '' : '<button class="btn alt" data-act="install">📲 加入主畫面</button>') + '</div><p class="small" style="margin-top:.5rem">訪客數 <img src="' + COUNTER + '" alt="訪客次數" height="20" loading="lazy" style="vertical-align:middle"></p>') +
    '<div class="vstack"><button class="btn" data-act="close">關閉</button></div>');
  var open = lsJson('fold', []);
  document.querySelectorAll('.set-sec').forEach(function(d){ d.open = open.indexOf(d.dataset.sec) >= 0; d.addEventListener('toggle', saveFold); });
  $('restoreFile').addEventListener('change', restoreFile);
  if(window.TOOL_AI) TOOL_AI.bind(function(){ openSettings(); var d = document.querySelector('.set-sec[data-sec="ai"]'); if(d) d.open = true; panel('bank'); });
}
function saveFold(){ var o = []; document.querySelectorAll('.set-sec').forEach(function(d){ if(d.open) o.push(d.dataset.sec); }); lsSet('fold', JSON.stringify(o)); }
function applyView(){ document.documentElement.dataset.fsize = lsGet('fsize') === 'xl' ? 'xl' : 'm'; }

/* ---------- 檔案 ---------- */
function download(name, data, type){ var a = document.createElement('a'); a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], {type:type})); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500); }
function safeName(s){ return String(s || '試卷').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40); }
function restoreFile(ev){
  var f = ev.target.files[0]; if(!f) return;
  var rd = new FileReader();
  rd.onload = function(){
    try{ var j = JSON.parse(rd.result); if(j.app !== 'lecture-quiz-builder' || !j.state || !Array.isArray(j.state.bank)) throw 0;
      S = {docs:j.state.docs || [], bank:j.state.bank, cfg:Object.assign(defCfg(), j.state.cfg || {})}; save(); closeModal(); render(); toast('已還原備份'); }
    catch(e){ toast('這不是講義出題試卷工坊的備份檔'); }
  };
  rd.readAsText(f);
}

/* ---------- 事件 ---------- */
function setBind(path, v){ var ks = path.split('.'), o = S.cfg; for(var i = 0; i < ks.length - 1; i++){ if(o[ks[i]] == null) o[ks[i]] = {}; o = o[ks[i]]; } o[ks[ks.length - 1]] = v; }
var ACT = {
  settings:openSettings, close:closeModal, warn:showWarn,
  foldall:function(){ var d = document.querySelectorAll('.set-sec'), any = Array.prototype.some.call(d, function(x){ return !x.open; }); d.forEach(function(x){ x.open = any; }); saveFold(); },
  logout:function(){ closeModal(); gateLogout(); },
  sample:loadSample,
  pasteSrc:function(){ openModal('<h2>📋 貼上講義文字</h2><label class="fld">章節名稱<input id="psCh" value="貼上的講義"></label><label class="fld">講義內容<textarea id="psText" rows="10" placeholder="從 PDF 或網頁複製講義文字貼在這裡"></textarea></label><div class="vstack"><button class="btn" data-act="psOk">加入</button><button class="btn alt" data-act="close">取消</button></div>'); },
  psOk:function(){ var t = $('psText').value.trim(); if(!t){ toast('還沒有貼上內容'); return; } var ch = $('psCh').value.trim() || '貼上的講義'; addDoc({id:newId(), kind:'text', file:ch + '（貼上）', chapter:ch, range:'', pages:textPages(t)}); closeModal(); panel('src'); panel('bank'); toast('✓ 已加入'); },
  delDoc:function(el){ var id = el.dataset.id; S.docs = S.docs.filter(function(d){ return d.id !== id; }); delete V.files[id]; save(); panel('src'); panel('bank'); },
  ocr:function(el){ ocrPage(el.dataset.id, +el.dataset.page); },
  quizPaste:function(){ var t = $('quizPaste').value; var r = IO.parseQuizText(t); if(!r.items.length){ toast('看不出題目，請檢查格式（例如「1. 題目」「(A) 選項」「答案：B」）'); return; } var m = addToBank(D.fromSimple(r.items, '匯入題目'), '匯入'); V.tab = 'bank'; switchTab(); toast(m + (r.skipped.length ? '（' + r.skipped.length + ' 題沒有答案略過）' : '')); },
  ruleGen:function(){ var r = D.genRuleQuestions(selPages(), {seed:Date.now() % 100000, types:S.cfg.gen.types}); if(!r.items.length){ toast('這些講義找不到可以出題的句子（定義句、列舉句、數字句）；可以改用 AI 出題'); return; } toast(addToBank(r.items, '規則出題')); },
  aiGen:aiGen,
  aiCopy:function(){ var b = D.chunkPages(selPages())[+($('aiBatch') || {}).value || 0]; if(!b){ toast('沒有講義文字'); return; } V.aiBatch = +$('aiBatch').value; copyText(D.aiPrompt(b, aiOpts()), '已複製第 ' + (V.aiBatch + 1) + ' 批的提示詞，可以貼到任何 AI'); },
  aiImport:function(){ var bi = +($('aiBatch') || {}).value || 0, b = D.chunkPages(selPages())[bi]; var arr = D.parseAiJson($('aiPaste').value); if(!arr){ toast('看不懂這段回覆，請確認貼的是 AI 回的 JSON'); return; } var v = D.validateAiQuestions(arr, b || []); var m = addToBank(v.items, 'AI 回覆'); toast(m + (v.bad ? '（' + v.bad + ' 題格式不對略過）' : '')); },
  ok:function(el){ var q = byId(el.dataset.id); q.status = 'ok'; save(); panel('bank'); panel('paper'); },
  unok:function(el){ var q = byId(el.dataset.id); q.status = 'draft'; P().ids = P().ids.filter(function(x){ return x !== q.id; }); save(); panel('bank'); panel('paper'); },
  edit:function(el){ editQ(el.dataset.id); }, newQ:function(){ editQ(null); },
  goEdit:function(el){ V.tab = 'bank'; switchTab(); editQ(el.dataset.id); },
  eSave:function(){ eSave(true); }, eSaveDraft:function(){ eSave(false); },
  del:function(el){ var id = el.dataset.id; S.bank = S.bank.filter(function(q){ return q.id !== id; }); P().ids = P().ids.filter(function(x){ return x !== id; }); save(); panel('bank'); panel('paper'); },
  okAll:function(){ var l = bankFiltered(), n = 0; l.forEach(function(q){ if(q.status !== 'ok' && !D.checkQ(q).length){ q.status = 'ok'; n++; } }); save(); panel('bank'); panel('paper'); toast('✓ 採用 ' + n + ' 題（建議還是逐題看過）'); },
  delAll:function(){ var n = bankFiltered().length; openModal('<h2>刪除 ' + n + ' 題？</h2><p>會刪掉目前篩選出來的題目，無法復原。</p><div class="vstack"><button class="btn red" data-act="delAllYes">確定刪除</button><button class="btn alt" data-act="close">取消</button></div>'); },
  delAllYes:function(){ var ids = {}; bankFiltered().forEach(function(q){ ids[q.id] = 1; }); S.bank = S.bank.filter(function(q){ return !ids[q.id]; }); P().ids = P().ids.filter(function(x){ return !ids[x]; }); save(); closeModal(); panel('bank'); panel('paper'); },
  more:function(){ V.show += 60; panel('bank'); },
  toPaper:function(el){ var id = el.dataset.id, i = P().ids.indexOf(id); if(i >= 0) P().ids.splice(i, 1); else P().ids.push(id); save(); panel('bank'); panel('paper'); },
  expBank:function(){ download('題庫-' + today() + '.xlsx', IO.xlsxBlob(D.toBankRows(bankFiltered()), '題庫', [6, 14, 6, 50, 18, 18, 18, 18, 18, 18, 8, 6, 8, 22, 6, 40, 6, 6, 30])); },
  expTch:function(){ var r = D.toTchRows(bankFiltered().filter(function(q){ return q.status === 'ok'; })); if(r.rows.length < 2){ toast('篩選結果裡沒有已審的選擇／是非題'); return; } download('給課堂小幫手的題庫-' + today() + '.xlsx', IO.xlsxBlob(r.rows, '題庫')); toast('已下載（只含已審題目' + (r.skipped ? '；' + r.skipped + ' 題填空題小幫手不支援，已略過' : '') + '）。到講師課堂小幫手 📝 測驗 → 匯入題庫'); },
  expJson:function(){ download('題庫-' + today() + '.json', JSON.stringify({app:'lecture-quiz-builder', kind:'bank', v:1, items:bankFiltered()}, null, 1), 'application/json'); },
  pick:function(){ var p = P(), cells = Object.keys(p.bp).map(function(k){ var i = k.lastIndexOf('|'); return {chapter:k.slice(0, i), bloom:k.slice(i + 1), n:+p.bp[k]}; }).filter(function(c){ return c.n > 0; });
    if(!cells.length){ toast('細目表還沒填題數'); return; }
    var bank = S.bank.map(function(q){ return q.chapter ? q : Object.assign({}, q, {chapter:'（未分章）'}); });
    var r = D.pickByBlueprint(bank, cells, {seed:p.seed, types:p.types}); p.ids = r.ids; save(); panel('paper'); panel('bank');
    var o = $('pickOut'); if(o) o.innerHTML = '✓ 抽了 ' + r.ids.length + ' 題' + (r.short.length ? '<br><span class="bad">題目不夠：' + r.short.map(function(s){ return esc(s.chapter) + '・' + s.bloom + ' 要 ' + s.want + ' 只有 ' + s.got; }).join('；') + '</span>' : ''); },
  reroll:function(){ P().seed = Math.floor(Math.random() * 99999); ACT.pick(); },
  pickAll:function(){ var ord = {t:0, s:1, m:2, f:3}; P().ids = S.bank.filter(function(q){ return q.status === 'ok' && P().types[q.type]; }).sort(function(a, b){ return ord[a.type] - ord[b.type]; }).map(function(q){ return q.id; }); save(); panel('paper'); panel('bank'); },
  addPick:function(){ var l = S.bank.filter(function(q){ return q.status === 'ok' && P().ids.indexOf(q.id) < 0; }); openModal('<h2>＋ 手動挑題</h2>' + (l.length ? '<div class="picklist">' + l.map(function(q){ return '<label class="ck pk"><input type="checkbox" value="' + q.id + '"> <span class="tag t-' + q.type + '">' + D.TYPES[q.type] + '</span> ' + esc(cut(q.q, 60)) + ' <small>（' + esc(q.chapter) + '）</small></label>'; }).join('') + '</div>' : '<p>沒有其他已審題目了。</p>') + '<div class="vstack"><button class="btn" data-act="addPickOk">加入勾選的題目</button><button class="btn alt" data-act="close">取消</button></div>'); },
  addPickOk:function(){ document.querySelectorAll('.picklist input:checked').forEach(function(c){ P().ids.push(c.value); }); save(); closeModal(); panel('paper'); panel('bank'); },
  clearPaper:function(){ P().ids = []; save(); panel('paper'); panel('bank'); },
  up:function(el){ var i = +el.dataset.i, a = P().ids; if(i > 0){ var t = a[i - 1]; a[i - 1] = a[i]; a[i] = t; save(); panel('paper'); } },
  down:function(el){ var i = +el.dataset.i, a = P().ids; if(i < a.length - 1){ var t = a[i + 1]; a[i + 1] = a[i]; a[i] = t; save(); panel('paper'); } },
  rm:function(el){ P().ids.splice(+el.dataset.i, 1); save(); panel('paper'); panel('bank'); },
  prPaper:function(){ printHTML(paperDoc(), 'pp'); }, prCard:function(){ printHTML(cardDoc(), 'pp'); }, prKey:function(){ printHTML(keyDoc(), 'pp'); }, prBp:function(){ printHTML(bpDoc(), 'pp'); },
  prAna:function(){ printHTML(anaDoc(), 'pp'); },
  gas:gasModal,
  gasCopy:function(){ copyText(V.gasCode, '已複製程式碼，貼到 script.google.com'); },
  gasDl:function(){ download(safeName(S.cfg.fin.title) + '-Google表單.gs', V.gasCode, 'text/plain'); },
  sim:function(){ var f = S.cfg.fin; V.resp = null; addResp(D.simulate(f.items, f.versions, 40, Date.now() % 9999), '模擬作答'); V.resp.formats = ['模擬作答（虛構）']; panel('ana'); toast('已產生 40 位虛構學員的模擬作答'); },
  respClear:function(){ V.resp = null; V.ana = null; panel('ana'); },
  respPaste:function(){ var t = $('respPaste').value; if(!t.trim()) return; addResp(IO.parseCsv(t), ''); panel('ana'); },
  saveStats:function(){ var n = 0, d = today(); V.ana.items.forEach(function(x){ var q = byId(x.id); if(!q) return; q.stats = (q.stats || []).concat([{date:d, P:Math.round(x.P * 1000) / 1000, D:Math.round(x.D * 1000) / 1000, N:V.ana.N}]).slice(-10); if(V.ana.N >= 10) q.diff = x.P > .75 ? 0 : x.P < .4 ? 2 : 1; n++; }); save(); panel('bank'); toast('✓ ' + n + ' 題的 P、D 已寫回題庫' + (V.ana.N >= 10 ? '，並依答對率更新難度' : '')); },
  expScore:function(){ download(safeName(S.cfg.fin.title) + '-成績-' + today() + '.xlsx', IO.xlsxBlob(scoreRows(), '成績')); },
  expScoreCsv:function(){ download(safeName(S.cfg.fin.title) + '-成績-' + today() + '.csv', IO.csvText(scoreRows()), 'text/csv'); },
  mkPick:mkPick, mkIn:function(el){ mkApply(el.dataset.id); }, mkOff:function(){ S.cfg.mk = null; save(); closeModal(); panel('paper'); }, mkScore:mkScore,
  backup:function(){ download('講義出題試卷工坊備份-' + today() + '.json', JSON.stringify({app:'lecture-quiz-builder', v:1, saved:new Date().toISOString(), state:S}, null, 1), 'application/json'); },
  restore:function(){ $('restoreFile').click(); },
  wipe:function(){ openModal('<h2>清除全部資料？</h2><p>講義文字、題庫、試卷設定都會刪掉，無法復原。建議先下載備份檔。</p><div class="vstack"><button class="btn red" data-act="wipeYes">確定清除</button><button class="btn alt" data-act="close">取消</button></div>'); },
  wipeYes:function(){ ['cfg', 'bank', 'docs'].forEach(lsDel); S = {docs:[], bank:[], cfg:defCfg()}; V.resp = null; V.ana = null; V.files = {}; closeModal(); render(); toast('已清除'); },
  install:function(){
    var m = ios ? '請按 Safari 下方的「分享」圖示，選「加入主畫面」。' : '請按瀏覽器網址列右側的安裝圖示，或右上角選單的「安裝應用程式／加到主畫面」。';
    if(window._dp){ window._dp.prompt(); window._dp.userChoice.then(function(){ window._dp = null; }); }
    else openModal('<h2>📲 加入主畫面</h2><p>' + m + '</p><div class="vstack"><button class="btn" data-act="close">知道了</button></div>');
  }
};
function copyText(text, msg){
  function fb(){ var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); toast(msg); }catch(e){ toast('複製失敗，請手動選取'); } ta.remove(); }
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function(){ toast(msg); }, fb); else fb();
}
function switchTab(){ lsSet('tab', V.tab); document.querySelectorAll('.tabs button').forEach(function(b){ b.setAttribute('aria-selected', b.dataset.tab === V.tab); }); document.querySelectorAll('.panel').forEach(function(s){ s.hidden = s.dataset.p !== V.tab; }); window.scrollTo(0, 0); }
document.addEventListener('click', function(ev){
  var el = ev.target.closest('[data-act],[data-tab],[data-fontsize]');
  if(!el){ if(ev.target.id === 'modal') closeModal(); return; }
  var ds = el.dataset;
  if(ds.act){ if(el.tagName === 'A') ev.preventDefault(); if(ACT[ds.act]) ACT[ds.act](el); return; }
  if(ds.tab){ V.tab = ds.tab; if(V.tab === 'bank') panel('bank'); if(V.tab === 'paper') panel('paper'); switchTab(); return; }
  if(ds.fontsize){ lsSet('fsize', ds.fontsize); applyView(); openSettings(); return; }
});
var filtT;
document.addEventListener('input', function(ev){
  var t = ev.target, ds = t.dataset;
  if(ds.bind && t.type !== 'checkbox' && t.tagName !== 'SELECT'){ setBind(ds.bind, t.type === 'number' ? (t.value === '' ? '' : Number(t.value)) : t.value); save(); return; }
  if(ds.docch){ var d = S.docs.filter(function(x){ return x.id === ds.docch; })[0]; if(d){ d.chapter = t.value; save(); } return; }
  if(ds.docrange){ var d2 = S.docs.filter(function(x){ return x.id === ds.docrange; })[0]; if(d2){ d2.range = t.value; save(); } return; }
  if(ds.bp != null){ P().bp[ds.bp] = t.value === '' ? 0 : +t.value; save(); return; }
  if(ds.filt === 'q'){ V.filt.q = t.value; clearTimeout(filtT); filtT = setTimeout(function(){ var pos = t.selectionStart; panel('bank'); var n = document.querySelector('[data-filt="q"]'); if(n){ n.focus(); try{ n.setSelectionRange(pos, pos); }catch(e){} } }, 250); }
});
document.addEventListener('change', function(ev){
  var t = ev.target, ds = t.dataset;
  if(ds.bind){
    if(t.type === 'checkbox') setBind(ds.bind, t.checked ? 1 : 0);
    else if(t.tagName === 'SELECT') setBind(ds.bind, ds.num ? +t.value : t.value);
    save();
    if(/^paper\.(types|pts|nVer|shuffle)|^gas\.|^gen\./.test(ds.bind) && (t.type === 'checkbox' || t.tagName === 'SELECT' || /pts/.test(ds.bind))) panel(/^gen/.test(ds.bind) ? 'bank' : 'paper');
    return;
  }
  if(ds.docon){ var d = S.docs.filter(function(x){ return x.id === ds.docon; })[0]; if(d){ d.off = !t.checked; save(); panel('src'); panel('bank'); } return; }
  if(ds.docch || ds.docrange){ panel('src'); panel('bank'); panel('paper'); return; }
  if(ds.bp != null){ panel('paper'); return; }
  if(ds.filt && ds.filt !== 'q'){ V.filt[ds.filt] = t.value; V.show = 60; panel('bank'); return; }
  if(t.id === 'srcFile'){ importFiles(t.files); t.value = ''; return; }
  if(t.id === 'quizFile' && t.files[0]){ var fl = t.files[0]; IO.readFile(fl).then(function(x){ var r = x.rows ? IO.rowsToQuiz(x.rows) : IO.parseQuizText(x.text); if(!r.items.length){ toast('看不出題目，請檢查格式'); return; } var m = addToBank(D.fromSimple(r.items, baseName(fl.name)), '匯入'); V.tab = 'bank'; switchTab(); toast(m); }, function(e){ toast('❌ ' + e.message); }); t.value = ''; return; }
  if(t.id === 'bankFile' && t.files[0]){ var rd = new FileReader(); rd.onload = function(){ try{ var j = JSON.parse(rd.result); if(!j || !Array.isArray(j.items)) throw 0; var m = addToBank(j.items.map(function(x){ return D.mkQ(Object.assign({}, x, {id:x.id || undefined})); }), '題庫檔'); toast(m); }catch(e){ toast('這不是題庫 .json'); } }; rd.readAsText(t.files[0]); t.value = ''; return; }
  if(t.id === 'respFile'){ respFiles(t.files); t.value = ''; return; }
  if(t.id === 'aiBatch'){ V.aiBatch = +t.value; return; }
  if(t.id === 'mkFile' && t.files[0]){ var mf = new FileReader(); mf.onload = function(){ t.value = ''; var r = MK.fromText(mf.result); if(r.error){ toast(r.error); return; } var last = null; r.docs.forEach(function(x){ last = MK.store.put(x) || last; }); if(!last){ toast('存不進這台電腦'); return; } mkApply(last.id); }; mf.readAsText(t.files[0]); }
});
// 拖曳講義檔案
document.addEventListener('dragover', function(e){ var d = e.target.closest && e.target.closest('#drop'); if(d){ e.preventDefault(); d.classList.add('over'); } });
document.addEventListener('dragleave', function(e){ var d = e.target.closest && e.target.closest('#drop'); if(d) d.classList.remove('over'); });
document.addEventListener('drop', function(e){ var d = e.target.closest && e.target.closest('#drop'); if(d){ e.preventDefault(); d.classList.remove('over'); importFiles(e.dataTransfer.files); } });
document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && $('modal').classList.contains('show')) closeModal(); });

/* ---------- 跑馬燈（工作區共用公告，不可關） ---------- */
function initMarquee(){
  var URL_ = "https://script.google.com/macros/s/AKfycbwKX0DNNbY8y4nf90BFTHtxgfqJcHHcZasRrgycl4QAe52_hkjMWSkYk4xOsqU-JPCROw/exec";
  var REFRESH = 20 * 60 * 1000, bar = $('marqueeBar'), track = $('marqueeTrack'), lastKey = null;
  function appendText(c, text){ var re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, li = 0, m; while((m = re.exec(text))){ if(m.index > li) c.appendChild(document.createTextNode(text.slice(li, m.index))); var a = document.createElement('a'); a.href = m[2]; a.textContent = m[1]; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.color = 'inherit'; a.style.textDecoration = 'underline'; c.appendChild(a); li = re.lastIndex; } if(li < text.length) c.appendChild(document.createTextNode(text.slice(li))); }
  function renderM(items){
    if(!items || !items.length) return;
    var k = JSON.stringify(items); if(k === lastKey) return; lastKey = k; track.innerHTML = '';
    var fr = document.createDocumentFragment();
    function pass(){ items.forEach(function(it, i){ if(i > 0) fr.appendChild(document.createTextNode('　★　')); appendText(fr, String(it)); }); }
    pass(); fr.appendChild(document.createTextNode('　★　')); pass(); track.appendChild(fr);
    bar.classList.add('show'); document.body.classList.add('has-marquee');
    track.style.animationDuration = Math.max(track.scrollWidth / 2 / 60, 12) + 's';
  }
  function fetchM(){ fetch(URL_, {method:'POST', body:JSON.stringify({serial:''})}).then(function(r){ return r.json(); }).then(function(d){ if(d && Array.isArray(d.marquee) && d.marquee.length){ lsSet('marquee', JSON.stringify(d.marquee)); renderM(d.marquee); } }).catch(function(){}); }
  renderM(lsJson('marquee', [])); fetchM(); setInterval(fetchM, REFRESH);
}

/* ---------- 登入序號閘門（複製自課程招生海報產生器／訓練證書產生器） ----------
   序號在試算表「新增講師工具」的分頁「講義出題試卷工坊」，打綁在那份試算表的 Apps Script（gas/，2026-11-27 部署），請求帶 sheet 指定分頁。
   開啟時 fail-closed：驗證沒通過就整個工具都不能用。已登入後每 20 分鐘背景重驗，只有連線失敗或 server_error 不上鎖。
   序號存 lectureQuizBuilderEntrySerial（刻意不用 lqb. 前綴，⚙ 清除全部資料不會登出）。純前端閘門，懂 DevTools 的人可移除遮罩，已知取捨。 */
var LICENSE_CHECK_URL = 'https://script.google.com/macros/s/AKfycbxMelSTbpI-Mx2mKMLSU7XZVMY2Wcew1xicX2cNYkw_ETN6yA889uCV7iRNs4Rl0Nln/exec';
var LICENSE_SHEET = '講義出題試卷工坊';
var SERIAL_KEY = 'lectureQuizBuilderEntrySerial', CLIENT_KEY = 'lectureQuizBuilderEntryClientId', RECHECK_MS = 20 * 60 * 1000;
var FREE_SERIAL = 'FLf9M6zAX8pe';   // 公開在登入頁的免費試用序號；'' 就不顯示
function rawGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function rawSet(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }
function rawDel(k){ try{ localStorage.removeItem(k); }catch(e){} }
var gateOpen = false, LICINFO = null, gateInfo = {cls:'', text:'尚未驗證'};
var REASON_LABEL = {missing_serial:'請輸入登入序號', serial_not_found:'查無此序號，請確認有沒有打錯', expired:'這組序號已經過期了',
  headcount_exceeded:'這組序號的登入人數已滿，請稍後再試', network_error:'連不上網路，請確認網路後再按一次確認', server_error:'驗證暫時失敗，請等一下再試'};
function clientId(){
  var id = rawGet(CLIENT_KEY);
  if(!id){ id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'c-' + Date.now() + '-' + Math.random().toString(36).slice(2); rawSet(CLIENT_KEY, id); }
  return id;
}
function gateStatus(cls, text){ gateInfo.cls = cls; gateInfo.text = text; var e = $('entryGateStatus'); e.className = 'lic ' + cls; e.textContent = text; }
function gateHead(l){
  var limited = l && typeof l.headcountLimit === 'number', left = limited ? Math.max(l.headcountRemaining || 0, 0) : 0;
  $('entryGateHeadcount').textContent = l && l.reason === 'headcount_exceeded' ? '此序號還可登入 ' + left + ' 人（上限 ' + l.headcountLimit + ' 人）' : '';
}
function checkLicense(serial, attempt, renew){
  attempt = attempt || 1;
  var ctl = window.AbortController ? new AbortController() : null, tm = ctl && setTimeout(function(){ ctl.abort(); }, 20000);
  // Apps Script 不回應 OPTIONS 預檢，所以不設 Content-Type
  return fetch(LICENSE_CHECK_URL, {method:'POST', body:JSON.stringify({serial:serial, sheet:LICENSE_SHEET, clientId:clientId(), renew:!!renew}), signal:ctl ? ctl.signal : undefined}).catch(function(){
    throw new Error(REASON_LABEL.network_error);
  }).then(function(r){ clearTimeout(tm); if(!r.ok) throw new Error(REASON_LABEL.server_error); return r.text(); }).then(function(t){
    var d; try{ d = JSON.parse(t); }catch(e){ d = null; }
    if(!d || typeof d.valid !== 'boolean'){ if(attempt < 3) return checkLicense(serial, attempt + 1, renew); throw new Error(REASON_LABEL.server_error); }
    return d;
  });
}
// 到期日：後端回傳結束日期當天 00:00（台北）的 ISO，當天結束前都有效
function gateExp(l){
  if(!l || !l.expiresAt) return null;
  var e = new Date(l.expiresAt); if(isNaN(e)) return null;
  var end = new Date(e.getFullYear(), e.getMonth(), e.getDate()), t = new Date(), today_ = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return {text:end.getFullYear() + '/' + (end.getMonth() + 1) + '/' + end.getDate(), left:Math.max(Math.round((end - today_) / 86400000), 0)};
}
function showLicTop(){
  var el = $('licTop'); if(!el) return;
  var x = gateExp(LICINFO);
  el.hidden = !gateOpen || !LICINFO; if(el.hidden) return;
  el.className = 'ibtn lictop' + (x && x.left <= 14 ? ' soon' : '');
  el.innerHTML = x ? '🔑 到期 <b>' + x.text + '</b><small>（還有 ' + x.left + ' 天）</small>' : '🔑 序號有效';
}
function gateUnlock(l){
  LICINFO = l; var x = gateExp(l);
  gateStatus('ok', '✓ 序號有效' + (x ? '，可以用到 ' + x.text + '（還有 ' + x.left + ' 天）' : '')); gateHead(l);
  $('entryGate').classList.add('hidden');
  var first = !gateOpen; gateOpen = true; showLicTop();
  if(first && !lsGet('warnSeen')){ lsSet('warnSeen', '1'); showWarn(); }   // 首訪警語在第一次解鎖後才跳
}
function gateLock(text, l){
  gateOpen = false; LICINFO = null; showLicTop();
  gateStatus('bad', '✗ ' + text); gateHead(l && l.reason === 'headcount_exceeded' ? l : null);
  closeModal(); $('entryGate').classList.remove('hidden');
}
function gateRun(serial, renew){
  if(!serial){ gateLock(REASON_LABEL.missing_serial); return Promise.resolve(); }
  return checkLicense(serial, 1, renew).then(function(l){
    if(l.valid) gateUnlock(l);
    else if(l.reason === 'server_error' && gateOpen) return;
    else gateLock(REASON_LABEL[l.reason] || l.message || '序號驗證失敗', l);
  }).catch(function(e){ if(!gateOpen) gateLock(e.message); });
}
function gateLogout(){
  var s = rawGet(SERIAL_KEY);
  if(s && navigator.sendBeacon){ try{ navigator.sendBeacon(LICENSE_CHECK_URL, new Blob([JSON.stringify({serial:s, sheet:LICENSE_SHEET, clientId:clientId(), release:true})], {type:'text/plain'})); }catch(e){} }
  rawDel(SERIAL_KEY); $('entryGateSerial').value = ''; gateLock('已登出，請輸入登入序號');
}
function initGate(){
  var input = $('entryGateSerial'), btn = $('btnEntryGateConfirm');
  function mask(hide){ var t = $('btnEntryGateToggle'); input.type = hide ? 'password' : 'text'; t.textContent = hide ? '👁 顯示' : '🙈 隱藏'; t.setAttribute('aria-pressed', String(!hide)); }
  btn.onclick = function(){ var s = input.value.trim(); rawSet(SERIAL_KEY, s); mask(true); gateStatus('', '驗證中…'); gateRun(s, false); };
  input.addEventListener('keydown', function(e){ if(e.key === 'Enter') btn.click(); });
  $('btnEntryGateToggle').onclick = function(){ mask(input.type === 'text'); };
  if(FREE_SERIAL){
    $('gateFreeCode').textContent = FREE_SERIAL;
    $('btnGateFree').onclick = function(){ input.value = FREE_SERIAL; btn.click(); };
    $('btnGateFreeCopy').onclick = function(){ var b = this; function done(){ b.textContent = '已複製 ✓'; setTimeout(function(){ b.textContent = '複製序號'; }, 2000); } if(navigator.clipboard) navigator.clipboard.writeText(FREE_SERIAL).then(done, done); else done(); };
  } else $('gateFree').hidden = true;
  input.value = rawGet(SERIAL_KEY) || '';
  if(input.value){ gateStatus('', '驗證中…'); gateRun(input.value, false); } else gateLock(REASON_LABEL.missing_serial);
  setInterval(function(){ var s = rawGet(SERIAL_KEY); if(s && gateOpen) gateRun(s, true); }, RECHECK_MS);
}
/* ---------- 啟動 ---------- */
window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); window._dp = e; });
if('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('service-worker.js').catch(function(){});
(function(){ if(!window.TOOL_WATERMARK) return; var w = document.createElement('div'); w.id = 'pdfWatermark'; w.setAttribute('aria-hidden', 'true'); w.innerHTML = '<img alt="" src="' + window.TOOL_WATERMARK + '">'; document.body.appendChild(w); })();
applyView(); render(); initMarquee();
initGate();
// 測試掛鉤
window._tool = {render:render, panel:panel, get S(){ return S; }, get V(){ return V; }, ACT:ACT, importFiles:importFiles, finalize:finalize, paperDoc:paperDoc, cardDoc:cardDoc, keyDoc:keyDoc, bpDoc:bpDoc};
})();
