"""Full-app browser regressions, with real local export libraries and a fake cloud.

Run: python3 tests/integration_browser.py
Requires Python Playwright and Chromium; pdfinfo checks run when installed.
No Firebase request or database write can leave this local test server.
"""
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlparse
import json
import os
import shutil
import subprocess
import tempfile
import unittest
import zipfile
import xml.etree.ElementTree as ET
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
FAKE_FIREBASE = r'''
window.__cloudWrites=[];
window.__cloudData={};
window.firebase={
  apps:[],
  initializeApp(){this.apps.push({});},
  database(){return {ref(path){return {
    on(){},off(){},
    once(){return Promise.resolve({val:()=>window.__cloudData[path]||null});},
    set(data){const copy=JSON.parse(JSON.stringify(data));window.__cloudData[path]=copy;window.__cloudWrites.push({path,data:copy});return Promise.resolve();}
  };}};}
};
'''


class FixtureHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_GET(self):
        path = urlparse(self.path).path
        if path.endswith('/vendor/firebase-app-compat.js') or path.endswith('/vendor/firebase-database-compat.js'):
            body = FAKE_FIREBASE if path.endswith('firebase-app-compat.js') else '// Fake database SDK is included in the test app SDK.'
            raw = body.encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/javascript')
            self.send_header('Content-Length', str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
        else:
            super().do_GET()


class AppIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(FixtureHandler, directory=str(ROOT)))
        cls.server_thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()
        cls.origin = f'http://127.0.0.1:{cls.server.server_port}'
        cls.playwright = sync_playwright().start()
        chromium = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or cls.playwright.chromium.executable_path
        cls.browser = cls.playwright.chromium.launch(executable_path=chromium, headless=True, args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.server_thread.join()

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='rezaot-integration-')
        self.context = self.browser.new_context(viewport={'width': 390, 'height': 844}, timezone_id='Asia/Kuala_Lumpur', service_workers='block', accept_downloads=True)
        self.errors = []
        self.outbound = []
        self.page = self.new_page(self.context)
        self.open_app(self.page)
        self.page.evaluate("selectMonth('Oktober 2026')")

    def new_page(self, context):
        page = context.new_page()
        page.on('pageerror', lambda error: self.errors.append(str(error)))
        def route(request):
            if request.request.url.startswith(self.origin + '/'):
                request.continue_()
            else:
                self.outbound.append(request.request.url)
                request.abort()
        page.route('**/*', route)
        return page

    def open_app(self, page):
        page.goto(self.origin + '/', wait_until='domcontentloaded')
        page.wait_for_function("document.body.dataset.startup === 'ready' || document.body.dataset.startup === 'failed'")
        self.assertEqual(page.locator('body').get_attribute('data-startup'), 'ready', page.locator('#startupStatus').text_content())

    def tearDown(self):
        self.context.close()
        self.temp.cleanup()
        self.assertEqual(self.errors, [], 'Unexpected full-app JavaScript errors')
        self.assertEqual(self.outbound, [], 'Full app attempted an outbound connection')

    def seed_record(self, *, side=False, date='2026-10-19'):
        record = {'clock_in': '08:00', 'clock_out': '19:00', 'trips': ['KLIA Cargo (TEST-AWB) *'] if side else ['REVIEW-TRIP']}
        if side:
            record['sideJobs'] = [{'awb': 'TEST-AWB', 'type': 'susun'}]
        self.page.evaluate('''({date,record})=>{
          dailyRecords[date]=RezaOT_model.normalizeRecord(record,date);
          saveToLocalStorage();updateReport();
        }''', {'date': date, 'record': record})

    def test_boot_is_local_and_error_free_and_all_modules_initialized(self):
        state = self.page.evaluate('''()=>({
          ready:window.__rezaotInited,
          month:currentMonthKey,
          tripOptions:document.querySelectorAll('#destination option').length,
          cardContainer:!!document.querySelector('#mobileCards'),
          exporter:typeof window.loadExcelLib,
          localAuthDefault:REZAOT_CONFIG.requireAuth
        })''')
        self.assertTrue(state['ready'])
        self.assertEqual(state['month'], 'Oktober 2026')
        self.assertGreater(state['tripOptions'], 1)
        self.assertTrue(state['cardContainer'])
        self.assertEqual(state['exporter'], 'function')
        self.assertFalse(state['localAuthDefault'])

    def test_mobile_day_actions_have_readable_light_theme_text(self):
        self.seed_record()
        colors = self.page.locator('#mobileCards .mc-actions button').evaluate_all("""buttons=>buttons.map(button=>{
          const style=getComputedStyle(button);
          return {foreground:style.color,background:style.backgroundColor};
        })""")
        def luminance(color):
            import re
            channels = [float(number) / 255 for number in re.findall(r'[\d.]+', color)[:3]]
            linear = [channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4 for channel in channels]
            return sum(channel * coefficient for channel, coefficient in zip(linear, [0.2126, 0.7152, 0.0722]))
        self.assertEqual(len(colors), 2)
        for button in colors:
            text = luminance(button['foreground'])
            background = luminance(button['background'])
            contrast = (max(text, background) + 0.05) / (min(text, background) + 0.05)
            self.assertGreaterEqual(contrast, 4.5, button)
        icon = self.page.locator('#mobileCards .mc-trip-delete').first.evaluate("""button=>{
          const s=getComputedStyle(button),box=button.getBoundingClientRect();
          return {color:s.color,background:s.backgroundColor,size:parseFloat(s.fontSize),width:box.width,height:box.height,opacity:s.opacity};
        }""")
        text, background = luminance(icon['color']), luminance(icon['background'])
        self.assertGreaterEqual((max(text, background)+0.05)/(min(text, background)+0.05), 4.5, icon)
        self.assertGreaterEqual(icon['size'], 16)
        self.assertGreaterEqual(icon['width'], 44)
        self.assertGreaterEqual(icon['height'], 44)
        self.assertEqual(icon['opacity'], '1')

    def test_english_toggle_translates_salary_without_discarding_unsaved_form(self):
        self.page.locator('#destination').select_option(label='KLIA Cargo')
        self.page.locator('#airwayBill').fill('UNSAVED-EN')
        self.page.locator('#clockOut').fill('19:10')
        self.page.locator('#salaryToggleBtn').click()
        self.page.locator('#langToggleBtn').click()
        self.assertIn('Trips & OT Report', self.page.locator('h1').text_content())
        self.assertIn('Basic salary', self.page.locator('#salaryPanelBody').text_content())
        self.assertIn('Employee EPF', self.page.locator('#salaryPanelBody').text_content())
        self.assertEqual(self.page.locator('#destination').input_value(), 'KLIA Cargo')
        self.assertEqual(self.page.locator('#airwayBill').input_value(), 'UNSAVED-EN')
        self.assertEqual(self.page.locator('#clockOut').input_value(), '19:10')

    def test_first_excel_click_downloads_real_workbook_with_side_marks(self):
        self.seed_record(side=True)
        self.assertEqual(self.page.evaluate('typeof XLSX'), 'undefined')
        with self.page.expect_download() as result:
            self.page.locator('#exportExcelBtn').click()
        download = result.value
        target = Path(self.temp.name) / download.suggested_filename
        download.save_as(target)
        self.assertEqual(download.failure(), None)
        self.assertGreater(target.stat().st_size, 1000)
        with zipfile.ZipFile(target) as book:
            tree = ET.fromstring(book.read('xl/worksheets/sheet1.xml'))
            ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            values = [''.join(cell.itertext()) for cell in tree.findall('.//s:c', ns)]
        self.assertIn('KLIA Cargo *', values)
        self.assertIn('TEST-AWB', values)
        self.assertEqual(self.page.evaluate('typeof html2pdf'), 'undefined', 'Excel must not depend on the PDF loader')

    def test_annual_and_unpaid_leave_save_without_clock_times_and_show_zero_ot(self):
        for checkbox, date, flag in [('annualLeaveCheck', '2026-10-18', 'annual'), ('unpaidLeaveCheck', '2026-10-19', 'unpaid')]:
            self.page.locator('#date').fill(date)
            self.page.locator('#clockIn').fill('')
            self.page.locator('#clockOut').fill('')
            self.page.locator('#' + checkbox).check()
            self.page.locator('#clockForm [type=submit]').click()
            self.page.wait_for_function('(date)=>!!dailyRecords[date]', arg=date)
            record = self.page.evaluate('(date)=>dailyRecords[date]', date)
            self.assertTrue(record[flag])
            self.assertFalse(record['unpaid' if flag == 'annual' else 'annual'])
            self.assertEqual(self.page.evaluate('(date)=>RezaOT_recordOT(date,dailyRecords[date])', date), 0)
        self.assertEqual(self.page.locator('#totalOT').text_content(), '0.00')
        self.assertEqual(self.page.locator('#mobileCards .mc-card').count(), 2)

    def test_duplicate_cancel_and_confirmed_mobile_trip_deletion_are_atomic(self):
        self.seed_record(side=True)
        before = self.page.evaluate('JSON.stringify(dailyRecords)')
        self.page.locator('#date').fill('2026-10-19')
        self.page.locator('#destination').select_option(label='KLIA Cargo')
        self.page.locator('#airwayBill').fill('TEST-AWB')
        self.page.locator('input[name=sideJob][value=pallets]').check()
        self.page.locator('#tripForm [type=submit]').click()
        self.page.locator('#rezaotModalCancel').click()
        self.page.wait_for_function("!document.querySelector('#tripForm').__saving")
        self.assertEqual(self.page.evaluate('JSON.stringify(dailyRecords)'), before)
        self.page.locator('#mobileCards .mc-trip-delete').click()
        self.page.locator('#rezaotModalOk').click()
        self.page.wait_for_function("dailyRecords['2026-10-19'].trips.length === 0")
        self.assertEqual(self.page.evaluate("dailyRecords['2026-10-19'].sideJobs"), [])
        self.assertEqual(self.page.evaluate('RezaOT_salary.estimate(dailyRecords).sideIncome.total'), 0)

    def test_invalid_backup_is_rejected_before_state_or_storage_changes(self):
        self.seed_record()
        before = self.page.evaluate('JSON.stringify(dailyRecords)')
        malformed = {'month': 'Oktober 2026', 'dailyRecords': {'2026-10-19': {'clock_in': '08:00', 'clock_out': '19:00', 'trips': 'oops'}}}
        self.page.locator('#importDataInput').set_input_files({'name': 'invalid.json', 'mimeType': 'application/json', 'buffer': json.dumps(malformed).encode()})
        self.page.wait_for_function("!document.querySelector('#importDataInput').__importing")
        self.assertEqual(self.page.evaluate('JSON.stringify(dailyRecords)'), before)
        self.assertFalse(self.page.locator('#rezaotModal').is_visible() if self.page.locator('#rezaotModal').count() else False)
        self.assertEqual(self.page.evaluate("JSON.parse(localStorage.getItem('dailyRecords_Oktober 2026'))['2026-10-19'].trips"), ['REVIEW-TRIP'])

    def test_legacy_backup_restores_source_month_and_preserves_other_month(self):
        self.seed_record()
        source = {'month': 'September 2026', 'dailyRecords': {'2026-09-15': {'clock_in': '08:00', 'clock_out': '18:00', 'trips': ['RESTORED-TRIP']}}, 'trips': ['RESTORED-TRIP']}
        self.page.locator('#importDataInput').set_input_files({'name': 'september.json', 'mimeType': 'application/json', 'buffer': json.dumps(source).encode()})
        self.page.locator('[data-choice=replace]').click()
        self.page.wait_for_function("!document.querySelector('#importDataInput').__importing")
        self.assertEqual(self.page.evaluate('currentMonthKey'), 'September 2026')
        self.assertEqual(self.page.evaluate("dailyRecords['2026-09-15'].trips"), ['RESTORED-TRIP'])
        self.assertEqual(self.page.evaluate("JSON.parse(localStorage.getItem('dailyRecords_Oktober 2026'))['2026-10-19'].trips"), ['REVIEW-TRIP'])
        self.assertGreater(self.page.evaluate('RezaOT_storage.recoveryEntries().length'), 0)

    def test_mobile_pdf_downloads_real_portrait_and_landscape_files(self):
        self.seed_record()
        self.page.evaluate('''()=>{
          const original=window.loadPdfLib;
          window.loadPdfLib=async function(){
            await original();
            if(window.__capturePdf)return;
            window.__capturePdf=true;
            const real=window.html2pdf;
            window.html2pdf=function(){
              window.__pdfLayout={table:getComputedStyle(document.querySelector('#reportTable')).display,cards:getComputedStyle(document.querySelector('#mobileCards')).display,report:document.querySelector('#reportTable').textContent};
              return real.apply(this,arguments);
            };
          };
        }''')
        for orientation in ['portrait', 'landscape']:
            with self.page.expect_download(timeout=45000) as result:
                self.page.locator('#exportPdfBtn').click()
                self.page.locator('[data-choice=' + orientation + ']').click()
            target = Path(self.temp.name) / result.value.suggested_filename
            result.value.save_as(target)
            self.page.wait_for_function('!window.__pdfBusy')
            self.assertTrue(target.read_bytes().startswith(b'%PDF-'))
            self.assertGreater(target.stat().st_size, 10000)
            layout = self.page.evaluate('window.__pdfLayout')
            self.assertEqual(layout['table'], 'table')
            self.assertEqual(layout['cards'], 'none')
            self.assertIn('REVIEW-TRIP', layout['report'])
            self.assertFalse(self.page.locator('body').evaluate("el=>el.classList.contains('pdf-export')"))
            if shutil.which('pdfinfo'):
                info = subprocess.run(['pdfinfo', str(target)], capture_output=True, text=True, check=True).stdout
                self.assertRegex(info, r'Pages:\s+1\b')
                dimensions = next(line for line in info.splitlines() if line.startswith('Page size:'))
                width, height = [float(number) for number in dimensions.split()[2:5:2]]
                self.assertGreater(width if orientation == 'landscape' else height, height if orientation == 'landscape' else width)

    def test_cross_month_date_rejected_even_when_html_validation_is_bypassed(self):
        result = self.page.evaluate("""async()=>{
          document.querySelector('#date').value='2026-09-15';
          document.querySelector('#clockIn').value='08:00';
          document.querySelector('#clockOut').value='19:00';
          const attendance=await handleClockFormSubmit({preventDefault(){}});
          document.querySelector('#destination').value='KLIA Cargo';
          document.querySelector('#airwayBill').value='WRONG-MONTH';
          const trip=await handleTripFormSubmit({preventDefault(){}});
          return {attendance,trip,records:dailyRecords,stored:localStorage.getItem('dailyRecords_Oktober 2026')};
        }""")
        self.assertFalse(result['attendance'])
        self.assertFalse(result['trip'])
        self.assertEqual(result['records'], {})
        self.assertIsNone(result['stored'])

    def test_quick_save_cancel_preserves_leave_and_confirm_resets_it(self):
        today = self.page.evaluate("""()=>{
          const date=getLocalDateString(new Date());
          const month=RezaOT_model.monthFromDate(date);
          selectMonth(month);
          dailyRecords[date]=RezaOT_model.normalizeRecord({annual:true,clock_in:'',clock_out:'',trips:['RETAINED-TRIP']},date);
          saveToLocalStorage();updateReport();return date;
        }""")
        before = self.page.evaluate('JSON.stringify(dailyRecords)')
        self.page.locator('#quickSaveTodayBtn').click()
        self.page.locator('#rezaotModalCancel').click()
        self.page.wait_for_function('!window.__quickSaving')
        self.assertEqual(self.page.evaluate('JSON.stringify(dailyRecords)'), before)
        self.page.locator('#quickSaveTodayBtn').click()
        self.page.locator('#rezaotModalOk').click()
        self.page.wait_for_function('!window.__quickSaving')
        record = self.page.evaluate('(date)=>dailyRecords[date]', today)
        self.assertFalse(record['annual'])
        self.assertFalse(record['unpaid'])
        self.assertEqual(record['clock_in'], '08:00')
        self.assertEqual(record['clock_out'], '17:00')
        self.assertEqual(record['trips'], ['RETAINED-TRIP'])

    def test_quick_save_does_not_mutate_another_month_after_confirmation_wait(self):
        self.page.evaluate("""()=>{
          const date=getLocalDateString(new Date());selectMonth(RezaOT_model.monthFromDate(date));
          dailyRecords[date]=RezaOT_model.normalizeRecord({annual:true,trips:[]},date);saveToLocalStorage();updateReport();
          window.__quickResult=null;void quickSaveToday().then(value=>window.__quickResult=value);
        }""")
        self.page.locator('#rezaotModalOk').wait_for(state='visible')
        self.page.evaluate("selectMonth('September 2026')")
        self.page.locator('#rezaotModalOk').click()
        self.page.wait_for_function('window.__quickResult!==null')
        self.assertFalse(self.page.evaluate('window.__quickResult'))
        self.assertEqual(self.page.evaluate('currentMonthKey'), 'September 2026')
        self.assertEqual(self.page.evaluate('dailyRecords'), {})

    def test_service_worker_offline_reload_retains_records_and_exports(self):
        context = self.browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='allow', accept_downloads=True)
        try:
            page = self.new_page(context)
            self.open_app(page)
            page.evaluate("selectMonth('Oktober 2026');dailyRecords={'2026-10-19':RezaOT_model.normalizeRecord({clock_in:'08:00',clock_out:'19:00',trips:['OFFLINE-TRIP']},'2026-10-19')};saveToLocalStorage();updateReport()")
            page.evaluate('navigator.serviceWorker.ready')
            page.wait_for_function('!!navigator.serviceWorker.controller')
            page.evaluate("caches.open('another-pwa-cache').then(c=>c.put('/unrelated',new Response('keep'))) ")
            context.set_offline(True)
            page.reload(wait_until='domcontentloaded')
            page.wait_for_function("document.body.dataset.startup === 'ready'")
            page.evaluate("selectMonth('Oktober 2026')")
            self.assertEqual(page.evaluate("dailyRecords['2026-10-19'].trips"), ['OFFLINE-TRIP'])
            self.assertIn('another-pwa-cache', page.evaluate('caches.keys()'))
            with page.expect_download() as result:
                page.locator('#exportExcelBtn').click()
            self.assertIsNone(result.value.failure())
            self.assertEqual(page.evaluate('typeof XLSX'), 'object')
        finally:
            context.close()


if __name__ == '__main__':
    unittest.main(verbosity=2)
