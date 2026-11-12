"""Pinned-owner authentication against an isolated fake cloud; no live requests."""
import unittest,json
import integration_browser as integration
class OwnerAccessTests(integration.AppBrowserFixture):
    def before_open_app(self):
        self.page.route('**/cloud-config.js*',lambda route:route.fulfill(content_type='application/javascript',body='window.REZAOT_CONFIG={requireAuth:true,requireOwnerClaim:false,legacyOwnerUid:"test-pinned-owner"};'))
    def login(self,uid='test-pinned-owner'):
        self.page.evaluate('(uid)=>window.__setAuthUser({uid,email:"test@example.test",ownerClaim:false})',uid)
    def approve(self):
        self.page.evaluate('window.rezaotConfirm=()=>Promise.resolve(true)')
        self.page.evaluate('RezaOT_auth.approveLocalData()')
        self.page.wait_for_function('RezaOT_auth.canSync()')
    def test_no_cloud_access_before_login_or_for_other_uid(self):
        self.assertIsNone(self.page.evaluate('getFirebaseRoot()'))
        self.assertEqual(self.page.evaluate('__cloudWrites.length'),0)
        self.login('wrong-owner')
        self.assertFalse(self.page.evaluate('RezaOT_auth.canSync()'))
        self.assertFalse(self.page.evaluate('RezaOT_auth.approveLocalData()'))
        self.assertIsNone(self.page.evaluate('getFirebaseRoot()'))
        self.assertEqual(self.page.evaluate('__cloudWrites.length'),0)
        self.login();self.approve()
        self.assertEqual(self.page.evaluate('getFirebaseRoot()'),'users/default')
    def test_signed_out_changes_flush_only_after_owner_approval_to_same_path(self):
        self.page.locator('#date').fill('2026-10-19');self.page.locator('#clockIn').fill('08:00');self.page.locator('#clockOut').fill('19:00')
        self.page.locator('#clockForm button[type=submit]').click()
        self.assertEqual(self.page.evaluate('__cloudWrites.length'),0)
        self.assertGreater(self.page.evaluate('JSON.parse(localStorage.getItem("rezaot_local_dirty")||"[]").length'),0)
        self.login();self.approve()
        self.page.wait_for_function('window.__cloudData["users/default/Oktober 2026"]?.dailyRecords?.["2026-10-19"]?.clock_out === "19:00"')
        self.assertFalse(self.page.evaluate('__cloudWrites.some(w=>w.path.startsWith("users/test-pinned-owner"))'))
        self.page.evaluate('RezaOT_auth.signOut()')
        self.assertIsNone(self.page.evaluate('getFirebaseRoot()'))
        self.page.locator('#date').fill('2026-10-20');self.page.locator('#clockForm button[type=submit]').click()
        self.login();self.page.wait_for_function('getFirebaseRoot()==="users/default"')
        self.page.wait_for_function('window.__cloudData["users/default/Oktober 2026"]?.dailyRecords?.["2026-10-20"]?.clock_out === "19:00"')
    def test_existing_cloud_history_is_read_without_repath_or_import(self):
        self.page.evaluate('window.__seedCloud("users/default/Oktober 2026",{dailyRecords:{"2026-10-19":{clock_in:"08:00",clock_out:"18:00",trips:["Existing trip"]}},trips:["Existing trip"],revision:"existing"})')
        self.login();self.approve()
        self.page.wait_for_function('dailyRecords["2026-10-19"]?.clock_out==="18:00"')
        self.assertEqual(self.page.evaluate('dailyRecords["2026-10-19"].trips[0]'),'Existing trip')
        self.assertFalse(self.page.evaluate('__cloudWrites.some(w=>w.path.startsWith("users/test-pinned-owner"))'))
if __name__=='__main__':unittest.main(verbosity=2)
