// Example only: copy the required public settings into cloud-config.js.
// Never store an account password, service-account JSON, or private key here.
window.REZAOT_CONFIG = {
  requireAuth: true,
  requireOwnerClaim: true, // Server-managed rezaot_owner custom claim.
  appCheck: { enabled: false, siteKey: "YOUR_PUBLIC_RECAPTCHA_V3_SITE_KEY" },
  firebaseConfig: {
    apiKey: "YOUR_FIREBASE_WEB_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_DATABASE.firebasedatabase.app",
    projectId: "YOUR_PROJECT",
    appId: "YOUR_FIREBASE_WEB_APP_ID"
  }
};
