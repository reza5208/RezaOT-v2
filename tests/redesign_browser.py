"""Behavior checks for the responsive v71 shell, using a local fake Firebase.

Run: python3 tests/redesign_browser.py
The shared fixture blocks outbound connections and never writes to a live database.
"""
from pathlib import Path
import unittest
import integration_browser as integration


class RedesignBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        integration.AppIntegrationTests.setUpClass.__func__(cls)

    @classmethod
    def tearDownClass(cls):
        integration.AppIntegrationTests.tearDownClass.__func__(cls)

    setUp = integration.AppIntegrationTests.setUp
    tearDown = integration.AppIntegrationTests.tearDown
    new_page = integration.AppIntegrationTests.new_page
    open_app = integration.AppIntegrationTests.open_app
    seed_record = integration.AppIntegrationTests.seed_record

    def navigate(self, name):
        self.page.locator('.app-nav-link[data-view="' + name + '"]:visible').first.click()
        self.page.locator('#view-' + name).wait_for(state='visible')

    def test_navigation_exposes_one_view_and_keyboard_selection(self):
        self.assertTrue(self.page.locator('#view-today').is_visible())
        for name in ['records', 'salary', 'settings', 'today']:
            target = self.page.locator('.app-nav-link[data-view="' + name + '"]:visible').first
            target.focus()
            self.page.keyboard.press('Enter')
            self.assertTrue(self.page.locator('#view-' + name).is_visible())
            self.assertEqual(self.page.locator('.app-view:not([hidden])').count(), 1)
            self.assertEqual(target.get_attribute('aria-current'), 'page')

    def test_switching_views_retains_unsaved_attendance_and_trip_fields(self):
        self.page.locator('#clockOut').fill('19:10')
        self.page.locator('#destination').select_option(label='KLIA Cargo')
        self.page.locator('#airwayBill').fill('UNSAVED-REDESIGN')
        self.page.locator('input[name=sideJob][value=susun]').check()
        self.navigate('records')
        self.navigate('salary')
        self.navigate('settings')
        self.navigate('today')
        self.assertEqual(self.page.locator('#clockOut').input_value(), '19:10')
        self.assertEqual(self.page.locator('#destination').input_value(), 'KLIA Cargo')
        self.assertEqual(self.page.locator('#airwayBill').input_value(), 'UNSAVED-REDESIGN')
        self.assertTrue(self.page.locator('input[name=sideJob][value=susun]').is_checked())
        self.assertEqual(self.page.evaluate('dailyRecords'), {})

    def test_all_views_fit_small_phone_tablet_and_desktop_in_both_themes(self):
        self.seed_record(side=True)
        for width in [320, 390, 768, 1440]:
            self.page.set_viewport_size({'width': width, 'height': 900})
            for dark in [False, True]:
                actual = self.page.locator('body').evaluate('el=>el.classList.contains("dark")')
                if actual != dark:
                    self.page.locator('#darkModeBtn').click()
                for name in ['today', 'records', 'salary', 'settings']:
                    self.navigate(name)
                    measurements = self.page.evaluate('''()=>({
                      viewport:innerWidth,width:document.documentElement.scrollWidth,
                      active:document.querySelector('.app-view:not([hidden])').id
                    })''')
                    self.assertLessEqual(measurements['width'], measurements['viewport'] + 1,
                                         {'width': width, 'dark': dark, 'measurements': measurements})

    def test_record_edit_opens_attendance_view_with_existing_values(self):
        self.seed_record()
        before = self.page.evaluate('JSON.stringify(dailyRecords)')
        self.navigate('records')
        self.page.locator('#mobileCards .mc-actions button').first.click()
        self.page.locator('#view-today').wait_for(state='visible')
        self.assertEqual(self.page.locator('#date').input_value(), '2026-10-19')
        self.assertEqual(self.page.locator('#clockIn').input_value(), '08:00')
        self.assertEqual(self.page.locator('#clockOut').input_value(), '19:00')
        self.assertEqual(self.page.evaluate('JSON.stringify(dailyRecords)'), before)

    def test_holiday_shortcut_opens_its_settings_panel(self):
        self.page.locator('#menuToggleBtn').click()
        self.page.locator('#holidayPickerBtn').click()
        self.assertTrue(self.page.locator('#view-settings').is_visible())
        self.assertTrue(self.page.locator('#holidayPickerPanel').is_visible())

    def test_side_job_controls_have_compact_radios_and_large_touch_labels(self):
        self.page.locator('#destination').select_option(label='KLIA Cargo')
        radios = self.page.locator('input[name=sideJob]').evaluate_all('''elements=>elements.map(el=>{
          const b=el.getBoundingClientRect(),label=el.closest('label').getBoundingClientRect();
          return {width:b.width,height:b.height,labelWidth:label.width,labelHeight:label.height};
        })''')
        self.assertEqual(len(radios), 3)
        for radio in radios:
            self.assertGreater(radio['width'], 0, radio)
            self.assertLessEqual(radio['width'], 24, radio)
            self.assertLessEqual(radio['height'], 24, radio)
            self.assertGreaterEqual(radio['labelWidth'], 44, radio)
            self.assertGreaterEqual(radio['labelHeight'], 44, radio)

    def test_search_and_type_filters_leave_data_and_totals_unchanged(self):
        self.seed_record(side=True)
        self.seed_record(date='2026-10-20')
        self.navigate('records')
        before = self.page.evaluate('JSON.stringify(dailyRecords)')
        total = self.page.locator('#totalOT').text_content()
        self.page.locator('#recordSearch').fill('TEST-AWB')
        self.assertEqual(self.page.locator('#mobileCards .mc-card:visible').count(), 1)
        self.assertIn('TEST-AWB', self.page.locator('#mobileCards .mc-card:visible').text_content())
        self.page.locator('#recordSearch').fill('')
        self.page.locator('[data-filter=klia]').click()
        self.assertEqual(self.page.locator('#mobileCards .mc-card:visible').count(), 1)
        self.page.locator('[data-filter=leave]').click()
        self.assertEqual(self.page.locator('#mobileCards .mc-card:visible').count(), 0)
        self.assertTrue(self.page.locator('#noFilteredRecords').is_visible())
        self.page.locator('#clearFiltersBtn').click()
        self.assertEqual(self.page.locator('#mobileCards .mc-card:visible').count(), 2)
        self.assertEqual(self.page.locator('#totalOT').text_content(), total)
        self.assertEqual(self.page.evaluate('JSON.stringify(dailyRecords)'), before)
        self.page.set_viewport_size({'width':1440,'height':900})
        self.page.locator('#recordSearch').fill('TEST-AWB')
        self.assertEqual(self.page.locator('#reportTable tbody tr[data-date]:visible').count(), 1)
        self.assertEqual(self.page.evaluate('JSON.stringify(dailyRecords)'), before)

    def test_pdf_restores_full_document_from_other_views_and_filtered_records(self):
        self.seed_record(side=True)
        self.seed_record(date='2026-10-20')
        self.navigate('records')
        self.page.locator('#recordSearch').fill('TEST-AWB')
        self.page.evaluate("""()=>{
          const load=window.loadPdfLib;
          window.loadPdfLib=async()=>{
            await load();
            if(window.__layoutCaptureInstalled)return;
            window.__layoutCaptureInstalled=true;
            const real=window.html2pdf;
            window.html2pdf=function(){
              window.__pdfCapture={records:getComputedStyle(document.querySelector('#view-records')).display,
                meta:getComputedStyle(document.querySelector('.header-info')).display,
                supervisor:document.querySelector('#printSupervisorName').textContent,
                month:document.querySelector('#currentMonth').textContent,
                rows:[...document.querySelectorAll('#reportTable tbody tr[data-date]')].map(el=>({display:getComputedStyle(el).display,text:el.textContent}))};
              return real.apply(this,arguments);
            };
          };
        }""")
        for name in ['today','settings']:
            self.navigate(name)
            self.assertTrue(self.page.locator('#view-records').get_attribute('hidden') is not None)
            with self.page.expect_download(timeout=45000) as result:
                self.page.evaluate("void RezaOT_print.exportPdf('portrait')")
            target = Path(self.temp.name) / (name+'.pdf')
            result.value.save_as(target)
            self.page.wait_for_function('!window.__pdfBusy')
            self.assertTrue(target.read_bytes().startswith(b'%PDF-'))
            self.assertGreater(target.stat().st_size,10000)
            capture=self.page.evaluate('__pdfCapture')
            self.assertNotEqual(capture['records'],'none')
            self.assertNotEqual(capture['meta'],'none')
            self.assertEqual(capture['month'],'Oktober 2026')
            self.assertEqual(capture['supervisor'],'Talib')
            self.assertEqual(len(capture['rows']),2)
            self.assertTrue(all(row['display']=='table-row' for row in capture['rows']),capture)
            self.assertTrue(any('REVIEW-TRIP' in row['text'] for row in capture['rows']))
            self.assertTrue(self.page.locator('#view-'+name).is_visible())
            self.assertFalse(self.page.locator('#view-records').is_visible())
        self.navigate('records')
        self.assertEqual(self.page.locator('#mobileCards .mc-card:visible').count(),1)

    def test_optional_cloud_account_controls_stay_in_settings(self):
        self.page.evaluate("""async()=>{
          REZAOT_CONFIG.requireAuth=true;
          const auth={currentUser:null,onAuthStateChanged(callback){callback(null);return()=>{};}};
          firebase.auth=()=>auth;window.loadAuthLib=()=>Promise.resolve();
          await RezaOT_auth.init();
        }""")
        self.assertEqual(self.page.locator('#cloudAccountSlot #cloudAuthPanel').count(),1)
        self.assertFalse(self.page.locator('#cloudAuthPanel').is_visible())
        self.navigate('settings')
        self.assertTrue(self.page.locator('#cloudAuthForm').is_visible())
        self.navigate('records')
        self.assertFalse(self.page.locator('#cloudAuthPanel').is_visible())

    def test_header_menu_items_are_readable_full_width_touch_rows(self):
        self.page.locator('#menuToggleBtn').click()
        self.page.locator('#menuPanel').wait_for(state='visible')
        rows = self.page.locator('#menuPanel button').evaluate_all('''elements=>elements.map(el=>{
          const b=el.getBoundingClientRect();
          return {text:el.textContent,width:b.width,height:b.height,scrollWidth:el.scrollWidth};
        })''')
        self.assertGreaterEqual(len(rows), 3)
        for row in rows:
            self.assertGreaterEqual(row['height'], 44, row)
            self.assertGreaterEqual(row['width'], 140, row)
            self.assertLessEqual(row['scrollWidth'], row['width'] + 1, row)
        self.page.keyboard.press('Escape')
        self.assertFalse(self.page.locator('#menuPanel').is_visible())
        self.assertEqual(self.page.locator(':focus').get_attribute('id'), 'menuToggleBtn')


if __name__ == '__main__':
    unittest.main(verbosity=2)
