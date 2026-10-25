"""Firebase recovery flows in the full app, using the isolated shared fake SDK.

Run: python3 tests/recovery_browser.py
No request, credential or database write leaves the local fixture server.
"""
import json
from pathlib import Path
import unittest

from integration_browser import AppBrowserFixture


class RecoveryBrowserTests(AppBrowserFixture):
    def before_open_app(self):
        self.context.add_init_script("""(()=>{
          window.REZAOT_CONFIG={requireAuth:true,requireOwnerClaim:true,
            firebaseConfig:{projectId:'demo-rezaot',apiKey:'test-only',
              databaseURL:'https://demo-rezaot-default-rtdb.firebaseio.com'}};
          localStorage.setItem('rezaot_auth_data_owner','owner-a');
        })();""")

    def sign_in(self):
        self.page.evaluate("async()=>{await RezaOT_auth.init();await __setAuthUser({uid:'owner-a',email:'owner@example.test'});}")
        self.page.wait_for_function('RezaOT_auth.canSync()')

    def conflict(self):
        self.page.evaluate("""async()=>{
          await RezaOT_auth.init();
          const date='2026-10-19';
          dailyRecords[date]=RezaOT_model.normalizeRecord({clock_in:'08:00',clock_out:'21:00',trips:['LOCAL-TRIP']},date);
          await RezaOT_sync.saveMonth();updateReport();
          __seedCloud('users/owner-a/Oktober 2026',{
            dailyRecords:{[date]:RezaOT_model.normalizeRecord({clock_in:'08:00',clock_out:'17:00',trips:['CLOUD-TRIP']},date)},
            trips:['CLOUD-TRIP'],revision:'other-device:1',deviceId:'other-device',lastUpdated:'2026-10-19T10:00:00.000Z'
          });
        }""")
        self.assertEqual(self.page.evaluate('RezaOT_sync.getDiagnostics().dirty'), 1)
        self.assertEqual(self.page.evaluate('getOfflineQueue().length'), 0)
        self.sign_in()
        self.page.wait_for_function('RezaOT_sync.getConflicts().length===1')

    def open_recovery(self):
        self.navigate('settings')
        self.page.locator('#manageRecoveryBtn').click()
        self.page.locator('#syncRecoveryPanel').wait_for(state='visible')

    def test_signed_out_edit_survives_login_and_conflict_requires_explicit_choice(self):
        self.conflict()
        self.assertEqual(self.page.evaluate("dailyRecords['2026-10-19'].clock_out"), '21:00')
        self.assertEqual(self.page.evaluate("JSON.parse(localStorage.getItem('dailyRecords_Oktober 2026'))['2026-10-19'].clock_out"), '21:00')
        self.assertEqual(self.page.evaluate("__cloudData['users/owner-a/Oktober 2026'].dailyRecords['2026-10-19'].clock_out"), '17:00')
        self.open_recovery()
        card = self.page.locator('#syncConflictList [data-conflict-id]')
        self.assertEqual(card.count(), 1)
        self.assertIn('21:00', card.text_content())
        self.assertIn('17:00', card.text_content())
        card.locator('[data-conflict-choice=local]').click()
        self.page.locator('#rezaotModalCancel').click()
        self.assertEqual(self.page.evaluate('RezaOT_sync.getConflicts().length'), 1)
        self.assertEqual(self.page.evaluate("__cloudData['users/owner-a/Oktober 2026'].dailyRecords['2026-10-19'].clock_out"), '17:00')
        card.locator('[data-conflict-choice=local]').click()
        self.page.locator('#rezaotModalOk').click()
        self.page.wait_for_function("RezaOT_sync.getConflicts().length===0&&getOfflineQueue().length===0")
        state = self.page.evaluate("""()=>({local:dailyRecords['2026-10-19'].clock_out,
          cloud:__cloudData['users/owner-a/Oktober 2026'].dailyRecords['2026-10-19'].clock_out,
          serverTime:__cloudData['users/owner-a/Oktober 2026'].lastUpdatedServer,
          indexed:__cloudData['users/owner-a/_meta/months/Oktober 2026'],
          recovery:RezaOT_storage.recoveryEntries().length})""")
        self.assertEqual(state['local'], '21:00')
        self.assertEqual(state['cloud'], '21:00')
        self.assertIsInstance(state['serverTime'], int)
        self.assertTrue(state['indexed'])
        self.assertGreater(state['recovery'], 0)
        self.assertIn('Tiada konflik aktif.', self.page.locator('#syncConflictList').text_content())

    def test_choosing_cloud_preserves_recovery_copy_and_updates_visible_records(self):
        self.conflict()
        self.open_recovery()
        self.page.locator('[data-conflict-choice=remote]').click()
        self.page.locator('#rezaotModalOk').click()
        self.page.wait_for_function('RezaOT_sync.getConflicts().length===0')
        self.assertEqual(self.page.evaluate("dailyRecords['2026-10-19'].clock_out"), '17:00')
        self.assertEqual(self.page.evaluate("dailyRecords['2026-10-19'].trips"), ['CLOUD-TRIP'])
        self.assertEqual(self.page.evaluate('getOfflineQueue().length'), 0)
        archives = self.page.evaluate('RezaOT_storage.recoveryEntries()')
        self.assertTrue(any('21:00' in json.dumps(entry) for entry in archives))

    def test_independent_dates_merge_after_login_without_discarding_either_device(self):
        self.page.evaluate("""async()=>{
          await RezaOT_auth.init();
          const localDate='2026-10-19',remoteDate='2026-10-20';
          dailyRecords[localDate]=RezaOT_model.normalizeRecord({clock_in:'08:00',clock_out:'21:00',trips:['LOCAL-TRIP']},localDate);
          await RezaOT_sync.saveMonth();
          __seedCloud('users/owner-a/Oktober 2026',{dailyRecords:{[remoteDate]:RezaOT_model.normalizeRecord({clock_in:'08:00',clock_out:'18:00',trips:['REMOTE-TRIP']},remoteDate)},trips:['REMOTE-TRIP']});
        }""")
        self.sign_in()
        self.page.wait_for_function("getOfflineQueue().length===0&&!!dailyRecords['2026-10-20']")
        self.assertEqual(self.page.evaluate('RezaOT_sync.getConflicts().length'), 0)
        self.assertEqual(self.page.evaluate("dailyRecords['2026-10-19'].clock_out"), '21:00')
        self.assertEqual(self.page.evaluate("dailyRecords['2026-10-20'].trips"), ['REMOTE-TRIP'])
        self.assertEqual(self.page.evaluate("Object.keys(__cloudData['users/owner-a/Oktober 2026'].dailyRecords).sort()"), ['2026-10-19', '2026-10-20'])

    def test_authenticated_conflict_panel_and_header_fit_320px_in_both_themes_and_languages(self):
        self.page.set_viewport_size({'width': 320, 'height': 844})
        self.conflict()
        self.open_recovery()
        for language in ('ms', 'en'):
            if language == 'en':
                self.page.locator('#langToggleBtn').click()
            for theme in ('light', 'dark'):
                with self.subTest(language=language, theme=theme):
                    self.page.evaluate('(theme)=>RezaOT_theme.setPreference(theme)', theme)
                    self.page.wait_for_function('(theme)=>RezaOT_theme.getResolvedTheme()===theme', arg=theme)
                    dimensions = self.page.evaluate("""()=>({
                      viewport:innerWidth,document:document.documentElement.scrollWidth,
                      status:document.querySelector('#syncStatus').textContent,
                      statusRole:document.querySelector('#syncStatus').getAttribute('role'),
                      actions:[...document.querySelectorAll('.app-topbar .icon-btn,#cloudRefreshAccess,#cloudSignOut,#syncConflictList [data-conflict-choice]')].filter(button=>button.getClientRects().length).map(button=>{
                        const rect=button.getBoundingClientRect();
                        return {id:button.id||button.dataset.conflictChoice,left:rect.left,right:rect.right};
                      })
                    })""")
                    self.assertLessEqual(dimensions['document'], dimensions['viewport'])
                    self.assertEqual(dimensions['statusRole'], 'status')
                    self.assertIn('Conflic' if language == 'en' else 'Konflik', dimensions['status'])
                    self.assertTrue(self.page.locator('#cloudAuthPanel').is_visible())
                    self.assertEqual(self.page.locator('#syncConflictList [data-conflict-id]').count(), 1)
                    for action in dimensions['actions']:
                        self.assertGreaterEqual(action['left'], 0, action)
                        self.assertLessEqual(action['right'], dimensions['viewport'], action)

    def test_different_account_cannot_rebind_or_upload_signed_out_owner_changes(self):
        self.page.evaluate("""async()=>{
          await RezaOT_auth.init();
          const date='2026-10-19';
          dailyRecords[date]=RezaOT_model.normalizeRecord({clock_in:'08:00',clock_out:'21:00',trips:['OWNER-A-TRIP']},date);
          await RezaOT_sync.saveMonth();
          __seedCloud('users/owner-b/Oktober 2026',{dailyRecords:{[date]:RezaOT_model.normalizeRecord({clock_in:'08:00',clock_out:'17:00',trips:['OWNER-B-TRIP']},date)}});
          await __setAuthUser({uid:'owner-b',email:'other@example.test'});
        }""")
        self.assertFalse(self.page.evaluate('RezaOT_auth.canSync()'))
        self.assertEqual(self.page.evaluate('getFirebaseRoot()'), None)
        self.assertEqual(self.page.evaluate("localStorage.getItem('rezaot_auth_data_owner')"), 'owner-a')
        self.assertEqual(self.page.evaluate("dailyRecords['2026-10-19'].clock_out"), '21:00')
        self.assertEqual(self.page.evaluate('__cloudWrites.length'), 0)
        self.assertEqual(self.page.evaluate('RezaOT_sync.getDiagnostics().dirty'), 1)
        self.navigate('settings')
        self.assertTrue(self.page.locator('#cloudApproveSync').is_disabled())
        self.assertIn('akaun lain', self.page.locator('#cloudAuthStatus').text_content())

    def test_recovery_preview_is_text_and_download_contains_the_preserved_data(self):
        entry = self.page.evaluate("""()=>{
          const data={note:'<img src=x onerror="window.__unsafeRecovery=true">',clock_out:'21:00'};
          const key=RezaOT_storage.archive('manual-review',data);
          return {key,data};
        }""")
        self.open_recovery()
        card = self.page.locator('[data-recovery-key="' + entry['key'] + '"]')
        card.locator('summary').click()
        self.assertEqual(card.locator('img').count(), 0)
        self.assertEqual(json.loads(card.locator('pre').text_content()), entry['data'])
        self.assertFalse(self.page.evaluate('!!window.__unsafeRecovery'))
        with self.page.expect_download() as result:
            card.get_by_role('button', name='Muat turun salinan', exact=True).click()
        download = result.value
        target = Path(self.temp.name) / download.suggested_filename
        download.save_as(target)
        payload = json.loads(target.read_text())
        self.assertEqual(payload['kind'], 'rezaot-recovery')
        self.assertEqual(payload['entries'][0]['key'], entry['key'])
        self.assertEqual(payload['entries'][0]['value']['data'], entry['data'])
        self.assertEqual(self.page.evaluate('(key)=>localStorage.getItem(key)!==null', entry['key']), True)

    def test_removing_archive_requires_confirmation_and_preserves_active_records(self):
        self.seed_record()
        keys = self.page.evaluate("""()=>({first:RezaOT_storage.archive('first-copy',{value:1}),
          second:RezaOT_storage.archive('second-copy',{value:2})})""")
        before = self.page.evaluate("localStorage.getItem('dailyRecords_Oktober 2026')")
        self.open_recovery()
        card = self.page.locator('[data-recovery-key="' + keys['first'] + '"]')
        card.get_by_role('button', name='Buang salinan lama', exact=True).click()
        self.page.locator('#rezaotModalCancel').click()
        self.assertTrue(self.page.evaluate('(key)=>localStorage.getItem(key)!==null', keys['first']))
        card.get_by_role('button', name='Buang salinan lama', exact=True).click()
        self.page.locator('#rezaotModalOk').click()
        self.page.wait_for_function('(key)=>localStorage.getItem(key)===null', arg=keys['first'])
        self.assertTrue(self.page.evaluate('(key)=>localStorage.getItem(key)!==null', keys['second']))
        self.assertEqual(self.page.evaluate("localStorage.getItem('dailyRecords_Oktober 2026')"), before)
        self.assertEqual(card.count(), 0)

    def test_diagnostics_track_actual_connection_and_close_returns_focus(self):
        self.sign_in()
        self.page.wait_for_function('RezaOT_sync.getDiagnostics().connected')
        self.open_recovery()
        self.assertIn('Cloud tersambung', self.page.locator('#syncDiagnostics').text_content())
        self.page.evaluate('__setCloudConnected(false)')
        self.page.wait_for_function('!RezaOT_sync.getDiagnostics().connected')
        self.assertIn('Cloud belum tersambung', self.page.locator('#syncDiagnostics').text_content())
        self.page.evaluate('__setCloudConnected(true)')
        self.page.locator('#syncReconnectBtn').click()
        self.page.wait_for_function('RezaOT_sync.getDiagnostics().connected')
        self.page.locator('#syncRecoveryClose').click()
        self.assertTrue(self.page.locator('#syncRecoveryPanel').is_hidden())
        self.assertEqual(self.page.locator('#manageRecoveryBtn').get_attribute('aria-expanded'), 'false')
        self.assertTrue(self.page.locator('#manageRecoveryBtn').evaluate('button=>document.activeElement===button'))


