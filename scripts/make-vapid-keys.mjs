// Prints a fresh VAPID key pair for parent push notifications
// (docs/plans/2026-10-19-parent-app/, supabase/functions/notify-parents/README.md).
// The private key goes only into Supabase secrets; never commit it.
import { makeVapidKeys } from "../supabase/functions/notify-parents/webpush.mjs";

const keys = await makeVapidKeys();
console.log("Public key  (js/config.js PUSH_VAPID_PUBLIC_KEY and the VAPID_PUBLIC_KEY secret):\n  " + keys.publicKey);
console.log("Private key (only: supabase secrets set VAPID_PRIVATE_KEY=...):\n  " + keys.privateKey);
