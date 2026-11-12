'use strict';
// These tests require an explicitly running loopback emulator and demo project.
const {test,before,after,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
const tooling=createRequire(path.resolve(__dirname,'../firebase/package.json'));
const projectId=process.env.GCLOUD_PROJECT || 'demo-rezaot';
function localHost(name){
  const value=process.env[name];
  if(!value)throw Error(name+' must point to a running local emulator. Run npm --prefix firebase test.');
  const match=value.match(/^(127\.0\.0\.1|localhost|\[::1\]):([0-9]+)$/);
  if(!match || Number(match[2])<1 || Number(match[2])>65535)throw Error(name+' must use a loopback host and valid port.');
  return {host:match[1],port:Number(match[2]),value};
}
if(!projectId.startsWith('demo-'))throw Error('Rules tests refuse non-demo Firebase projects.');
const database=localHost('FIREBASE_DATABASE_EMULATOR_HOST');
const authEndpoint=localHost('FIREBASE_AUTH_EMULATOR_HOST');
const {initializeTestEnvironment,assertSucceeds,assertFails}=tooling('@firebase/rules-unit-testing');
const {ref,set,get,remove,update,serverTimestamp}=tooling('firebase/database');
let env;
const ownerUid='rules-owner';
const ownPath='users/'+ownerUid;
const month='Oktober 2026';
const monthPath=ownPath+'/'+month;
const validRecord=()=>({clock_in:'08:00',clock_out:'19:00',unpaid:false,annual:false,trips:['KLIA Cargo (TEST-AWB) *'],tripDetails:[{id:'test-trip-1',label:'KLIA Cargo (TEST-AWB)',awb:'TEST-AWB',sideJob:'susun'}],sideJobs:[{awb:'TEST-AWB',type:'susun'}]});
const validMonth=()=>({dailyRecords:{'2026-10-19':validRecord()},trips:['KLIA Cargo'],revision:'test-revision',lastUpdated:'2026-01-01T00:00:00.000Z',deviceId:'test-device'});
const owner=()=>env.authenticatedContext(ownerUid,{rezaot_owner:true}).database();
const salary=()=>({basicSalary:3000,hoursPerMonth:208,kliaPerDay:70,epfEmployeeRate:0.11,epfEmployerRate:0.13,weekdayMult:1.5,restMult:2,phMult:2,uplDivisor:30,socso:20,eis:8,skim:30,restBreakHours:0,_v:74});
const ot=()=>({weekdayAfter:'17:00',saturdayAfter:'14:00',weekdayStart:'17:00',saturdayStart:'14:00'});
const settings=()=>({supervisorName:'Example supervisor',otSettings:ot(),salarySettings:salary(),observedHolidays:{},customHolidays:{},monthSettings:{[month]:{otSettings:ot(),salarySettings:salary(),observedHolidays:{},customHolidays:{},capturedAt:'2026-01-01T00:00:00.000Z'}}});
before(async()=>{env=await initializeTestEnvironment({projectId,database:{host:database.host,port:database.port,rules:fs.readFileSync(path.resolve(__dirname,'../database.rules.example.json'),'utf8')}});});
after(async()=>{if(env)await env.cleanup();});
beforeEach(async()=>{await env.clearDatabase();});

test('anonymous clients cannot read or write root, owner data or child paths',async()=>{
  const db=env.unauthenticatedContext().database();
  for(const key of ['',ownPath,monthPath,ownPath+'/settings',ownPath+'/_meta/trips'])await assertFails(get(key === '' ? ref(db) : ref(db,key)));
  await assertFails(set(ref(db,monthPath),validMonth()));
});
test('an authenticated account without the owner claim cannot use its own namespace',async()=>{
  const db=env.authenticatedContext(ownerUid).database();
  await assertFails(set(ref(db,monthPath),validMonth()));
  await assertFails(get(ref(db,ownPath)));
});
test('an approved owner may write and read its own validated month including a server timestamp',async()=>{
  const db=owner(),value=validMonth();value.lastUpdatedServer=serverTimestamp();
  await assertSucceeds(set(ref(db,monthPath),value));
  const snap=await assertSucceeds(get(ref(db,monthPath)));
  assert.equal(snap.child('dailyRecords/2026-10-19/clock_out').val(),'19:00');
  assert.equal(typeof snap.child('lastUpdatedServer').val(),'number');
});
test('the owner cannot access another UID or legacy default namespace',async()=>{
  const db=owner();
  for(const uid of ['another-owner','default']){
    await assertFails(get(ref(db,'users/'+uid)));
    await assertFails(set(ref(db,'users/'+uid+'/'+month),validMonth()));
  }
});
test('unknown top-level nodes and arbitrary record fields are rejected',async()=>{
  const db=owner();
  await assertFails(set(ref(db,ownPath+'/unexpected'),{secret:true}));
  const bad=validMonth();bad.dailyRecords['2026-10-19'].unexpected='bad';
  await assertFails(set(ref(db,monthPath),bad));
  const unknown=validMonth();unknown.extraPayload=true;
  await assertFails(set(ref(db,monthPath),unknown));
});
test('impossible dates, wrong-month dates, invalid clocks and conflicting leave flags are rejected',async()=>{
  const db=owner();
  for(const date of ['2026-10-32','2026-09-19','2025-10-19','1899-10-19']){
    const bad=validMonth();bad.dailyRecords={[date]:validRecord()};
    await assertFails(set(ref(db,monthPath),bad));
  }
  await assertFails(set(ref(db,ownPath+'/Februari 2026'),{dailyRecords:{'2026-02-30':validRecord()}}));
  await assertFails(set(ref(db,ownPath+'/Februari 2100'),{dailyRecords:{'2100-02-29':validRecord()}}));
  await assertSucceeds(set(ref(db,ownPath+'/Februari 2028'),{dailyRecords:{'2028-02-29':validRecord()}}));
  for(const patch of [{clock_in:'99:00'},{clock_out:'8:00'},{unpaid:true,annual:true}]){
    const bad=validMonth();Object.assign(bad.dailyRecords['2026-10-19'],patch);
    await assertFails(set(ref(db,monthPath),bad));
  }
});
test('leave days with empty times and absent empty collections remain legitimate',async()=>{
  const db=owner();
  for(const flag of ['annual','unpaid']){
    const entry={clock_in:'',clock_out:'',unpaid:false,annual:false,trips:[],tripDetails:[],sideJobs:[]};entry[flag]=true;
    await assertSucceeds(set(ref(db,monthPath),{dailyRecords:{'2026-10-19':entry},revision:'leave-revision'}));
  }
  await assertSucceeds(set(ref(db,ownPath+'/_meta/trips'),{list:[],revision:'empty-destinations'}));
  await assertSucceeds(set(ref(db,monthPath),{dailyRecords:{},trips:[],revision:'empty-month'}));
});
test('trip and side-job metadata enforces field types, bounds, allowed values and label consistency',async()=>{
  const db=owner();
  for(const change of [
    r=>{r.sideJobs[0].type='cash';},r=>{r.sideJobs[0].awb='';},
    r=>{r.tripDetails[0].id='';},r=>{r.tripDetails[0].sideJob='other';},
    r=>{r.tripDetails[0].label='different label';},r=>{r.trips[0]='x'.repeat(1001);},
    r=>{r.tripDetails[0].unexpected=true;}
  ]){const bad=validMonth();change(bad.dailyRecords['2026-10-19']);await assertFails(set(ref(db,monthPath),bad));}
});
test('settings and month snapshots accept empty holiday maps and reject invalid ranges or recursive data',async()=>{
  const db=owner();await assertSucceeds(set(ref(db,ownPath+'/settings'),settings()));
  for(const patch of [{basicSalary:-1},{hoursPerMonth:0},{epfEmployeeRate:1.5},{restBreakHours:25},{unexpected:1}]){
    const bad=settings();Object.assign(bad.salarySettings,patch);await assertFails(set(ref(db,ownPath+'/settings'),bad));
  }
  const badTime=settings();badTime.otSettings.weekdayStart='18:00';await assertFails(set(ref(db,ownPath+'/settings'),badTime));
  const recursive=settings();recursive.monthSettings[month].monthSettings={again:true};await assertFails(set(ref(db,ownPath+'/settings'),recursive));
  const invalidHoliday=settings();invalidHoliday.customHolidays={'2026-02-30':'Impossible'};await assertFails(set(ref(db,ownPath+'/settings'),invalidHoliday));
  const localPreference=settings();localPreference.darkMode='system';await assertFails(set(ref(db,ownPath+'/settings'),localPreference));
});
test('month manifests accept valid month keys and true values only',async()=>{
  const db=owner();await assertSucceeds(set(ref(db,ownPath+'/_meta/months/'+month),true));
  await assertFails(set(ref(db,ownPath+'/_meta/months/not-a-month'),true));
  await assertFails(set(ref(db,ownPath+'/_meta/months/'+month),'true'));
  await assertFails(set(ref(db,ownPath+'/_meta/unknown'),true));
});
test('record deletions are allowed while deleted month markers cannot contain live records',async()=>{
  const db=owner();await assertSucceeds(set(ref(db,monthPath),validMonth()));
  await assertSucceeds(remove(ref(db,monthPath+'/dailyRecords/2026-10-19')));
  await assertSucceeds(set(ref(db,monthPath),{revision:'deleted-month',deleted:true}));
  const mixed=validMonth();mixed.deleted=true;await assertFails(set(ref(db,monthPath),mixed));
  const unsupported=validMonth();unsupported.tombstone=true;await assertFails(set(ref(db,monthPath),unsupported));
  await assertFails(remove(ref(db,ownPath)));
});
test('partial updates must preserve validation of records and nested settings',async()=>{
  const db=owner();
  await assertSucceeds(set(ref(db,monthPath),validMonth()));
  for(const patch of [{clock_out:'invalid'},{unexpected:'bad'},{annual:true,unpaid:true}]){
    await assertFails(update(ref(db,monthPath+'/dailyRecords/2026-10-19'),patch));
  }
  await assertFails(remove(ref(db,monthPath+'/dailyRecords/2026-10-19/clock_in')));
  await assertSucceeds(set(ref(db,ownPath+'/settings'),settings()));
  await assertFails(update(ref(db,ownPath+'/settings/salarySettings'),{epfEmployeeRate:2}));
  await assertFails(update(ref(db,ownPath+'/settings/monthSettings/'+month),{unexpected:true}));
});
test('parent and multipath writes cannot add another namespace or self-assigned permission data',async()=>{
  const db=owner();
  await assertFails(update(ref(db,'users'),{[ownerUid+'/'+month]:validMonth(),['another-owner/'+month]:validMonth()}));
  await assertFails(update(ref(db,ownPath),{[month]:validMonth(),role:'admin',rezaot_owner:true}));
  const noClaim=env.authenticatedContext(ownerUid,{rezaot_owner:'true'}).database();
  await assertFails(set(ref(noClaim,monthPath),validMonth()));
});
test('invalid metadata and client future server timestamps are rejected',async()=>{
  const db=owner();
  for(const patch of [{revision:''},{deviceId:'x'.repeat(201)},{lastUpdated:'not-a-date'},{lastUpdatedServer:Date.now()+86400000}]){
    await assertFails(set(ref(db,monthPath),Object.assign(validMonth(),patch)));
  }
});
test('the Auth emulator issues the owner claim for an account provisioned by trusted admin code',async()=>{
  const {initializeApp:adminApp,deleteApp:deleteAdminApp}=tooling('firebase-admin/app');
  const {getAuth:adminAuth}=tooling('firebase-admin/auth');
  const {initializeApp,deleteApp}=tooling('firebase/app');
  const {getAuth,connectAuthEmulator,signInWithEmailAndPassword,getIdTokenResult,signOut}=tooling('firebase/auth');
  const trusted=adminApp({projectId},'rules-admin');
  const app=initializeApp({projectId,apiKey:'demo-key'},'rules-auth-client');
  const auth=getAuth(app);connectAuthEmulator(auth,'http://'+authEndpoint.value,{disableWarnings:true});
  let created;
  try{
    created=await adminAuth(trusted).createUser({email:'owner-rules@example.test',password:'Demo-only-password-123!'});
    await adminAuth(trusted).setCustomUserClaims(created.uid,{rezaot_owner:true});
    const credential=await signInWithEmailAndPassword(auth,'owner-rules@example.test','Demo-only-password-123!');
    const token=await getIdTokenResult(credential.user,true);assert.equal(token.claims.rezaot_owner,true);
    await signOut(auth);assert.equal(auth.currentUser,null);
  }finally{
    if(created)await adminAuth(trusted).deleteUser(created.uid);
    await deleteApp(app);await deleteAdminApp(trusted);
  }
});

test('owner-only legacy rules keep historical data accessible only to the pinned UID',async()=>{
 const rules=fs.readFileSync(path.resolve(__dirname,'../database.rules.owner.json'),'utf8');
 const doc=JSON.parse(rules),uid=doc.rules.users.default['.read'].match(/auth.uid === '([^']+)'/)[1];
 const fixedEnv=await initializeTestEnvironment({projectId,database:{host:database.host,port:database.port,rules}});
 try{
  const own=fixedEnv.authenticatedContext(uid).database(),other=fixedEnv.authenticatedContext('not-the-owner',{rezaot_owner:true}).database(),anon=fixedEnv.unauthenticatedContext().database();
  const path='users/default/Oktober 2026',value=validMonth();await assertSucceeds(set(ref(own,path),value));
  assert.equal((await assertSucceeds(get(ref(own,path)))).child('dailyRecords/2026-10-19/clock_out').val(),'19:00');
  for(const db of [other,anon]){await assertFails(get(ref(db,'users/default')));await assertFails(get(ref(db,path)));await assertFails(set(ref(db,path),value));}
  await assertFails(get(ref(own)));await assertFails(set(ref(own,'users/another-owner/Oktober 2026'),value));await assertFails(remove(ref(own,'users/default')));
  await assertSucceeds(update(ref(own,path+'/dailyRecords/2026-10-19'),{clock_out:'20:00'}));
 }finally{await fixedEnv.cleanup();}
});

