const test = require('node:test');
const assert = require('node:assert/strict');
const {emulatorRequest,localFetch,localSocketOptions} = require('../firebase/emulator-network.cjs');

test('emulator HTTP routing accepts only exact loopback names and fixed ports',()=>{
  for(const host of ['localhost','127.0.0.1','[::1]']) assert.equal(emulatorRequest(`http://${host}:9000/.settings/rules.json`),true);
  for(const url of ['https://127.0.0.1:9000','http://127.0.0.1:9001','http://localhost.example:9000','http://127.0.0.1:9000@remote.example/','https://storage.googleapis.com/file','invalid']) assert.equal(emulatorRequest(url),false,url);
});
test('local HTTP requests retain headers and cancellation while remote proxy options remain untouched',async()=>{
  const calls=[],proxy={remote:true},headers={Authorization:'Bearer demo-owner'},signal=new AbortController().signal;
  const original=(...args)=>{calls.push(args);return Promise.resolve('ok');};
  const fetch=localFetch(original),options={dispatcher:proxy,method:'PUT',headers,body:'{}',signal};
  await fetch('http://127.0.0.1:9000/.settings/rules.json',options);
  assert.equal(calls[0][1].dispatcher,undefined);
  assert.equal(calls[0][1].headers,headers);
  assert.equal(calls[0][1].signal,signal);
  assert.equal(calls[0][1].body,'{}');
  assert.equal(calls[0][1].redirect,'manual');
  assert.equal(options.dispatcher,proxy);
  await fetch('https://storage.googleapis.com/emulator.jar',options);
  assert.equal(calls[1][1],options);
  await fetch('http://localhost.example:9000',options);
  assert.equal(calls[2][1],options);
});
test('only the RTDB loopback WebSocket drops its proxy without changing remote options',()=>{
  const options={proxy:{origin:'http://proxy.example:8080'},headers:{Authorization:'Bearer demo-owner'}};
  const local=localSocketOptions('ws://127.0.0.1:9000/.ws',options);
  assert.equal(local.proxy,undefined);
  assert.equal(local.headers,options.headers);
  assert.ok(options.proxy);
  for(const url of ['wss://127.0.0.1:9000/.ws','ws://localhost.example:9000/.ws','ws://127.0.0.1:9001/.ws','wss://project.firebasedatabase.app/.ws']) assert.equal(localSocketOptions(url,options),options);
});