class UnavailableAppCheckBrowserTests(AppBrowserFixture):
    def before_open_app(self):
        self.context.add_init_script("""window.REZAOT_CONFIG={requireAuth:false,
          firebaseConfig:{projectId:'demo-rezaot',apiKey:'test-only',
            databaseURL:'https://demo-rezaot-default-rtdb.firebaseio.com'},
          appCheck:{enabled:true,siteKey:'test-only-public-site-key'}};""")
        self.page.route('**/vendor/firebase-app-check-compat.js*', lambda request: request.abort())

    def test_optional_app_check_failure_preserves_local_startup_and_blocks_cloud(self):
        self.seed_record()
        self.assertEqual(self.page.locator('body').get_attribute('data-startup'), 'ready')
        self.assertEqual(self.page.evaluate("dailyRecords['2026-10-19'].trips"), ['REVIEW-TRIP'])
        self.assertEqual(self.page.evaluate("JSON.parse(localStorage.getItem('dailyRecords_Oktober 2026'))['2026-10-19'].clock_out"), '19:00')
        self.assertEqual(self.page.evaluate('__cloudWrites.length'), 0)
        self.assertEqual(self.page.evaluate('window.__rezaotSyncState'), 'unavailable')
        self.assertGreater(self.page.evaluate('getOfflineQueue().length'), 0)
        self.assertFalse(self.page.evaluate('RezaOT_sync.isReady()'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
