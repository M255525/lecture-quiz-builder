# 端對端測試：python tools/e2e_lqb.py [截圖資料夾]
# 自己在 port 8919 起靜態伺服器（不佔用正式預覽的 8909）
# 範本產生的部分只驗標準配備；這個工具自己的功能測試加在「主功能」那段。
import sys, io, os, json, subprocess, time, urllib.request
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SHOTS = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'tools', '_shots')
os.makedirs(SHOTS, exist_ok=True)
PORT = 8919
BASE = 'http://127.0.0.1:%d/' % PORT
fails = []
def ok(name, cond, extra=''):
    print(('✓ ' if cond else '✗ ') + name + (('  ' + str(extra)) if extra and not cond else ''))
    if not cond: fails.append(name)

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1', '--directory', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(40):
    try: urllib.request.urlopen(BASE, timeout=1); break
    except Exception: time.sleep(.25)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': 1280, 'height': 900})
        # 擋掉訪客計數器，測試不灌「工具使用分析」的數字
        ctx.route('**/visitor-badge.laobi.icu/**', lambda r: r.abort())
        pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        # 序號閘門：假造授權回應，不碰真的試算表（GOOD 有效、OLD 過期、其他查無）
        def fake_license(route):
            body = json.loads(route.request.post_data or '{}')
            s = body.get('serial', '')
            ok_sheet = body.get('sheet') == '講義出題試卷工坊'
            if s == 'GOOD' and ok_sheet: d = {'valid': True, 'expiresAt': '2099-12-31T00:00:00+08:00', 'headcountLimit': 5, 'headcountRemaining': 4}
            elif s == 'OLD': d = {'valid': False, 'reason': 'expired'}
            else: d = {'valid': False, 'reason': 'serial_not_found'}
            route.fulfill(status=200, content_type='application/json', body=json.dumps(d))
        ctx.route('https://script.google.com/macros/s/AKfycbw2qz-sTKRVkVHGQZLTj73xlJdDiaHG8eNexjAN9XWMrly5BnxVcP8dC0qE3kADHeIl/exec*', fake_license)
        pg.goto(BASE); pg.wait_for_timeout(700)
        ok('閘門擋住工具', pg.locator('#entryGate:not(.hidden)').count() == 1)
        pg.fill('#entryGateSerial', 'NOPE'); pg.click('#btnEntryGateConfirm'); pg.wait_for_timeout(300)
        ok('查無序號', '查無此序號' in pg.inner_text('#entryGateStatus'))
        pg.fill('#entryGateSerial', 'OLD'); pg.press('#entryGateSerial', 'Enter'); pg.wait_for_timeout(300)
        ok('過期序號', '過期' in pg.inner_text('#entryGateStatus') and pg.locator('#entryGate:not(.hidden)').count() == 1)
        pg.fill('#entryGateSerial', 'GOOD'); pg.click('#btnEntryGateConfirm'); pg.wait_for_timeout(400)
        ok('有效序號解鎖', pg.locator('#entryGate.hidden').count() == 1 and '2099/12/31' in pg.inner_text('#licTop'))
        ok('序號不用工具前綴（清資料不登出）', pg.evaluate("localStorage.getItem('lectureQuizBuilderEntrySerial')") == 'GOOD')

        # ---------- 標準配備 ----------
        ok('首次造訪跳出警語', pg.locator('#modal.show').count() == 1 and '使用警語' in pg.inner_text('#modalBox'))
        pg.click('#modalBox [data-act=close]')
        ok('重新整理不再跳警語', (pg.reload(), pg.wait_for_timeout(500), pg.locator('#modal.show').count() == 0)[2])
        ok('沒有 JS 錯誤', not errs, errs)
        ok('頁面上看得到警語入口', pg.locator('.warn-line [data-act=warn]').count() == 1)
        ok('頁尾有創作者、手冊、計數器', '創作者' in pg.inner_text('.foot') and pg.locator('.foot a[href="manual.html"]').count() == 1 and pg.locator('.foot img[src*="page_id=m255525.lecturequizbuilder"]').count() == 1)
        ok('跑馬燈存在且沒有關閉鈕', pg.locator('#marqueeBar #marqueeTrack').count() == 1 and pg.locator('#marqueeBar button').count() == 0)
        css = pg.evaluate("Array.from(document.styleSheets).map(s=>{try{return Array.from(s.cssRules).map(r=>r.cssText).join('\\n')}catch(e){return ''}}).join('\\n')")
        ok('跑馬燈滑鼠移入暫停', 'paused' in css and '#marqueeBar:hover' in css)
        ok('[hidden] 有 !important', '[hidden] { display: none !important; }' in css)

        pg.click('[data-act=settings]')
        ok('⚙ 常用設定是收合式', pg.locator('#modalBox details.set-sec').count() >= 3 and pg.locator('#modalBox details.set-sec[open]').count() == 0)
        ok('設定裡沒有跑馬燈開關', '跑馬燈' not in pg.inner_text('#modalBox'))
        pg.click('#modalBox details[data-sec=about] > summary')
        about = pg.inner_text('#modalBox details[data-sec=about]')
        ok('關於本工具集中五項入口', all(k in about for k in ('創作者', '操作手冊', '使用警語', '加入主畫面', '訪客數')), about)
        pg.click('[data-act=close]'); pg.click('[data-act=settings]')
        ok('記住展開狀態', pg.locator('#modalBox details[data-sec=about][open]').count() == 1)
        pg.click('#modalBox details[data-sec=view] > summary'); pg.click('[data-fontsize=xl]')
        ok('大字', pg.evaluate("document.documentElement.dataset.fsize") == 'xl')
        pg.click('[data-fontsize=m]'); pg.click('[data-act=close]')

        # ---------- 主功能 ----------
        pg.evaluate("window.print = () => { window._printed = (window._printed || 0) + 1; }")
        # 用 Chromium 把兩份中文講義印成 PDF（有文字層），第二份多一頁空白頁＝模擬掃描圖
        def mkpdf(name, pages):
            hp = ctx.new_page()
            hp.set_content('<html><body style="font-family:Microsoft JhengHei,sans-serif;font-size:18px">' + ''.join('<div style="page-break-after:always">' + x + '</div>' for x in pages) + '</body></html>')
            path = os.path.join(SHOTS, name); hp.pdf(path=path, format='A4'); hp.close(); return path
        pdf1 = mkpdf('講義一_專案管理.pdf', ['<h2>專案管理概論</h2><p>專案範疇是指專案必須完成的工作內容與交付成果。</p><p>里程碑是指專案中用來檢查進度的重要時間點。</p>',
                                          '<p>專案的生命週期包括啟動、規劃、執行、結案。</p><p>甘特圖：用橫條顯示每項工作開始與結束時間的圖表。</p>'])
        pdf2 = mkpdf('講義二_溝通.pdf', ['<p>主動傾聽是指專心聽對方說話，並用提問與回應確認理解的溝通方式。</p><p>回饋的原則包括具體、即時、對事不對人。</p>', '&nbsp;'])
        pg.click('[data-tab=src]')
        pg.set_input_files('#srcFile', [pdf1, pdf2])
        pg.wait_for_function("window._tool.S.docs.length >= 2", timeout=60000); pg.wait_for_timeout(500)
        docs = pg.evaluate("window._tool.S.docs")
        ok('PDF 取得中文字', '專案範疇是指' in docs[0]['pages'][0]['text'].replace(' ', '').replace('\n', ''), docs[0]['pages'][0]['text'][:80])
        ok('PDF 逐頁', len(docs[0]['pages']) == 2 and docs[0]['pages'][1]['page'] == 2)
        ok('空白頁標成掃描圖', docs[1]['pages'][1]['scan'] is True)
        ok('畫面提示掃描頁', '可能是掃描圖' in pg.inner_text('#panel-src'))
        ok('章節預設用檔名', docs[0]['chapter'] == '講義一_專案管理')
        pg.click('[data-act=sample]'); pg.wait_for_timeout(200)
        ok('載入範例講義', len(pg.evaluate("window._tool.S.docs")) == 4)
        rng = pg.locator('[data-docrange]').nth(2); rng.fill('1-3'); rng.dispatch_event('change')
        ok('頁碼範圍', '已選 3 頁' in pg.inner_text('#panel-src'))

        # ② 出題
        pg.click('[data-tab=bank]')
        pg.click('[data-act=ruleGen]'); pg.wait_for_timeout(300)
        n1 = pg.evaluate("window._tool.S.bank.length")
        ok('規則出題有題目', n1 >= 10, n1)
        ok('每題都有出處', pg.evaluate("window._tool.S.bank.every(q => q.src && q.src.page)"))
        ok('PDF 講義也出到題', pg.evaluate("window._tool.S.bank.some(q => q.src.file.indexOf('專案管理') >= 0)"))
        ok('題卡顯示出處', '第 ' in pg.locator('#bankList .qc').first.inner_text())
        pg.click('[data-act=ruleGen]'); pg.wait_for_timeout(300)
        ok('再按一次重複題不會全部加進來', pg.evaluate("window._tool.S.bank.length") - n1 < n1, pg.evaluate("window._tool.S.bank.length"))
        ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin=BASE.rstrip('/'))
        pg.click('[data-act=aiGen]'); pg.wait_for_timeout(200)
        ok('沒金鑰時提示去設定', '還沒有設定 AI 金鑰' in pg.inner_text('#aiOut'))
        pg.click('#panel-bank details.mini > summary')
        pg.click('[data-act=aiCopy]'); pg.wait_for_timeout(300)
        prompt = pg.evaluate('navigator.clipboard.readText()')
        ok('複製出題提示詞', '[P1｜' in prompt and 'quote' in prompt and '專案範疇' in prompt, prompt[:200])
        ai = json.dumps({'questions': [
            {'type': 's', 'q': '專案中用來檢查進度的重要時間點稱為？', 'opts': ['里程碑', '甘特圖', '範疇', '風險'], 'ans': 'A', 'page': 'P1', 'quote': '里程碑是指專案中用來檢查進度的重要時間點', 'bloom': '記憶', 'diff': '易'},
            {'type': 't', 'q': 'AI 自己編的', 'ans': '對', 'page': 'P1', 'quote': '講義裡沒有這句話啦啦啦', 'bloom': '理解', 'diff': '中'}]}, ensure_ascii=False)
        pg.fill('#aiPaste', ai); pg.click('[data-act=aiImport]'); pg.wait_for_timeout(300)
        ok('貼回 AI 回覆加進題庫', pg.evaluate("window._tool.S.bank.some(q => q.origin === 'ai' && q.opts[0] === '里程碑' && !q.warn.length)"))
        ok('假出處標警告', pg.evaluate("window._tool.S.bank.some(q => q.q === 'AI 自己編的' && q.warn.indexOf('找不到出處') >= 0)"))
        first = pg.evaluate("window._tool.S.bank.find(q => q.type === 's').id")
        pg.click('[data-act=edit][data-id="%s"]' % first)
        pg.fill('#eQ', '（修改過）下列哪一項正確？'); pg.click('[data-act=eSave]'); pg.wait_for_timeout(200)
        ok('修改並採用', pg.evaluate("(() => { const q = window._tool.S.bank.find(q => q.id === '%s'); return q.q.indexOf('修改過') >= 0 && q.status === 'ok'; })()" % first))
        bad = pg.evaluate("window._tool.S.bank.find(q => q.q === 'AI 自己編的').id")
        pg.click('[data-act=del][data-id="%s"]' % bad)
        pg.select_option('[data-filt=status]', 'all'); pg.wait_for_timeout(150)
        pg.click('[data-act=okAll]'); pg.wait_for_timeout(200)
        ok('全部採用', pg.evaluate("window._tool.S.bank.every(q => q.status === 'ok')"))
        with pg.expect_download() as dl: pg.click('[data-act=expTch]')
        ok('匯出給小幫手的 Excel', dl.value.suggested_filename.endswith('.xlsx'))

        # ③ 組卷
        pg.click('[data-tab=paper]')
        cells = pg.locator('[data-bp]:not([disabled])')
        ok('細目表有可填格子', cells.count() >= 3, cells.count())
        for i in range(min(3, cells.count())):
            c = cells.nth(i); mx = int(c.get_attribute('max')); c.fill(str(min(2, mx))); c.dispatch_event('change')
        pg.click('[data-act=pick]'); pg.wait_for_timeout(200)
        n = pg.evaluate("window._tool.S.cfg.paper.ids.length")
        ok('依細目表抽題', 3 <= n <= 6, n)
        pg.click('[data-act=pickAll]'); pg.wait_for_timeout(200)
        n = pg.evaluate("window._tool.S.cfg.paper.ids.length")
        ok('全部已審題目放進試卷', n == pg.evaluate("window._tool.S.bank.length"), n)
        pg.select_option('[data-bind="paper.nVer"]', '2'); pg.wait_for_timeout(200)
        pg.click('[data-act=prPaper]'); pg.wait_for_timeout(300)
        ok('列印試卷 A、B 兩卷', pg.locator('#printArea .sheet').count() == 2 and 'B 卷' in pg.inner_text('#printArea'))
        ok('有呼叫列印', (pg.evaluate("window._printed") or 0) >= 1)
        pg.emulate_media(media='print')
        ok('列印時只印試卷', pg.evaluate("getComputedStyle(document.getElementById('app')).display") == 'none' and pg.evaluate("getComputedStyle(document.getElementById('printArea')).display") == 'block')
        pg.screenshot(path=os.path.join(SHOTS, 'print-paper.png'), full_page=True)
        pg.emulate_media(media='screen'); pg.evaluate("document.body.classList.remove('printing')")
        pg.click('[data-act=prCard]'); pg.wait_for_timeout(200)
        pg.emulate_media(media='print'); pg.screenshot(path=os.path.join(SHOTS, 'print-card.png')); pg.emulate_media(media='screen')
        ok('答案卡有劃記圈', pg.locator('#printArea .br i').count() > n)
        pg.click('[data-act=prKey]'); pg.wait_for_timeout(200)
        ok('解答本有出處', 'p.' in pg.inner_text('#printArea'))
        pg.click('[data-act=prBp]'); pg.wait_for_timeout(200)
        ok('雙向細目表', '認知層次' in pg.inner_text('#printArea'))
        pg.evaluate("document.body.classList.remove('printing')")
        pg.click('[data-tab=bank]'); pg.wait_for_timeout(200); pg.screenshot(path=os.path.join(SHOTS, 'bank.png'))
        pg.click('[data-tab=paper]'); pg.wait_for_timeout(200); pg.screenshot(path=os.path.join(SHOTS, 'paper.png'), full_page=True)
        pg.click('[data-act=gas]'); pg.wait_for_timeout(200)
        code = pg.input_value('#modalBox textarea.code')
        ok('產生 GAS 程式碼', 'FormApp.create' in code and 'setIsQuiz(true)' in code and '（B 卷）' in code)
        ok('GAS 程式碼語法正確', pg.evaluate("(c) => { try { new Function(c); return true; } catch(e) { return e.message; } }", code) is True)
        pg.click('[data-act=gasCopy]'); pg.wait_for_timeout(200)
        ok('複製 GAS 程式碼', 'createQuiz' in pg.evaluate('navigator.clipboard.readText()'))
        pg.click('#modalBox [data-act=close]')

        # ④ 試題分析
        pg.click('[data-tab=ana]')
        pg.click('[data-act=sim]'); pg.wait_for_timeout(300)
        ok('模擬 40 人分析', '40 人' in pg.inner_text('#panel-ana') and pg.locator('table.ana > tbody > tr').count() == n)
        ok('有 KR-20', 'KR-20' in pg.inner_text('#panel-ana'))
        rows = pg.evaluate("(() => { const f = window._tool.S.cfg.fin; return LQB.simulate(f.items, [f.versions[1]], 6, 3); })()")
        tsv = '\n'.join('\t'.join(str(x) for x in r) for r in rows)
        pg.click('[data-act=respClear]'); pg.wait_for_timeout(150)
        pg.click('#panel-ana details.mini > summary')
        pg.fill('#respPaste', tsv); pg.click('[data-act=respPaste]'); pg.wait_for_timeout(300)
        ok('貼上 6 人作答（B 卷）', '已載入 6 位' in pg.inner_text('#respOut'), pg.inner_text('#respOut'))
        ok('人數少有提醒', '少於 20 人' in pg.inner_text('#panel-ana'))
        pg.click('[data-act=sim]'); pg.wait_for_timeout(300)
        pg.click('[data-act=saveStats]'); pg.wait_for_timeout(200)
        ok('統計寫回題庫', pg.evaluate("window._tool.S.bank.every(q => q.stats && q.stats.length === 1)"))
        with pg.expect_download() as dl: pg.click('[data-act=expScore]')
        ok('成績 Excel', dl.value.suggested_filename.endswith('.xlsx'))
        pg.click('[data-act=prAna]'); pg.wait_for_timeout(200)
        ok('列印分析報告', '試題分析報告' in pg.inner_text('#printArea'))
        pg.evaluate("document.body.classList.remove('printing')")
        pg.screenshot(path=os.path.join(SHOTS, 'analysis.png'), full_page=True)
        pg.reload(); pg.wait_for_timeout(600)
        ok('重新整理後題庫還在', pg.evaluate("window._tool.S.bank.length") == n)
        ok('作答名單不會存起來', '學員1' not in pg.evaluate("Object.keys(localStorage).map(k => localStorage.getItem(k)).join('')"))

        # 備份還原
        pg.click('[data-act=settings]')
        if pg.locator('#modalBox details[data-sec=data][open]').count() == 0: pg.click('#modalBox details[data-sec=data] > summary')
        with pg.expect_download() as dl: pg.click('[data-act=backup]')
        path = os.path.join(SHOTS, 'backup.json'); dl.value.save_as(path)
        j = json.load(open(path, encoding='utf-8'))
        ok('備份檔格式', j.get('app') == 'lecture-quiz-builder' and len(j['state']['bank']) == n)
        pg.click('[data-act=wipe]'); pg.click('[data-act=wipeYes]')
        ok('清除後題庫是空的', pg.evaluate("window._tool.S.bank.length") == 0)
        pg.click('[data-act=settings]')
        if pg.locator('#modalBox details[data-sec=data][open]').count() == 0: pg.click('#modalBox details[data-sec=data] > summary')
        pg.set_input_files('#restoreFile', path); pg.wait_for_timeout(300)
        ok('從備份還原', pg.evaluate("window._tool.S.bank.length") == n)

        # ---------- AI 設定 ----------
        pg.click('[data-act=settings]')
        if pg.locator('#modalBox details[data-sec=ai][open]').count() == 0: pg.click('#modalBox details[data-sec=ai] > summary')
        ok('AI 設定有 7 家', pg.locator('#aiProv option').count() == 7)
        pg.fill('#aiKey', 'sample-value-123')
        ok('金鑰只存本機', 'sample-value-123' in (pg.evaluate("localStorage.getItem('lqb.ai')") or ''))
        pg.select_option('#aiProv', 'custom'); pg.wait_for_timeout(200)
        ok('切到自訂端點會出現網址欄', pg.locator('#aiBase').count() == 1)
        pg.click('[data-ai-clear]'); pg.click('#modalBox [data-act=close]')
        ok('Gemini 舊模型自動換新', pg.evaluate("TOOL_AI.geminiModelFix('gemini-2.0-flash')") != 'gemini-2.0-flash')

        pg.click('[data-act=settings]')
        if pg.locator('#modalBox details[data-sec=lic][open]').count() == 0: pg.click('#modalBox details[data-sec=lic] > summary')
        pg.click('[data-act=logout]'); pg.wait_for_timeout(300)
        ok('登出後閘門出現', pg.locator('#entryGate:not(.hidden)').count() == 1)
        pg.fill('#entryGateSerial', 'GOOD'); pg.click('#btnEntryGateConfirm'); pg.wait_for_timeout(400)
        # ---------- PWA、手冊、列印 ----------
        pg.wait_for_timeout(800)
        ok('service worker 已註冊', pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>!!r)"))
        mf = json.loads(urllib.request.urlopen(BASE + 'manifest.json').read().decode('utf-8'))
        ok('manifest 圖示', len(mf.get('icons', [])) == 3 and all(os.path.exists(os.path.join(ROOT, i['src'])) for i in mf['icons']))
        sw = open(os.path.join(ROOT, 'service-worker.js'), encoding='utf-8').read()
        ok('SW 只刪自己前綴的快取', "k.indexOf(CACHE_NAME.replace(" in sw)
        pg.emulate_media(media='print')
        ok('列印有浮水印', pg.evaluate("getComputedStyle(document.getElementById('pdfWatermark')).display") == 'flex')
        pg.emulate_media(media='screen')
        mp = ctx.new_page(); mp.goto(BASE + 'manual.html')
        ok('手冊有完整版創作者資料', mp.locator('#creator .mk-creator').count() == 1 and len(mp.inner_text('#creator')) > 400)
        ok('手冊有手冊計數器', mp.locator('img[src*="m255525.lecturequizbuilder.manual"]').count() == 1)
        mp.close()

        # ---------- 手機寬度 ----------
        pg.set_viewport_size({'width': 390, 'height': 800}); pg.wait_for_timeout(200)
        ok('390px 不橫向捲動', pg.evaluate("document.documentElement.scrollWidth <= 391"))
        pg.screenshot(path=os.path.join(SHOTS, 'mobile.png'), full_page=True)
        pg.set_viewport_size({'width': 1280, 'height': 900}); pg.screenshot(path=os.path.join(SHOTS, 'desktop.png'), full_page=True)
        ok('全程沒有 JS 錯誤', not errs, errs)
        b.close()
finally:
    srv.terminate()

print('\n' + ('全部通過' if not fails else '失敗 %d 項：%s' % (len(fails), '、'.join(fails))))
sys.exit(1 if fails else 0)
