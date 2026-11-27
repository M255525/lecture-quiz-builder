/* 講義出題試卷工坊：畫面
   範本產生的骨架：跑馬燈、⚙ 常用設定（收合式）、首訪警語、手冊／創作者／加入主畫面／訪客數、
   備份還原、大字、列印浮水印都已接好。功能寫在「主功能」區塊（mainHTML／refresh）。 */
(function(){
'use strict';
var D = window.LQB, PFX = 'lqb.';
function lsGet(k){ try{ return localStorage.getItem(PFX + k); }catch(e){ return null; } }
function lsSet(k, v){ try{ localStorage.setItem(PFX + k, v); }catch(e){} }
function lsDel(k){ try{ localStorage.removeItem(PFX + k); }catch(e){} }
function lsJson(k, d){ try{ var v = JSON.parse(lsGet(k)); return v == null ? d : v; }catch(e){ return d; } }
function $(id){ return document.getElementById(id); }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]; }); }
function today(){ var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }

var COUNTER = 'https://visitor-badge.laobi.icu/badge?page_id=m255525.lecturequizbuilder';
var standalone = window.matchMedia && matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
var TABS = [['main', '主功能'], ['about', '說明']];
var V = {tab:lsGet('tab') || 'main'};
if(!TABS.some(function(t){ return t[0] === V.tab; })) V.tab = 'main';

/* ---------- 資料 ---------- */
function defaults(){ return {input:Object.assign({}, D.BASE)}; }
function load(){ var s = lsJson('state', null); return s && s.input ? s : defaults(); }
var S = load();
function save(){ lsSet('state', JSON.stringify(S)); }

/* ---------- 畫面 ---------- */
function render(){
  var licTop = '';
  licTop = '<button class="ibtn lictop" id="licTop" data-act="settings" hidden></button>';
  var h ='<div class="print-head"><h1>講義出題試卷工坊</h1><div class="small">列印日期 ' + today() + '</div></div>' +
    '<div class="bar"><h1><span class="seal">卷</span>講義出題試卷工坊<small>多份講義 PDF→出題審題→A/B 卷試卷→Google 表單→試題分析</small></h1>' +
    licTop + '<a class="ibtn noprint" href="manual.html">📖 操作手冊</a><button class="ibtn" data-act="print">🖨 列印</button><button class="ibtn" data-act="settings" aria-label="常用設定">⚙</button></div>' +
    '<p class="warn-line">題目由規則或 AI 產生，須由講師審題後使用；講義與教材的著作權請自行確認<button data-act="warn">⚠ 使用警語</button></p>' +
    '<nav class="tabs" role="tablist">' + TABS.map(function(t){ return '<button role="tab" data-tab="' + t[0] + '" aria-selected="' + (V.tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</nav>' +
    TABS.map(function(t){ return '<section class="panel" data-p="' + t[0] + '" id="panel-' + t[0] + '"' + (V.tab === t[0] ? '' : ' hidden') + '></section>'; }).join('') +
    '<footer class="foot">👤 創作者 Mark Tsai（蔡豐全）・<a href="manual.html">📖 操作手冊</a>・<a href="#" data-act="warn">⚠ 使用警語</a>' + (standalone ? '' : '・<a href="#" data-act="install">📲 加入主畫面</a>') +
    '<br><img src="' + COUNTER + '" alt="訪客次數" height="20" loading="lazy" style="vertical-align:middle;margin-top:.4rem"></footer>';
  $('app').innerHTML = h;
  showLicTop();
  $('panel-main').innerHTML = mainHTML();
  $('panel-about').innerHTML = aboutHTML();
  refresh();
}
function fld(k, label, unit, hint){
  return '<label class="fld">' + label + '<input type="number" inputmode="decimal" data-f="' + k + '" value="' + esc(S.input[k]) + '">' + (hint ? '<small>' + hint + '</small>' : '') + '</label>';
}
// ── 主功能：範例表單，換成這個工具真正的介面 ──
function mainHTML(){
  var h = '<div class="card"><h3>輸入</h3><div class="row">' +
    fld('qty', '數量') + fld('price', '單價（元）') + fld('discount', '折扣（%）', '', '0～100') +
    '</div><div class="result" id="result"></div>' +
    '<div class="btns"><button class="btn alt" data-act="reset">恢復預設值</button></div></div>';
  h += '<div class="card"><h3>🤖 AI 解說</h3><p class="small">AI 只解說規則算出來的結果，不改數字。沒有金鑰也可以複製提示詞，貼到任何 AI。</p>' +
    '<div class="btns"><button class="btn" data-act="aiExplain">✨ 請 AI 解說</button><button class="btn alt" data-act="aiCopy">📋 複製提示詞</button></div><div id="aiOut" class="small" style="white-space:pre-wrap;margin-top:.5rem"></div></div>';
  return h;
}
// 輸入時只更新結果、不重繪表單，焦點才不會跑掉
function refresh(){
  var r = D.calc(S.input);
  var el = $('result'); if(el) el.innerHTML = '小計 <span class="num">' + D.money(r.gross) + '</span>・合計 <b>' + D.money(r.total) + '</b>';
}
// AI 提示詞：只放規則算好的事實，要求 AI 不要改數字
function aiPrompt(){
  var r = D.calc(S.input);
  return '請用親切的繁體中文（台灣用語），在 120 字內說明下面這個計算結果代表什麼。不要更改任何數字；不確定的地方請標示【請查證】。\n\n' +
    '數量 ' + r.p.qty + '、單價 ' + r.p.price + ' 元、折扣 ' + r.p.discount + '%\n小計 ' + D.money(r.gross) + '，合計 ' + D.money(r.total);
}
function copyText(text, msg){
  function fb(){ var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); toast(msg); }catch(e){ toast('複製失敗，請手動選取'); } ta.remove(); }
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function(){ toast(msg); }, fb); else fb();
}
function aboutHTML(){
  return '<div class="card"><h3>這是什麼</h3><p>多份講義 PDF→出題審題→A/B 卷試卷→Google 表單→試題分析</p><p class="small">詳細步驟請看 <a href="manual.html">📖 操作手冊</a>。</p></div>';
}

