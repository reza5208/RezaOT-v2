"""Browser regressions for report layout/actions and accessible dialogs.

Run: python3 tests/ui_browser.py (requires Playwright and Chromium).
Uses a local fixture and no Firebase/network backend.
"""
from pathlib import Path
import os
import shutil
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import threading
import unittest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = '''<!doctype html><html lang="ms"><head>
<link rel="stylesheet" href="/styles-app-v42.css">
<link rel="stylesheet" href="/styles-print.css">
<style>.container{max-width:100%;padding:12px;box-sizing:border-box}button{min-height:30px}</style>
</head><body><main class="container">
<button id="trigger">Trigger</button><button id="printButton">Print</button><button id="exportPdfBtn">PDF</button>
<button id="menuToggleBtn">Menu</button><div id="menuPanel" hidden><button>Settings</button></div>
<div class="table-wrap"><table id="reportTable"><thead><tr><th>Date</th><th>Trip</th></tr></thead><tbody><tr><td>19/10/26</td><td>Shah Alam</td></tr></tbody></table></div>
</main><script>
let dailyRecords={"2026-10-19":{clock_in:"08:00",clock_out:"19:00",trips:["Shah Alam","KLIA Cargo (ABC)"]}};
let currentMonthKey="Oktober 2026";
window.__actions=[];
window.editTrip=(date,index)=>window.__actions.push(["edit",date,index]);
window.deleteTrip=(date,index)=>window.__actions.push(["delete",date,index]);
window.editRecord=(date)=>window.__actions.push(["editRecord",date]);
window.deleteRecord=(date)=>window.__actions.push(["deleteRecord",date]);
window.showToast=message=>window.__toast=message;
window.calculateOT=()=>2;
window.formatDateForPDF=date=>date.split('-').reverse().join('/');
</script><script src="/modal.js"></script><script src="/mobile-cards.js"></script>
<script src="/print-fix-v51.js"></script><script src="/print-orient-v67.js"></script>
<script>document.dispatchEvent(new Event('rezaot-ready'))</script></body></html>'''


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


class UIRegressionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.origin = f'http://127.0.0.1:{cls.server.server_port}'
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or cls.playwright.chromium.executable_path, headless=True, args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
        self.page = self.context.new_page()
        self.page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(self.origin) else route.abort())
        self.page.route('**/ui-fixture', lambda route: route.fulfill(body=FIXTURE, content_type='text/html'))
        self.page.goto(self.origin + '/ui-fixture', wait_until='networkidle')

    def tearDown(self):
        self.context.close()

    def test_dialog_traps_focus_escape_restores_trigger(self):
        self.page.locator('#trigger').focus()
        self.page.evaluate("window.__answer=null; void rezaotConfirm('Padam rekod?').then(v=>window.__answer=v)")
        self.assertEqual(self.page.locator(':focus').get_attribute('id'), 'rezaotModalOk')
        self.page.keyboard.press('Tab')
        self.assertEqual(self.page.locator(':focus').get_attribute('id'), 'rezaotModalCancel')
        self.page.keyboard.press('Shift+Tab')
        self.assertEqual(self.page.locator(':focus').get_attribute('id'), 'rezaotModalOk')
        self.assertEqual(self.page.locator('[role=dialog]').get_attribute('aria-labelledby'), 'rezaotModalTitle')
        self.page.keyboard.press('Escape')
        self.assertIs(self.page.evaluate('window.__answer'), False)
        self.assertEqual(self.page.locator(':focus').get_attribute('id'), 'trigger')
        self.assertFalse(self.page.locator('main').evaluate('(el)=>el.inert'))

    def test_overlapping_dialog_requests_both_resolve_in_order(self):
        self.page.evaluate("window.__answers=[]; void rezaotConfirm('First').then(v=>__answers.push(v)); void rezaotPrompt('Second','old').then(v=>__answers.push(v))")
        self.page.locator('#rezaotModalOk').click()
        self.page.locator('#rezaotModalInput').fill('new')
        self.page.keyboard.press('Enter')
        self.assertEqual(self.page.evaluate('__answers'), [True, 'new'])
        self.assertTrue(self.page.locator('#rezaotModal').get_attribute('hidden') is not None)

    def test_choice_returns_value_and_escape_returns_null(self):
        self.page.evaluate("window.__answer=undefined; void rezaotChoose('Import',[{value:'merge',label:'Merge'},{value:'replace',label:'Replace'}]).then(v=>__answer=v)")
        self.page.locator('[data-choice=merge]').click()
        self.assertEqual(self.page.evaluate('__answer'), 'merge')
        self.page.evaluate("void rezaotChoose('Again',[{value:'merge',label:'Merge'}]).then(v=>__answer=v)")
        self.page.keyboard.press('Escape')
        self.assertIsNone(self.page.evaluate('__answer'))

    def test_mobile_has_individual_trip_and_day_actions(self):
        self.assertEqual(self.page.locator('#mobileCards .mc-trip-edit').count(), 2)
        self.page.locator('.mc-trip-edit').nth(1).click()
        self.page.locator('.mc-trip-delete').nth(0).click()
        self.page.locator('.mc-actions button').nth(0).click()
        self.assertEqual(self.page.evaluate('__actions'), [
            ['edit', '2026-10-19', 1], ['delete', '2026-10-19', 0], ['editRecord', '2026-10-19']])
        self.page.evaluate("dailyRecords={};document.dispatchEvent(new Event('rezaot-report'))")
        self.assertEqual(self.page.locator('.mc-card').count(), 0)

    def install_pdf_capture(self, failure=False):
        self.page.evaluate('''(failure)=>{
          window.loadPdfLib=()=>Promise.resolve();
          window.html2pdf=()=>({
            set(options){window.__pdfOptions=options;return this;},
            from(element){window.__pdfLayout={table:getComputedStyle(document.querySelector('#reportTable')).display,cards:getComputedStyle(document.querySelector('#mobileCards')).display,width:element.getBoundingClientRect().width};return this;},
            toCanvas(){
              const canvas=document.createElement('canvas');canvas.width=800;canvas.height=300;
              const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,800,300);
              this.prop={canvas,pageSize:{inner:{ratio:window.__pdfOptions.jsPDF.orientation==='landscape'?196/281:279/194}}};
              return this;
            },
            then(callback){return Promise.resolve().then(()=>callback.call(this));},
            toPdf(){return this;},
            save(){return failure?Promise.reject(new Error('download failed')):Promise.resolve();}
          });
        }''', failure)

    def test_phone_pdf_contains_report_at_a4_width_and_cleans_up(self):
        self.install_pdf_capture()
        self.assertTrue(self.page.evaluate("RezaOT_print.exportPdf('portrait')"))
        layout = self.page.evaluate('__pdfLayout')
        self.assertEqual(layout['table'], 'table')
        self.assertEqual(layout['cards'], 'none')
        self.assertGreater(layout['width'], 700)
        self.assertEqual(self.page.evaluate('__pdfOptions.html2canvas.windowWidth'), 794)
        self.assertEqual(self.page.evaluate('__pdfOptions.jsPDF.orientation'), 'portrait')
        self.assertFalse(self.page.evaluate('__pdfBusy'))
        self.assertFalse(self.page.locator('body').evaluate("el=>el.classList.contains('pdf-export')"))
        self.assertEqual(self.page.locator('#reportTable').evaluate('(el)=>getComputedStyle(el).display'), 'none')

    def test_landscape_failure_and_library_failure_restore_layout(self):
        self.install_pdf_capture(failure=True)
        self.assertFalse(self.page.evaluate("RezaOT_print.exportPdf('landscape')"))
        self.assertGreater(self.page.evaluate('__pdfLayout.width'), 1000)
        self.assertEqual(self.page.evaluate('__pdfOptions.jsPDF.orientation'), 'landscape')
        self.assertFalse(self.page.evaluate('__pdfBusy'))
        self.page.evaluate("void (window.loadPdfLib=()=>Promise.reject(new Error('offline'))) ")
        self.assertFalse(self.page.evaluate("RezaOT_print.exportPdf('portrait')"))
        self.assertFalse(self.page.locator('body').evaluate("el=>el.classList.contains('pdf-export')"))
        self.assertFalse(self.page.evaluate('__pdfBusy'))

    def test_native_print_waits_for_afterprint_before_cleanup(self):
        self.install_pdf_capture()
        self.page.evaluate("void (window.print=()=>{window.__nativePrinted=true})")
        self.assertTrue(self.page.evaluate("RezaOT_print.print('portrait')"))
        self.assertTrue(self.page.evaluate('__printBusy'))
        self.assertTrue(self.page.locator('body').evaluate("el=>el.classList.contains('pdf-export')"))
        self.page.evaluate("window.dispatchEvent(new Event('afterprint'))")
        self.assertFalse(self.page.evaluate('__printBusy'))
        self.assertFalse(self.page.locator('body').evaluate("el=>el.classList.contains('pdf-export')"))

    def test_pdf_button_single_choice_and_single_export(self):
        self.install_pdf_capture()
        self.page.locator('#exportPdfBtn').click()
        self.page.locator('[data-choice=portrait]').click()
        self.page.wait_for_function('window.__pdfLayout && !window.__pdfBusy')
        self.assertEqual(self.page.locator('#rezaotModal').count(), 1)


if __name__ == '__main__':
    unittest.main(verbosity=2)
