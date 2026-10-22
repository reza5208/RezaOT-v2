// Example only: copy the required public settings into cloud-config.js.
// Never store an account password, service-account JSON, or private key here.
window.REZAOT_CONFIG = {
  requireAuth: true,
  firebaseConfig: {
    apiKey: "YOUR_FIREBASE_WEB_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_DATABASE.firebasedatabase.app",
    projectId: "YOUR_PROJECT",
    appId: "YOUR_FIREBASE_WEB_APP_ID"
  }
};