/* ---------- 彈窗、警語、設定 ---------- */
function openModal(h){ $('modalBox').innerHTML = h; $('modal').classList.add('show'); $('modalBox').scrollTop = 0; var f = $('modalBox').querySelector('button,a,input'); if(f) f.focus(); }
function closeModal(){ $('modal').classList.remove('show'); }
var toastT;
function toast(m){ var o = document.querySelector('.toast'); if(o) o.remove(); var t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = m; document.body.appendChild(t); clearTimeout(toastT); toastT = setTimeout(function(){ t.remove(); }, 3000); }
// 使用警語：頁面上看得到（warn-line、頁尾、⚙），首次造訪自動跳出一次
var WARN_HTML = '<h2>⚠ 使用警語</h2><ul>' +
  '<li>題目由規則或 AI 產生，須由講師審題後使用；講義與教材的著作權請自行確認</li>' +
  '<li>資料只存在這台裝置的瀏覽器，不會上傳；換裝置前請先在 ⚙ 下載備份檔。</li>' +
  '<li>（範本產生）請依這個工具的性質補上：數字來源與查證日期、規則是自訂的經驗法則、範例全部虛構、不可宣稱的功效等。</li></ul>';
function showWarn(){ openModal(WARN_HTML + '<div class="vstack"><button class="btn" data-act="close">我知道了</button></div>'); }
function sec(id, title, val, body){ return '<details class="set-sec" data-sec="' + id + '"><summary><span class="sst">' + title + '</span><span class="ssv">' + esc(val) + '</span></summary><div class="set-body">' + body + '</div></details>'; }
function openSettings(){
  var xl = lsGet('fsize') === 'xl';
  openModal('<div class="bar"><h2 style="flex:1 1 0">⚙ 常用設定</h2><button class="ibtn" data-act="foldall">全部展開／收合</button></div>' +
    sec('data', '資料', '只存在這台裝置', '<p class="small">換電腦或手機前先下載備份檔，再到新裝置還原。</p><div class="vstack"><button class="btn" data-act="backup">下載備份檔</button><button class="btn alt" data-act="restore">從備份檔還原</button><button class="btn red" data-act="wipe">清除全部資料</button></div><input type="file" id="restoreFile" accept=".json,application/json" hidden>') +
    sec('lic', '🔑 登入序號', gateInfo.text.replace(/^✓ /, ''), '<p><span class="lic ' + gateInfo.cls + '">' + esc(gateInfo.text) + '</span></p><div class="vstack"><button class="btn alt" data-act="logout">登出（換一組序號）</button></div>') +
    sec('ai', '🤖 AI 設定', window.TOOL_AI ? TOOL_AI.status() : '', window.TOOL_AI ? TOOL_AI.settingsHTML() : '') +
    sec('view', '顯示', xl ? '大字' : '標準字', '<div class="vstack"><button class="btn' + (xl ? ' alt' : '') + '" data-fontsize="m">標準字</button><button class="btn' + (xl ? '' : ' alt') + '" data-fontsize="xl">大字</button></div>') +
    sec('about', '關於本工具', '', '<p>👤 創作者 Mark Tsai（蔡豐全）<br><a href="manual.html#creator">創作者資料與聯絡方式</a></p><div class="vstack"><a class="btn alt" href="manual.html">📖 操作手冊</a><button class="btn alt" data-act="warn">⚠ 使用警語</button>' +
      (standalone ? '' : '<button class="btn alt" data-act="install">📲 加入主畫面</button>') + '</div><p class="small" style="margin-top:.5rem">訪客數 <img src="' + COUNTER + '" alt="訪客次數" height="20" loading="lazy" style="vertical-align:middle"></p>') +
    '<div class="vstack"><button class="btn" data-act="close">關閉</button></div>');
  var open = lsJson('fold', []);
  document.querySelectorAll('.set-sec').forEach(function(d){ d.open = open.indexOf(d.dataset.sec) >= 0; d.addEventListener('toggle', saveFold); });
  $('restoreFile').addEventListener('change', restoreFile);
  if(window.TOOL_AI) TOOL_AI.bind(function(){ openSettings(); var d = document.querySelector('.set-sec[data-sec="ai"]'); if(d) d.open = true; });
}
function saveFold(){ var o = []; document.querySelectorAll('.set-sec').forEach(function(d){ if(d.open) o.push(d.dataset.sec); }); lsSet('fold', JSON.stringify(o)); }
function applyView(){ document.documentElement.dataset.fsize = lsGet('fsize') === 'xl' ? 'xl' : 'm'; }

