# notify-parents

Pushes a notification to the parents' phones and computers when a kid finishes a
task that waits for a parent, or asks for a reward
(`docs/plans/2026-10-19-parent-app/`). Works with the app closed. Web Push only,
no Firebase: Android Chrome, desktop Chrome/Edge, and iPhone (iOS 16.4+) once
admin is added to the Home Screen.

## One-time setup (Papa)

1. Make a key pair on any computer with Node:

   ```sh
   node scripts/make-vapid-keys.mjs
   ```

2. Pick a long random webhook secret (any 32+ characters), then set the secrets
   and deploy:

   ```sh
   supabase secrets set VAPID_PUBLIC_KEY=<public> VAPID_PRIVATE_KEY=<private> \
     VAPID_SUBJECT=mailto:<your email> PUSH_WEBHOOK_SECRET=<webhook secret>
   supabase functions deploy notify-parents --no-verify-jwt
   ```

3. Run `supabase/migrations/20261019_parent_push.sql` in the SQL editor, then
   tell the database where to call (same webhook secret as above):

   ```sql
   insert into public.parent_push_config(key,value) values
     ('function_url','https://<project>.supabase.co/functions/v1/notify-parents'),
     ('webhook_secret','<webhook secret>')
   on conflict(key) do update set value=excluded.value;
   ```

4. Add the **public** key to `js/config.js` on the site (never the private one):

   ```js
   PUSH_VAPID_PUBLIC_KEY: "<public>",
   ```

5. On each parent device, open admin, sign in, and tap **Notify this device**,
   then **Send a test**. On iPhone, first add admin to the Home Screen from
   Safari (Share → Add to Home Screen) and open it from there.

Each parent signs in with their own account, and that account must be in
`public.admins`.

## What is sent

- A task claim turns `pending` → "Lili finished a task · Wash rice 洗米 · +10 points".
- A reward request turns `requested` → "Luis asked for a reward".
- During a device's quiet hours (default 21:30–07:00 Taipei) nothing is sent;
  one summary ("3 things are waiting for you") arrives when they end.

Payloads carry the kid's name, the task name and points only. No photos, no chat.

## Tests

`node --test scripts/notify-parents-fn.test.mjs` (also run by `node scripts/check.mjs`).
The encoder is checked by decrypting its output the way a browser does.