test('HR capability links allow only exact live reports; private data and listing stay denied',async()=>{
 const rules=fs.readFileSync(path.resolve(__dirname,'../database.rules.owner.json'),'utf8');
 const uid=JSON.parse(rules).rules.users.default['.read'].match(/auth.uid === '([^']+)'/)[1];
 const fixed=await initializeTestEnvironment({projectId,database:{host:database.host,port:database.port,rules}});
 try{
  const own=fixed.authenticatedContext(uid).database(),anon=fixed.unauthenticatedContext().database(),other=fixed.authenticatedContext('another-user').database();
  const token='b'.repeat(64),share='sharedReports/'+token,idx='users/default/_meta/hrShares/Oktober 2026/'+token;
  const value={version:1,month:'Oktober 2026',updatedAt:Date.now(),expiresAt:Date.now()+86400000,report:'{"title":"Report snapshot"}'};
  // App publishes report + private link index together, or neither.
  await assertSucceeds(update(ref(own),{[share]:value,[idx]:{updatedAt:value.updatedAt,expiresAt:value.expiresAt}}));
  assert.equal((await assertSucceeds(get(ref(anon,share)))).val().month,'Oktober 2026');
  for(const db of [anon,other]){
   await assertFails(get(ref(db,'sharedReports')));
   await assertFails(get(ref(db,'sharedReports'),{shallow:true}));
   await assertFails(get(ref(db,'sharedReports/'+'c'.repeat(64))));
   await assertFails(get(ref(db,idx)));
   await assertFails(get(ref(db,'users/default/Oktober 2026')));
   await assertFails(set(ref(db,share),value));
   await assertFails(update(ref(db,share),{expiresAt:Date.now()+3600000}));
   await assertFails(remove(ref(db,share)));
  }
  for(const patch of [{version:2},{unexpected:'private'},{report:{html:'bad'}},{expiresAt:Date.now()-1000},{expiresAt:Date.now()+91*86400000},{updatedAt:Date.now()+3600000},{report:'x'.repeat(250001)}]){
   await assertFails(set(ref(own,share),{...value,...patch}));
  }
  await assertFails(set(ref(own,'sharedReports/guessable'),value));
  const expired='sharedReports/'+'d'.repeat(64);
  await fixed.withSecurityRulesDisabled(async context=>set(ref(context.database(),expired),{...value,expiresAt:Date.now()-1000}));
  await assertFails(get(ref(anon,expired)));
  // Owner can still inspect expired reports and revoke them.
  await assertSucceeds(get(ref(own,expired)));
  await assertSucceeds(update(ref(own),{[share]:{...value,updatedAt:Date.now()},[idx+'/updatedAt']:Date.now()}));
  await assertSucceeds(update(ref(own),{[share]:null,[idx]:null}));
  await assertFails(get(ref(anon,share)));
  await assertFails(get(ref(anon)));
 }finally{await fixed.cleanup();}
});