/* ---------- 檔案 ---------- */
function download(name, text, type){ var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], {type:type})); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500); }
function restoreFile(ev){
  var f = ev.target.files[0]; if(!f) return;
  var rd = new FileReader();
  rd.onload = function(){
    try{ var j = JSON.parse(rd.result); if(j.app !== 'lecture-quiz-builder' || !j.state || !j.state.input) throw 0; S = {input:D.normalize(j.state.input)}; save(); closeModal(); render(); toast('已還原備份'); }
    catch(e){ toast('這不是講義出題試卷工坊的備份檔'); }
  };
  rd.readAsText(f);
}

/* ---------- 事件 ---------- */
var ACT = {
  settings:openSettings, close:closeModal, warn:showWarn, print:function(){ window.print(); },
  foldall:function(){ var d = document.querySelectorAll('.set-sec'), any = Array.prototype.some.call(d, function(x){ return !x.open; }); d.forEach(function(x){ x.open = any; }); saveFold(); },
  reset:function(){ S = defaults(); save(); render(); toast('已恢復預設值'); },
  logout:function(){ closeModal(); gateLogout(); },
  aiCopy:function(){ copyText(aiPrompt(), '已複製提示詞，可以貼到任何 AI'); },
  aiExplain:function(){
    var out = $('aiOut');
    if(!window.TOOL_AI || !TOOL_AI.ready()){ out.textContent = '還沒有設定 AI 金鑰：到 ⚙ 常用設定 →「🤖 AI 設定」填入，或按「📋 複製提示詞」貼到任何 AI。'; return; }
    out.textContent = 'AI 思考中…';
    TOOL_AI.callLLM(aiPrompt(), null, false, function(m){ out.textContent = m; }).then(function(t){ out.textContent = t; }, function(e){ out.textContent = '❌ ' + e.message; });
  },
  backup:function(){ download('講義出題試卷工坊備份-' + today() + '.json', JSON.stringify({app:'lecture-quiz-builder', v:1, saved:new Date().toISOString(), state:S}, null, 1), 'application/json'); },
  restore:function(){ $('restoreFile').click(); },
  wipe:function(){ openModal('<h2>清除全部資料？</h2><p>這台裝置上的資料都會刪掉，無法復原。建議先下載備份檔。</p><div class="vstack"><button class="btn red" data-act="wipeYes">確定清除</button><button class="btn alt" data-act="close">取消</button></div>'); },
  wipeYes:function(){ lsDel('state'); S = defaults(); closeModal(); render(); toast('已清除'); },
  install:function(){
    var m = ios ? '請按 Safari 下方的「分享」圖示，選「加入主畫面」。' : '請按瀏覽器網址列右側的安裝圖示，或右上角選單的「安裝應用程式／加到主畫面」。';
    if(window._dp){ window._dp.prompt(); window._dp.userChoice.then(function(){ window._dp = null; }); }
    else openModal('<h2>📲 加入主畫面</h2><p>' + m + '</p><div class="vstack"><button class="btn" data-act="close">知道了</button></div>');
  }
};
document.addEventListener('click', function(ev){
  var el = ev.target.closest('[data-act],[data-tab],[data-fontsize]');
  if(!el){ if(ev.target.id === 'modal') closeModal(); return; }
  var ds = el.dataset;
  if(ds.act){ if(el.tagName === 'A') ev.preventDefault(); if(ACT[ds.act]) ACT[ds.act](); return; }
  if(ds.tab){ V.tab = ds.tab; lsSet('tab', V.tab); document.querySelectorAll('.tabs button').forEach(function(b){ b.setAttribute('aria-selected', b.dataset.tab === V.tab); }); document.querySelectorAll('.panel').forEach(function(s){ s.hidden = s.dataset.p !== V.tab; }); return; }
  if(ds.fontsize){ lsSet('fsize', ds.fontsize); applyView(); openSettings(); return; }
});
document.addEventListener('input', function(ev){
  var t = ev.target, ds = t.dataset;
  if(ds.f){ S.input[ds.f] = t.type === 'number' ? (t.value === '' ? '' : Number(t.value)) : t.value; save(); refresh(); }
});
// 離開欄位時把空白或超出範圍的數字整理回合法值（只有真的被修正才動，避免吃掉使用者的下一次點擊）
document.addEventListener('change', function(ev){
  var t = ev.target;
  if(t.dataset.f && t.type === 'number'){ var k = t.dataset.f, n = D.normalize(S.input); if(S.input[k] !== n[k]){ S.input[k] = n[k]; t.value = n[k]; save(); refresh(); } }
});
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
   序號在試算表分頁「講義出題試卷工坊」，打共用的 Apps Script，請求帶 sheet 指定分頁（後端支援 payload.sheet）。
   開啟時 fail-closed：驗證沒通過就整個工具都不能用。已登入後每 20 分鐘背景重驗，只有連線失敗或 server_error 不上鎖。
   序號存 lectureQuizBuilderEntrySerial（刻意不用 lqb. 前綴，⚙ 清除全部資料不會登出）。純前端閘門，懂 DevTools 的人可移除遮罩，已知取捨。 */
var LICENSE_CHECK_URL = 'https://script.google.com/macros/s/AKfycbw2qz-sTKRVkVHGQZLTj73xlJdDiaHG8eNexjAN9XWMrly5BnxVcP8dC0qE3kADHeIl/exec';
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
  var end = new Date(e.getFullYear(), e.getMonth(), e.getDate()), t = new Date(), today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return {text:end.getFullYear() + '/' + (end.getMonth() + 1) + '/' + end.getDate(), left:Math.max(Math.round((end - today) / 86400000), 0)};
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
window._tool = {render:render, get S(){ return S; }, get V(){ return V; }};
})();
