"""PDF content regressions using a local fake Firebase and the real PDF renderer.

Run: python3 tests/pdf_report_browser.py
Exercises complete monthly reports with the real canvas/PDF renderer. Both
orientations must keep every record, total and footer on one A4 page.
"""
from pathlib import Path
import shutil
import re
import subprocess
import unittest
import integration_browser as integration


class PdfReportBrowserTests(unittest.TestCase):
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

    def prepare_report(self):
        self.page.evaluate('''()=>{
          dailyRecords={};
          const sample={
            1:['KLIA Cargo (232-10000001) #'], 3:[],
            5:['Hospital Serdang','MBG IOI Putrajaya','MBG DPulze','KLIA Cargo (160-10000005) #'],
            6:['MBG Setapak Sentral','MBG DPulze','KLIA Cargo (235-10000006) #'],
            7:[],8:[],16:['KLIA Cargo (157-10000016) #','KLIA Cargo (232-20000016) #'],
            17:[],22:['KLIA Cargo (232-10000022) #'],
            23:['Hospital Serdang','MBG IOI Putrajaya','MBG DPulze','FINAL-TRIP-KLIA2']
          };
          for(const [day,trips] of Object.entries(sample)){
            const date='2026-10-'+day.padStart(2,'0');
            dailyRecords[date]=RezaOT_model.normalizeRecord({clock_in:day==='1'?'06:00':'08:00',clock_out:day==='1'?'15:00':'17:00',trips},date);
          }
          saveToLocalStorage();updateReport();
          if(RezaOT_i18n.getLang()!=='en')document.querySelector('#langToggleBtn').click();
          RezaOT_dashboard.navigate('records');
        }''')
        self.page.locator('#recordSearch').fill('232-10000022')
        self.page.evaluate('''async()=>{
          await loadPdfLib();
          const Worker=html2pdf.Worker, originalSet=Worker.prototype.set;
          const originalCanvas=Worker.prototype.toCanvas, originalPdf=Worker.prototype.toPdf;
          const nativeDraw=CanvasRenderingContext2D.prototype.drawImage;
          CanvasRenderingContext2D.prototype.drawImage=function(source,...args){
            if(source===window.__reportSourceCanvas){
              if(window.__failReportFit)throw new Error('Forced single-page fit failure');
              window.__reportFitDraw={args,canvas:this.canvas};
            }
            return nativeDraw.call(this,source,...args);
          };
          Worker.prototype.set=function(options){
            if(options && options.html2canvas){
              const opts=Object.assign({},options.html2canvas), priorClone=opts.onclone;
              opts.onclone=async function(doc,root){
                if(priorClone)await priorClone.apply(this,arguments);
                root=root || doc.querySelector('.html2pdf__container');
                const rect=el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,bottom:b.bottom};};
                const table=root.querySelector('#reportTable');
                const total=root.querySelector('.ot-total-row'),footer=root.querySelector('#printFooter');
                const datedRows=[...table.querySelectorAll('tr[data-date]')],lastRow=datedRows[datedRows.length-1];
                const day=table.querySelector('tr[data-date="2026-10-07"] td:nth-child(2)');
                const range=doc.createRange();range.selectNodeContents(day);
                window.__finalPdfLayout={root:rect(root),table:rect(table),total:rect(total),footer:rect(footer),
                  totalText:total.textContent,footerText:footer.textContent,
                  lastRow:rect(lastRow),lastText:lastRow.textContent,
                  tripCount:table.querySelectorAll('.trip-item').length,
                  rows:datedRows.map(el=>({date:el.dataset.date,display:doc.defaultView.getComputedStyle(el).display,...rect(el)})),
                  dayLines:range.getClientRects().length};
              };
              options=Object.assign({},options,{html2canvas:opts});
            }
            return originalSet.call(this,options);
          };
          Worker.prototype.toCanvas=function(){
            return originalCanvas.apply(this,arguments).then(function(){
              const report=window.__finalPdfLayout,canvas=this.prop.canvas;
              if(report){
                window.__reportSourceCanvas=canvas;
                window.__reportFitDraw=null;
                report.canvas={width:canvas.width,height:canvas.height};
                report.pageHeight=this.prop.pageSize.inner.px.height;
                const scale=canvas.width/report.root.width;
                report.sourceScale=scale;
                report.footerPixelBottom=(report.footer.bottom-report.root.y)*scale;
                report.totalPixelBottom=(report.total.bottom-report.root.y)*scale;
                report.lastPixelBottom=(report.lastRow.bottom-report.root.y)*scale;
                const x=Math.max(0,Math.floor((report.footer.x-report.root.x)*scale));
                const y=Math.max(0,Math.floor((report.footer.y-report.root.y)*scale));
                const width=Math.min(canvas.width-x,Math.ceil(report.footer.width*scale));
                const height=Math.min(canvas.height-y,Math.ceil(report.footer.height*scale));
                report.footerInk=0;
                if(width>0 && height>0){
                  const data=canvas.getContext('2d').getImageData(x,y,width,height).data;
                  for(let i=0;i<data.length;i+=4)if(data[i]<160 && data[i+1]<160 && data[i+2]<160 && data[i+3]>0)report.footerInk++;
                }
              }
            });
          };
          window.__captureFittedReport=function(canvas){
            const report=window.__finalPdfLayout,source=window.__reportSourceCanvas;
            if(report && canvas && source){
              const draw=window.__reportFitDraw;
              let mapping;
              if(canvas===source)mapping={sx:0,sy:0,sw:source.width,sh:source.height,dx:0,dy:0,dw:source.width,dh:source.height};
              else if(draw && draw.canvas===canvas){
                const a=draw.args;
                if(a.length===4)mapping={sx:0,sy:0,sw:source.width,sh:source.height,dx:a[0],dy:a[1],dw:a[2],dh:a[3]};
                else if(a.length===8)mapping={sx:a[0],sy:a[1],sw:a[2],sh:a[3],dx:a[4],dy:a[5],dw:a[6],dh:a[7]};
              }
              report.fitted={width:canvas.width,height:canvas.height,mapping};
              report.fittedFooterInk=0;
              if(mapping){
                const ratio=mapping.dw/source.width;
                const footer=report.footer,root=report.root,scale=report.sourceScale;
                const x=Math.max(0,Math.floor(mapping.dx+(footer.x-root.x)*scale*ratio));
                const y=Math.max(0,Math.floor(mapping.dy+(footer.y-root.y)*scale*ratio));
                const width=Math.min(canvas.width-x,Math.ceil(footer.width*scale*ratio));
                const height=Math.min(canvas.height-y,Math.ceil(footer.height*scale*ratio));
                if(width>0 && height>0){
                  const pixels=canvas.getContext('2d').getImageData(x,y,width,height).data;
                  for(let i=0;i<pixels.length;i+=4)if(pixels[i]<160 && pixels[i+1]<160 && pixels[i+2]<160 && pixels[i+3]>0)report.fittedFooterInk++;
                }
              }
            }
          };
          Worker.prototype.toPdf=function(){
            window.__captureFittedReport(this.prop.canvas);
            return originalPdf.apply(this,arguments);
          };
        }''')

    def assert_one_a4_page(self, target, orientation):
        if not shutil.which('pdfinfo'):
            return
        info=subprocess.check_output(['pdfinfo',str(target)],text=True)
        pages=int(next(line for line in info.splitlines() if line.startswith('Pages:')).split(':')[1])
        self.assertEqual(pages,1,'The complete monthly report must fit exactly one A4 page')
        match=re.search(r'Page size:\s+([\d.]+) x ([\d.]+) pts',info)
        self.assertIsNotNone(match,'The PDF must declare a physical A4 page')
        width,height=map(float,match.groups())
        expected=(841.89,595.28) if orientation=='landscape' else (595.28,841.89)
        self.assertAlmostEqual(width,expected[0],delta=1)
        self.assertAlmostEqual(height,expected[1],delta=1)

    def export_and_check(self, orientation, filename, expected_rows=10):
        before=self.page.evaluate('''()=>({records:JSON.stringify(dailyRecords),view:document.body.dataset.view,
          dark:document.body.classList.contains('dark'),query:document.querySelector('#recordSearch').value,
          clockOut:document.querySelector('#clockOut').value,scroll:scrollY})''')
        expected_trips=self.page.evaluate('Object.values(dailyRecords).reduce((n,r)=>n+r.trips.length,0)')
        with self.page.expect_download(timeout=60000) as result:
            self.page.evaluate('orientation=>void RezaOT_print.exportPdf(orientation)',orientation)
        target=Path(self.temp.name)/filename
        result.value.save_as(target)
        self.page.wait_for_function('!window.__pdfBusy')
        self.assertTrue(target.read_bytes().startswith(b'%PDF-'))
        self.assertGreater(target.stat().st_size,10000)
        self.assert_one_a4_page(target,orientation)
        layout=self.page.evaluate('window.__finalPdfLayout')
        self.assertIsNotNone(layout,'Capture must inspect the final html2canvas clone')
        self.assertEqual(len(layout['rows']),expected_rows,layout)
        self.assertEqual(layout['tripCount'],expected_trips,'Every trip must remain in the report')
        self.assertTrue(all(row['display']=='table-row' for row in layout['rows']),layout)
        self.assertIn('FINAL-TRIP-KLIA2',layout['lastText'])
        self.assertIn('TOTAL OT',layout['totalText'])
        self.assertIn('AWB',layout['footerText'])
        self.assertGreaterEqual(layout['footer']['y'],layout['table']['bottom']-1,
                                'The footer must follow the table without overlapping records')
        for marker in ['lastPixelBottom','totalPixelBottom','footerPixelBottom']:
            self.assertLessEqual(layout[marker],layout['canvas']['height']+2,(marker,layout))
        self.assertGreater(layout['footerInk'],20,'The footer must be painted in the exported canvas')
        self.assertEqual(layout['dayLines'],1,'Wednesday must remain on one line')
        fitted=layout.get('fitted')
        self.assertIsNotNone(fitted,'Inspect the canvas actually passed to PDF generation')
        mapping=fitted.get('mapping')
        self.assertIsNotNone(mapping,'The fitted page must contain the complete source canvas')
        self.assertEqual([mapping[k] for k in ['sx','sy','sw','sh']],
                         [0,0,layout['canvas']['width'],layout['canvas']['height']],
                         'Single-page fitting must not crop any source records')
        self.assertGreaterEqual(mapping['dx'],0)
        self.assertGreaterEqual(mapping['dy'],0)
        self.assertLessEqual(mapping['dx']+mapping['dw'],fitted['width']+1)
        self.assertLessEqual(mapping['dy']+mapping['dh'],fitted['height']+1)
        self.assertAlmostEqual(mapping['dw']/layout['canvas']['width'],
                               mapping['dh']/layout['canvas']['height'],places=5,
                               msg='The complete report must preserve its aspect ratio')
        self.assertLessEqual(fitted['height'],fitted['width']*layout['pageHeight']/layout['root']['width']+2,
                             'The fitted canvas must fit inside one A4 content area')
        self.assertGreater(layout['fittedFooterInk'],15,'Footer must remain painted after one-page fitting')
        after=self.page.evaluate('''()=>({records:JSON.stringify(dailyRecords),view:document.body.dataset.view,
          dark:document.body.classList.contains('dark'),query:document.querySelector('#recordSearch').value,
          clockOut:document.querySelector('#clockOut').value,scroll:scrollY})''')
        self.assertEqual(after,before,'Export must restore scroll, view, theme, filters and unsaved fields')
        self.assertFalse(self.page.locator('body').evaluate("el=>el.classList.contains('pdf-export')"))
        return layout

    def test_mobile_multitrip_report_keeps_last_row_total_and_footer(self):
        self.prepare_report()
        self.page.evaluate("RezaOT_dashboard.navigate('today')")
        self.page.locator('#clockOut').fill('19:35')
        self.page.evaluate('scrollTo(0,650)')
        self.export_and_check('portrait','portrait-multitrip.pdf')

    def test_dark_mobile_landscape_keeps_complete_report_and_screen_state(self):
        self.prepare_report()
        self.page.locator('#darkModeBtn').click()
        self.page.evaluate('scrollTo(0,150)')
        self.export_and_check('landscape','landscape-multitrip.pdf')

    def prepare_full_month(self, dense=False):
        self.prepare_report()
        self.page.evaluate('''(dense)=>{
          dailyRecords={};
          for(let day=1;day<=31;day++){
            const date='2026-10-'+String(day).padStart(2,'0');
            const trips=['Hospital Serdang','MBG IOI Putrajaya','MBG Setapak Sentral'];
            if(day%2)trips.push('KLIA Cargo (232-100000'+String(day).padStart(2,'0')+') #');
            if(dense){
              for(let trip=trips.length;trip<8;trip++)trips.push('KLIA Cargo (235-'+String(day).padStart(2,'0')+'98765'+trip+') #');
            }
            if(day===31)trips[trips.length-1]='FINAL-TRIP-KLIA2';
            dailyRecords[date]=RezaOT_model.normalizeRecord({clock_in:'08:00',clock_out:'19:00',trips},date);
          }
          saveToLocalStorage();updateReport();RezaOT_dashboard.navigate('today');
        }''',dense)

    def test_full_month_fits_one_a4_page_in_both_orientations(self):
        self.prepare_full_month()
        for orientation in ['portrait','landscape']:
            with self.subTest(orientation=orientation):
                self.export_and_check(orientation,orientation+'-full-month.pdf',expected_rows=31)

    def test_dense_month_keeps_all_eight_trips_per_day_on_one_a4(self):
        self.prepare_full_month(dense=True)
        self.assertEqual(self.page.evaluate('Object.values(dailyRecords).reduce((n,r)=>n+r.trips.length,0)'),248)
        for orientation in ['portrait','landscape']:
            with self.subTest(orientation=orientation):
                layout=self.export_and_check(orientation,orientation+'-dense-month.pdf',expected_rows=31)
                self.assertLess(layout['fitted']['mapping']['dh'],layout['canvas']['height'],
                                'The dense fixture must exercise proportional fitting')

    def test_native_print_full_month_uses_one_a4_page_in_both_orientations(self):
        self.prepare_full_month()
        self.page.set_viewport_size({'width':1440,'height':1000})
        self.page.locator('#clockOut').fill('19:35')
        before=self.page.evaluate('''()=>({records:JSON.stringify(dailyRecords),view:document.body.dataset.view,
          query:document.querySelector('#recordSearch').value,clockOut:document.querySelector('#clockOut').value,scroll:scrollY})''')
        self.page.evaluate('()=>{window.__nativePrintStacks=[];window.print=()=>{window.__nativePrintCalls=(window.__nativePrintCalls||0)+1;window.__nativePrintStacks.push(new Error().stack);};}')
        for orientation in ['portrait','landscape']:
            with self.subTest(orientation=orientation):
                self.assertTrue(self.page.evaluate('o=>RezaOT_print.print(o)',orientation))
                image=self.page.locator('#rezaotPrintPage').evaluate('''root=>{
                  const image=root.tagName==='IMG'?root:root.querySelector('img');
                  return image && {complete:image.complete,width:image.naturalWidth,height:image.naturalHeight};
                }''')
                self.assertTrue(image and image['complete'],image)
                self.assertGreater(image['width'],0,image)
                self.assertGreater(image['height'],0,image)
                source=self.page.evaluate('window.__finalPdfLayout')
                self.assertEqual(len(source['rows']),31)
                self.assertIn('FINAL-TRIP-KLIA2',source['lastText'])
                self.assertIn('TOTAL OT',source['totalText'])
                self.assertGreater(source['footerInk'],20)
                target=Path(self.temp.name)/(orientation+'-native-month.pdf')
                self.page.pdf(path=str(target),prefer_css_page_size=True,print_background=True)
                self.assertTrue(target.read_bytes().startswith(b'%PDF-'))
                self.assertGreater(target.stat().st_size,10000)
                self.assert_one_a4_page(target,orientation)
                self.page.evaluate("window.dispatchEvent(new Event('afterprint'))")
                self.assertFalse(self.page.evaluate('window.__printBusy || window.__pdfBusy'))
                self.assertEqual(self.page.locator('#rezaotPrintPage').count(),0)
                after=self.page.evaluate('''()=>({records:JSON.stringify(dailyRecords),view:document.body.dataset.view,
                  query:document.querySelector('#recordSearch').value,clockOut:document.querySelector('#clockOut').value,scroll:scrollY})''')
                self.assertEqual(after,before,'Native print cleanup must restore the unchanged app')
        self.assertEqual(self.page.evaluate('window.__nativePrintCalls'),2,self.page.evaluate('window.__nativePrintStacks'))

    def test_fit_failure_restores_app_without_changing_records(self):
        self.prepare_full_month(dense=True)
        self.page.locator('#clockOut').fill('20:15')
        before=self.page.evaluate('JSON.stringify(dailyRecords)')
        self.page.evaluate('window.__failReportFit=true')
        self.assertFalse(self.page.evaluate("RezaOT_print.exportPdf('portrait')"))
        self.assertEqual(self.page.evaluate('JSON.stringify(dailyRecords)'),before)
        self.assertEqual(self.page.locator('#clockOut').input_value(),'20:15')
        self.assertTrue(self.page.locator('#view-today').is_visible())
        self.assertFalse(self.page.evaluate('window.__pdfBusy || window.__printBusy'))
        self.assertFalse(self.page.locator('body').evaluate("el=>el.classList.contains('pdf-export')"))


if __name__=='__main__':
    unittest.main(verbosity=2)
