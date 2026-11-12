"""Owner sharing + anonymous viewer regressions, isolated from production."""
import json, re, subprocess, time, unittest
import integration_browser as integration
import owner_access_browser as owner_access

class HRShareTests(integration.AppBrowserFixture):
    before_open_app = owner_access.OwnerAccessTests.before_open_app
    login = owner_access.OwnerAccessTests.login
    approve = owner_access.OwnerAccessTests.approve

    def owner_ready(self):
        self.login(); self.approve(); self.seed_record(side=True)
        self.page.evaluate('window.rezaotConfirm=()=>Promise.resolve(true)')

    def open_share(self):
        self.open_exports(); self.page.locator('#hrShareBtn').click()
        self.page.wait_for_function('document.querySelector("#hrSharePanel").getAttribute("aria-busy")==="false"')

    def create(self):
        self.open_share(); self.page.locator('#hrShareCreate').click()
        self.page.locator('#hrShareList input').wait_for()
        return self.page.locator('#hrShareList input').input_value().split('#')[1]

    def viewer(self, value, token='a'*64):
        page=self.new_page(self.context)
        state={'value':value,'status':200,'requests':[]}
        def route(req):
            state['requests'].append({'url':req.request.url,'method':req.request.method,'headers':req.request.headers})
            req.fulfill(status=state['status'],content_type='application/json',body=json.dumps(state['value']))
        page.route('https://reza-ot-default-rtdb.asia-southeast1.firebasedatabase.app/**',route)
        page.goto(self.origin+'/hr.html#'+token)
        return page,state

    def test_create_complete_snapshot_update_and_revoke(self):
        self.owner_ready(); self.seed_record(date='2026-10-20')
        self.navigate('records'); self.page.locator('#recordSearch').fill('No matching trip')
        token=self.create(); self.assertRegex(token,r'^[a-f0-9]{64}$')
        value=self.page.evaluate('(id)=>__cloudData["sharedReports/"+id]',token)
        report=json.loads(value['report']); self.assertEqual(len(report['rows']),2)
        self.assertIn('TEST-AWB',value['report']); self.assertNotIn('salary',value['report'])
        self.assertNotIn('Tindakan',value['report']); self.assertNotIn('button',value['report'])
        self.assertEqual(len(report['headings']),8); self.assertEqual(report['total'],'3.00')
        self.assertAlmostEqual((value['expiresAt']-value['updatedAt'])/86400000,30)
        self.page.evaluate('dailyRecords["2026-10-20"].clock_out="20:00";updateReport()')
        self.assertEqual(self.page.evaluate('(id)=>JSON.parse(__cloudData["sharedReports/"+id].report).total',token),'3.00')
        self.page.locator('#hrShareList button',has_text='Kemas kini').click()
        self.page.wait_for_function('(id)=>JSON.parse(__cloudData["sharedReports/"+id].report).total==="4.00"',arg=token)
        self.page.locator('#hrShareList button',has_text='Batalkan').click()
        self.page.wait_for_function('(id)=>__cloudData["sharedReports/"+id]===null',arg=token)
        self.assertIsNotNone(self.page.evaluate('__cloudData["users/default/Oktober 2026"]'))

    def test_sharing_requires_owner_and_failed_rules_create_no_link(self):
        self.seed_record();self.open_share();self.page.locator('#hrShareCreate').click()
        self.assertIn('Login',self.page.locator('#hrShareStatus').text_content())
        self.assertEqual(self.page.locator('#hrShareList input').count(),0)
        self.page.locator('#hrShareClose').click();self.owner_ready();self.open_share()
        self.page.evaluate('''()=>{const old=RezaOT_state.db.ref;RezaOT_state.db.ref=function(path){const r=old(path);if(!path)r.update=()=>Promise.reject(Object.assign(Error("Permission denied"),{code:"PERMISSION_DENIED"}));return r;}}''')
        self.page.locator('#hrShareCreate').click()
        self.page.wait_for_function('document.querySelector("#hrShareStatus").textContent.includes("Publish")')
        self.assertEqual(self.page.locator('#hrShareList input').count(),0)
        self.assertFalse(self.page.evaluate('__cloudWrites.some(w=>w.path==="sharedReports")'))

    def test_hr_viewer_has_only_get_access_no_auth_and_no_executable_markup(self):
        self.owner_ready(); token=self.create()
        value=self.page.evaluate('(id)=>__cloudData["sharedReports/"+id]',token)
        report=json.loads(value['report']); report['rows'][0][2]='<img src=x onerror="window.__xss=true">'; value['report']=json.dumps(report)
        viewer,state=self.viewer(value,token);viewer.locator('#sharedDocument').wait_for(state='visible')
        self.assertEqual(viewer.locator('input,textarea,[contenteditable],#reportTable button,#reportTable a').count(),0)
        self.assertEqual(viewer.locator('#reportTable img, #reportTable script').count(),0)
        self.assertIn('<img',viewer.locator('#reportTable tbody').text_content())
        self.assertIsNone(viewer.evaluate('window.firebase'));self.assertIsNone(viewer.evaluate('window.__xss'))
        self.assertTrue(all(r['method']=='GET' and '/sharedReports/'+token+'.json' in r['url'] for r in state['requests']))
        self.assertTrue(all('authorization' not in r['headers'] and 'referer' not in r['headers'] for r in state['requests']))
        viewer.locator('#viewerLanguage').click();self.assertEqual(viewer.locator('#readOnlyLabel').text_content(),'Read only')
        self.assertEqual(viewer.locator('body').evaluate('(n)=>n.scrollWidth>innerWidth'),False)
        viewer.screenshot(path='/tmp/rezaot-hr-mobile.png',full_page=True)

    def test_viewer_denial_expiry_and_revocation_clear_data_before_export(self):
        self.owner_ready();token=self.create();value=self.page.evaluate('(id)=>__cloudData["sharedReports/"+id]',token)
        viewer,state=self.viewer(value,token);viewer.locator('#sharedDocument').wait_for(state='visible')
        state['status']=401
        viewer.locator('#viewerPdf').click()
        viewer.wait_for_function('document.querySelector("#sharedDocument").hidden')
        self.assertEqual(viewer.locator('#reportTable tbody tr').count(),0)
        self.assertIn('luput',viewer.locator('#viewerStatus').text_content())
        state['status']=200;state['value']['expiresAt']=int(time.time()*1000)-1000
        viewer.reload();self.assertTrue(viewer.locator('#sharedDocument').is_hidden())
        self.assertEqual(viewer.locator('#reportTable tbody tr').count(),0)

    def test_viewer_exports_full_month_to_one_a4_page_both_orientations(self):
        self.owner_ready()
        for day in range(1,32):
            self.seed_record(date=f'2026-10-{day:02d}')
        token=self.create();value=self.page.evaluate('(id)=>__cloudData["sharedReports/"+id]',token)
        viewer,_=self.viewer(value,token);viewer.locator('#sharedDocument').wait_for(state='visible')
        self.assertEqual(viewer.locator('#reportTable tbody tr').count(),31)
        for orientation in ['portrait','landscape']:
            viewer.locator('#viewerOrientation').select_option(orientation)
            with viewer.expect_download() as result:viewer.locator('#viewerPdf').click()
            download=result.value;target=self.temp.name+'/'+orientation+'.pdf';download.save_as(target)
            info=subprocess.check_output(['pdfinfo',target],text=True)
            self.assertRegex(info,r'Pages:\s+1\b')
            match=re.search(r'Page size:\s+([\d.]+) x ([\d.]+)',info)
            w,h=map(float,match.groups());self.assertEqual(w>h,orientation=='landscape')
        viewer.set_viewport_size({'width':1280,'height':900});viewer.screenshot(path='/tmp/rezaot-hr-desktop.png',full_page=True)
        viewer.evaluate('window.print=()=>{window.__printed=document.querySelector("#rezaotPrintPage img").src.startsWith("data:image/png");window.dispatchEvent(new Event("afterprint"));}')
        viewer.locator('#viewerPrint').click();viewer.wait_for_function('window.__printed===true')

    def test_invalid_token_does_not_request_firebase(self):
        viewer,state=self.viewer(None,'guessable');viewer.wait_for_function('document.querySelector("#viewerStatus").textContent.includes("tidak sah")')
        self.assertEqual(state['requests'],[])

if __name__=='__main__':unittest.main(verbosity=2)
