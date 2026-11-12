"""Local fake-cloud checks for v75. No production database calls."""
import unittest,json
import integration_browser as integration

class ImprovementTests(integration.AppBrowserFixture):
    def nav(self,view):
        self.page.locator('.app-nav-link[data-view="'+view+'"]:visible').first.click()
    def test_favorite_repeat_and_guarded_undo(self):
        self.seed_record(side=True)
        self.page.locator('#destination').select_option(label='MBG Selayang')
        self.page.get_by_role('button',name='Simpan destinasi kegemaran',exact=True).click()
        self.assertIn('MBG Selayang',self.page.locator('#favoriteTrips').inner_text())
        self.page.get_by_role('button',name='Ulang trip terakhir',exact=True).click()
        self.assertEqual(self.page.locator('#airwayBill').input_value(),'TEST-AWB')
        self.nav('records')
        self.page.evaluate("window.rezaotConfirm=()=>Promise.resolve(true)")
        self.page.evaluate("deleteTrip('2026-10-19',0)")
        self.page.get_by_role('button',name='Batal padam',exact=True).click()
        self.assertEqual(self.page.evaluate("dailyRecords['2026-10-19'].tripDetails[0].awb"),'TEST-AWB')
        self.page.evaluate("deleteTrip('2026-10-19',0)")
        self.page.evaluate("dailyRecords['2026-10-19'].clock_out='23:00'")
        self.page.get_by_role('button',name='Batal padam',exact=True).click()
        self.assertEqual(self.page.evaluate("dailyRecords['2026-10-19'].tripDetails.length"),0)
    def test_payslip_and_backup_and_income_export(self):
        self.nav('salary')
        self.page.locator('#actualSalaryNet').fill('3200')
        self.page.locator('#actualSideReceived').fill('100')
        self.page.get_by_role('button',name='Simpan semakan slip',exact=True).click()
        data=self.page.evaluate('RezaOT_backup.create()')
        self.assertEqual(data['settings']['rezaot_payroll']['2026-11']['net'],3200)
        with self.page.expect_download() as download:
            self.page.get_by_role('button',name='Eksport ringkasan ke RezaDrive',exact=True).click()
        value=json.loads(open(download.value.path()).read())
        self.assertEqual(value['source'],'RezaOT');self.assertEqual(value['month'],'2026-11');self.assertEqual(value['amount'],3300);self.assertEqual(value['basis'],'received')
        for width in [320,390,1440]:
            self.page.set_viewport_size({'width':width,'height':900})
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width+1)
    def test_summary_import_and_reimport_replace(self):
        self.nav('salary')
        self.page.locator('#actualSalaryNet').fill('3200');self.page.get_by_role('button',name='Simpan semakan slip',exact=True).click()
        self.page.evaluate('window.rezaotConfirm=()=>Promise.resolve(true)')
        value={'app':'RezaIncome','schemaVersion':1,'source':'RezaDrive','month':'2026-11','basis':'before-fuel','amount':100,'exportedAt':'2026-11-01T00:00:00Z'}
        for amount in [100,120]:
            value['amount']=amount
            self.page.locator('#payrollReview input[type=file]').set_input_files({'name':'income.json','mimeType':'application/json','buffer':json.dumps(value).encode()})
            self.page.wait_for_function('JSON.parse(localStorage.getItem("rezaot_income"))["2026-11"].amount === '+str(amount))
        self.assertIn('RM 3320.00',self.page.locator('.combined-total').inner_text())
        self.assertEqual(len(self.page.evaluate('JSON.parse(localStorage.getItem("rezaot_income"))')),1)

if __name__=='__main__':unittest.main(verbosity=2)
