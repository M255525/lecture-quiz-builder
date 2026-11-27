/* PDF 逐頁取文字（Mozilla PDF.js 3.11.174，Apache-2.0）
   用到才從 CDN 載入；worker 先 fetch 再轉 Blob 網址（同源才不會被擋）；cMaps 一定要給，否則中文 CID 字型會取到空白。
   做法照 行銷內容工具/content-workflow-studio-cf/index.html 的 extractPdfText，改成「每頁分開」並可把某頁畫成 JPEG（給 AI 看圖用）。
   PDF 檔本身不上傳、不存檔，只留在這次開啟的記憶體裡。 */
(function(){
'use strict';
var BASE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/';
var loading = null;
function load(){
  if(window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions.workerSrc) return Promise.resolve(window.pdfjsLib);
  if(loading) return loading;
  loading = new Promise(function(ok, no){
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = function(){
      fetch('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js').then(function(r){ if(!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }).then(function(code){
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], {type:'text/javascript'}));
        ok(window.pdfjsLib);
      }).catch(function(e){ loading = null; no(new Error('PDF 讀取元件載入失敗，請確認網路後再試（' + e.message + '）')); });
    };
    s.onerror = function(){ loading = null; no(new Error('PDF 讀取元件載入失敗，請確認網路後再試')); };
    document.head.appendChild(s);
  });
  return loading;
}
function open(buf){
  return load().then(function(pdfjs){
    return pdfjs.getDocument({data:new Uint8Array(buf.slice ? buf.slice(0) : buf), cMapUrl:BASE + 'cmaps/', cMapPacked:true, standardFontDataUrl:BASE + 'standard_fonts/'}).promise;
  }).catch(function(e){
    if(e && e.name === 'PasswordException') throw new Error('這個 PDF 有密碼保護，請先解除密碼再匯入');
    throw e && /載入失敗/.test(e.message) ? e : new Error('PDF 打不開（' + ((e && e.message) || e) + '）');
  });
}
// 回傳 [{page, text}]；onProgress(第幾頁, 總頁數)
function pages(buf, onProgress){
  return open(buf).then(function(doc){
    var out = [], n = doc.numPages;
    function one(i){
      if(i > n){ doc.destroy(); return out; }
      return doc.getPage(i).then(function(pg){
        return pg.getTextContent().then(function(tc){
          var line = '', lines = [];
          tc.items.forEach(function(it){ if(typeof it.str !== 'string') return; line += it.str; if(it.hasEOL){ lines.push(line); line = ''; } });
          if(line) lines.push(line);
          // 部分字型會取出康熙部首字（⾥、⼈…），轉回一般中文字，比對出處、搜尋才找得到
          out.push({page:i, text:lines.map(function(l){ return l.replace(/\s+$/, ''); }).join('\n').replace(/[⺀-⿟]/g, function(c){ return c.normalize('NFKC'); })});
          pg.cleanup(); if(onProgress) onProgress(i, n);
          return one(i + 1);
        });
      });
    }
    return one(1);
  });
}
// 把某一頁畫成 JPEG（寬 1400px），給 AI 看圖辨識掃描頁
function renderJpeg(buf, pageNo){
  return open(buf).then(function(doc){
    return doc.getPage(pageNo).then(function(pg){
      var v = pg.getViewport({scale:1}), sc = Math.min(2.5, 1400 / v.width), vp = pg.getViewport({scale:sc});
      var cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
      var ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      return pg.render({canvasContext:ctx, viewport:vp}).promise.then(function(){
        var url = cv.toDataURL('image/jpeg', .82); doc.destroy();
        return {mime:'image/jpeg', b64:url.split(',')[1], dataUrl:url};
      });
    });
  });
}
window.LQBPDF = {load:load, pages:pages, renderJpeg:renderJpeg};
})();
