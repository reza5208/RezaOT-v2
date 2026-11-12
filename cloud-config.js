// Owner-only access to the existing namespace. Server rules must match this UID.
window.REZAOT_CONFIG = Object.assign({
  requireAuth: true,
  requireOwnerClaim: false,
  legacyOwnerUid: "v5NcUVPcyJW5BhyCJtL38myZBKu2"
}, window.REZAOT_CONFIG || {});
