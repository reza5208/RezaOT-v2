"""System theme regressions against the complete app and a local fake Firebase.

Run: python3 tests/theme_browser.py
No request or database write can reach the owner's live Firebase project.
"""
import unittest
import integration_browser as integration


class ThemeBrowserTests(unittest.TestCase):
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

    def settings(self):
        self.page.locator('.app-nav-link[data-view="settings"]:visible').first.click()
        self.page.locator('#themePreference').wait_for(state='visible')

    def assert_theme(self, resolved, preference=None, page=None):
        page = page or self.page
        page.wait_for_function(
            '(dark)=>document.body.classList.contains("dark")===dark',
            arg=resolved == 'dark')
        self.assertEqual(page.evaluate('RezaOT_theme.getResolvedTheme()'), resolved)
        self.assertEqual(page.locator('html').evaluate('el=>getComputedStyle(el).colorScheme'), resolved)
        expected = '#101828' if resolved == 'dark' else '#3157e5'
        self.assertEqual(page.locator('meta[name="theme-color"]').get_attribute('content'), expected)
        if preference:
            self.assertEqual(page.evaluate('RezaOT_theme.getPreference()'), preference)
            self.assertEqual(page.locator('#themePreference').input_value(), preference)

    def test_new_device_follows_system_at_startup_and_when_system_changes(self):
        self.page.emulate_media(color_scheme='dark')
        self.open_app(self.page)
        self.assert_theme('dark', 'system')
        before = self.page.evaluate('({records:JSON.stringify(dailyRecords),writes:JSON.stringify(__cloudWrites)})')
        self.page.emulate_media(color_scheme='light')
        self.assert_theme('light', 'system')
        self.page.emulate_media(color_scheme='dark')
        self.assert_theme('dark', 'system')
        after = self.page.evaluate('({records:JSON.stringify(dailyRecords),writes:JSON.stringify(__cloudWrites)})')
        self.assertEqual(after, before, 'System theme changes must not alter payroll records or cloud data')

    def test_manual_override_survives_reload_and_can_return_to_system(self):
        self.page.emulate_media(color_scheme='dark')
        self.settings()
        self.page.locator('#themePreference').select_option('light')
        self.assert_theme('light', 'light')
        self.page.emulate_media(color_scheme='light')
        self.page.emulate_media(color_scheme='dark')
        self.assert_theme('light', 'light')
        self.open_app(self.page)
        self.assert_theme('light', 'light')
        self.settings()
        self.page.locator('#themePreference').select_option('dark')
        self.page.emulate_media(color_scheme='light')
        self.assert_theme('dark', 'dark')
        self.page.locator('#themePreference').select_option('system')
        self.assert_theme('light', 'system')
        self.page.emulate_media(color_scheme='dark')
        self.assert_theme('dark', 'system')
        self.assertEqual(self.page.evaluate('localStorage.getItem("darkMode")'), 'system')
        # The existing header remains a quick manual override, not a lost route
        # back to system mode: the Settings selector remains available.
        self.page.locator('#darkModeBtn').click()
        self.assert_theme('light', 'light')
        self.page.locator('#settingsThemeBtn').click()
        self.assertEqual(self.page.locator(':focus').get_attribute('id'), 'themePreference')

    def test_legacy_light_and_dark_choices_remain_manual_after_upgrade(self):
        for stored, resolved, opposite in [('0', 'light', 'dark'), ('1', 'dark', 'light')]:
            with self.subTest(stored=stored):
                self.page.evaluate('(value)=>localStorage.setItem("darkMode",value)', stored)
                self.page.emulate_media(color_scheme=opposite)
                self.open_app(self.page)
                self.assert_theme(resolved, resolved)
                self.assertEqual(self.page.evaluate('localStorage.getItem("darkMode")'), stored)
                self.page.emulate_media(color_scheme=resolved)
                self.page.emulate_media(color_scheme=opposite)
                self.assert_theme(resolved, resolved)

    def test_shared_preference_updates_other_tabs_but_system_is_resolved_locally(self):
        self.page.emulate_media(color_scheme='light')
        other = self.new_page(self.context)
        other.emulate_media(color_scheme='dark')
        self.open_app(other)
        self.assert_theme('light', 'system')
        self.assert_theme('dark', 'system', other)
        before = self.page.evaluate('({records:JSON.stringify(dailyRecords),writes:JSON.stringify(__cloudWrites)})')
        self.settings()
        self.page.locator('#themePreference').select_option('dark')
        self.assert_theme('dark', 'dark')
        self.assert_theme('dark', 'dark', other)
        self.page.locator('#themePreference').select_option('system')
        self.assert_theme('light', 'system')
        self.assert_theme('dark', 'system', other)
        after = self.page.evaluate('({records:JSON.stringify(dailyRecords),writes:JSON.stringify(__cloudWrites)})')
        self.assertEqual(after, before, 'Sharing a theme preference must not write records or cloud settings')
        other.close()

    def test_backup_roundtrip_restores_system_theme_without_changing_records(self):
        self.seed_record()
        self.page.evaluate('RezaOT_sync.flush()')
        self.page.emulate_media(color_scheme='dark')
        self.settings()
        self.page.locator('#themePreference').select_option('system')
        backup = self.page.evaluate('RezaOT_backup.create()')
        self.assertEqual(backup['settings']['darkMode'], 'system')
        self.page.locator('#themePreference').select_option('light')
        self.assert_theme('light', 'light')
        before = self.page.evaluate('({records:JSON.stringify(dailyRecords),writes:JSON.stringify(__cloudWrites)})')
        self.page.evaluate('''async (theme)=>{
          RezaOT_backup.apply({schemaVersion:2,months:{},settings:{darkMode:theme}},'merge');
          await RezaOT_sync.flush();
        }''', backup['settings']['darkMode'])
        self.assert_theme('dark', 'system')
        after = self.page.evaluate('({records:JSON.stringify(dailyRecords),writes:JSON.stringify(__cloudWrites)})')
        self.assertEqual(after, before, 'Importing only the theme must leave records and cloud data unchanged')
        self.page.emulate_media(color_scheme='light')
        self.assert_theme('light', 'system')


if __name__ == '__main__':
    unittest.main(verbosity=2)
