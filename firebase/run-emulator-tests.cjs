'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname,'..');
// Fixed demo project and loopback-only config; never infer a production project.
const result = spawnSync(process.execPath,['--require',path.join(__dirname,'local-emulator-http.cjs'),require.resolve('firebase-tools/lib/bin/firebase.js'),'emulators:exec','--project','demo-rezaot','--config',path.join(root,'firebase.json'),'--only','database,auth','node --require ./firebase/local-emulator-http.cjs --test --test-timeout=60000 tests/firebase-rules.test.cjs'],{
  cwd:root,stdio:'inherit',env:Object.assign({},process.env,{GCLOUD_PROJECT:'demo-rezaot',GOOGLE_CLOUD_PROJECT:'demo-rezaot',FIREBASE_CLI_DISABLE_UPDATE_CHECK:'true',
    XDG_CONFIG_HOME:process.env.XDG_CONFIG_HOME || path.join(os.tmpdir(),'rezaot-firebase-config'),
    FIREBASE_EMULATORS_PATH:process.env.FIREBASE_EMULATORS_PATH || path.join(os.tmpdir(),'rezaot-firebase-emulators')})
});
if(result.error){console.error(result.error.message);process.exitCode=1;}else process.exitCode=result.status===null?1:result.status;
