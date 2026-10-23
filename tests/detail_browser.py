"""v71 report/salary rendering regressions; local fixture, no Firebase requests."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import os
import shutil
import unittest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = '''<!doctype html><html lang="ms"><head><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/styles-print.css"><link rel="stylesheet" href="/styles-detail.css">
<style>body{padding:12px!important}.container{margin:0!important;padding:0!important;max-width:100%!important}</style></head>
<body class="app-shell"><main class="container"><div id="salaryPanel"><div class="salary-toolbar"><span id="salaryUplAutoHint"></span><input id="salaryUnpaidDays" type="number" value="0"></div><div id="salaryPanelBody"></div></div>
<div class="table-wrap"><table id="reportTable"><tbody></tbody></table></div></main>
<script>let currentMonthKey="Oktober 2026";let dailyRecords={"2026-10-19":{clock_in:"08:00",clock_out:"19:00",trips:["KLIA Cargo (TEST) *"],sideJobs:[{awb:"TEST",type:"susun"}]},"2026-10-20":{clock_in:"",clock_out:"",trips:[],annual:true}};
window.showToast=()=>{};window.__actions=[];window.editRecord=(...a)=>__actions.push(['edit',...a]);window.deleteRecord=(...a)=>__actions.push(['delete',...a]);window.editTrip=(...a)=>__actions.push(['editTrip',...a]);window.deleteTrip=(...a)=>__actions.push(['deleteTrip',...a]);</script>
<script src="/storage.js"></script><script src="/constants.js"></script><script src="/utils.js"></script><script src="/i18n.js"></script><script src="/salary-estimator.js"></script><script src="/mobile-cards.js"></script>
<script>document.dispatchEvent(new Event('rezaot-ready'))</script></body></html>'''


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


class DetailRenderingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True); cls.thread.start()
        cls.origin = f'http://127.0.0.1:{cls.server.server_port}'
        cls.playwright = sync_playwright().start()
        chromium = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or cls.playwright.chromium.executable_path
        cls.browser = cls.playwright.chromium.launch(executable_path=chromium, headless=True, args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.playwright.stop(); cls.server.shutdown(); cls.server.server_close(); cls.thread.join()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
        self.page = self.context.new_page()
        self.page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(self.origin) else r.abort())
        self.page.route('**/detail-fixture', lambda r: r.fulfill(body=FIXTURE, content_type='text/html'))
        self.errors=[];self.page.on('pageerror', lambda e:self.errors.append(str(e)))
        self.page.goto(self.origin+'/detail-fixture', wait_until='networkidle')

    def tearDown(self):
        self.context.close();self.assertEqual(self.errors, [])

    def test_net_salary_and_separate_side_income_remain_distinct(self):
        before = self.page.locator('#salaryNetValue').text_content()
        self.assertIn('100.00', self.page.locator('.salary-side-value').text_content())
        self.page.evaluate("dailyRecords['2026-10-19'].sideJobs[0].type='pallets';RezaOT_salary.refresh()")
        self.assertEqual(self.page.locator('#salaryNetValue').text_content(), before)
        self.assertIn('50.00', self.page.locator('.salary-side-value').text_content())
        self.assertEqual(self.page.locator('.salary-breakdown-grid .salary-section-card').count(), 2)

    def test_calculation_details_reveal_full_basis_and_preserve_open_state(self):
        self.assertFalse(self.page.locator('.salary-calculation-details').evaluate('el=>el.open'))
        self.page.locator('.salary-calculation-details summary').click()
        self.assertTrue(self.page.locator('.salary-detail-table').is_visible())
        self.assertEqual(self.page.locator('.salary-detail-table tr').count(), 8)
        self.page.evaluate('RezaOT_salary.refresh()')
        self.assertTrue(self.page.locator('.salary-calculation-details').evaluate('el=>el.open'))

    def test_mobile_record_badges_actions_and_untrusted_labels(self):
        self.assertEqual(self.page.locator('.mc-status-annual').count(), 1)
        self.assertEqual(self.page.locator('.mc-ot-badge strong').nth(1).text_content(), '0.00')
        self.page.locator('.mc-trip-edit').click();self.page.locator('.mc-trip-delete').click()
        self.assertEqual(self.page.evaluate('__actions'), [['editTrip','2026-10-19',0],['deleteTrip','2026-10-19',0]])
        self.page.evaluate("dailyRecords['2026-10-19'].trips=['<img src=x onerror=window.__injected=true>'];RezaOT_mobileCards.render()")
        self.assertEqual(self.page.locator('.mc-trip-edit img').count(),0)
        self.assertIsNone(self.page.evaluate('window.__injected'))

    def test_salary_layout_fits_narrow_phone_including_large_valid_amounts(self):
        self.page.set_viewport_size({'width':320,'height':740})
        self.page.evaluate('RezaOT_salary.saveSettings({basicSalary:100000000,kliaPerDay:0});RezaOT_salary.refresh()')
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),320)
        self.assertTrue(self.page.locator('.salary-net-value--large').is_visible())
        self.assertEqual(self.page.locator('.salary-table td').first.evaluate('el=>getComputedStyle(el).textAlign'),'left')
        self.assertEqual(self.page.locator('.salary-table td').nth(1).evaluate('el=>getComputedStyle(el).textAlign'),'right')


if __name__=='__main__':
    unittest.main(verbosity=2)
