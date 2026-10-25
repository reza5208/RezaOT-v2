// Local testing only. Copy into a separate localhost/demo browser profile.
// Never point emulator settings at the production project or a hosted app.
window.REZAOT_CONFIG = {
  requireAuth: true,
  requireOwnerClaim: true,
  firebaseConfig: {
    apiKey: "demo-api-key",
    authDomain: "demo-rezaot.firebaseapp.com",
    databaseURL: "https://demo-rezaot-default-rtdb.firebaseio.com",
    projectId: "demo-rezaot",
    appId: "demo-rezaot-web"
  },
  emulators: {
    auth: "http://127.0.0.1:9099",
    database: { host: "127.0.0.1", port: 9000 }
  },
  appCheck: { enabled: false }
};
