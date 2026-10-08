// Plain Node + PostgreSQL. POINTS_TEST_URL must name a disposable loopback DB.
// No live credentials are read. With no test DB, only static boundary checks run.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const brain = require('../js/brain-core.js');
const sql = readFileSync(new URL('../supabase/migrations/20261003_points_system.sql', import.meta.url), 'utf8');
assert.match(sql, /perform 1 from kids where id=r\.kid_id for update/);
assert.match(sql, /request_id uuid primary key references public\.points_requests/);
assert.match(sql, /if not points_parent\(\) then raise exception 'Parent approval required'/);
assert.match(sql, /version=1\) then return/);
assert.doesNotMatch(sql.slice(sql.indexOf('create or replace function public.reset_season')), /truncate table[^;]*(stars_ledger|family_settings|asks)/);
const url = process.env.POINTS_TEST_URL;
if (!url) {
  console.log('Points database static checks passed; PostgreSQL integration NOT RUN (set POINTS_TEST_URL and POINTS_TEST_PSQL; see supabase/POINTS-ROLLOUT.md).');
  process.exit(0);
}
const target = new URL(url);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) && target.pathname === '/sq_points_test', 'Only disposable local sq_points_test database is allowed');
const psql = process.env.POINTS_TEST_PSQL || 'psql';
const parent = '11111111-1111-4111-8111-111111111111';
const stranger = '22222222-2222-4222-8222-222222222222';
const quote = v => "'" + String(v).replaceAll("'", "''") + "'";
function run(text, role = 'postgres', uid = parent) {
  return new Promise((resolve, reject) => {
    const child = spawn(psql, ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-d', url], { windowsHide: true });
    let out = '', err = '';
    child.stdout.on('data', c => out += c); child.stderr.on('data', c => err += c);
    child.on('error', reject);
    child.on('close', code => code ? reject(new Error(err || out)) : resolve(out.trim()));
    child.stdin.end(`set role ${role}; set request.jwt.claim.sub=${quote(uid)};\n${text}`);
  });
}
async function rows(select, role = 'postgres', uid = parent) {
  const result = await run(`select row_to_json(result) from (${select}) result;`, role, uid);
  return result ? result.split(/\r?\n/).map(JSON.parse) : [];
}
async function one(select, role = 'postgres', uid = parent) { return (await rows(select, role, uid))[0]; }
const claim = async (kid, day, kind, slot = 'default', extra = {}) => one(`select * from points_claim(${quote(JSON.stringify({ kid_id: kid, day, kind, slot, ...extra }))}::jsonb)`, 'anon', '');
const approve = async id => one(`select * from points_review_claim(${quote(id)},true)`, 'authenticated');
const wallet = kid => one(`select * from point_totals where kid_id=${quote(kid)}`);
const rpc = async (name, args, role = 'authenticated', uid = parent) => {
  const r = await one(`select * from ${name}(${args})`, role, uid);
  return r && r[name] && typeof r[name] === 'object' ? r[name] : r;
};
const uuid = n => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`;

// Match Supabase's auth/role boundary while using the actual checked-in schema.
await run(`drop schema public cascade; create schema public; drop schema if exists auth cascade; drop schema if exists storage cascade;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${parent}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
create schema storage;create table storage.buckets(id text primary key,name text,public boolean);create table storage.objects(id uuid primary key,bucket_id text);`);
let base = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
base = base.replace(/do \$\$\s*begin\s*alter publication[\s\S]*?end \$\$;/g, '');
await run(base);
await run(`grant select,insert,update,delete on all tables in schema public to anon,authenticated;
insert into stars_ledger(id,kid_id,delta,reason,source) values('${uuid(1)}','luis',80,'Saved earnings','admin'),('b10c57a2-2026-0901-0001-000000000003','lucien',1,'Reading legacy','app');
insert into family_settings(key,value) values('reward_spend_luis','{"total":20,"requests":["${uuid(3)}"]}');
insert into asks(id,kid_id,kind,body) values('${uuid(2)}','luis','reward:choose_dessert:12','Agreed dessert / 同意的甜點'),('${uuid(3)}','luis','reward:movie_pick:20','Charged before interrupted answer');`);
await run(sql);
assert.deepEqual(await wallet('luis'), { kid_id: 'luis', total_earned: 800, spent: 200, available: 600, pending: 0 });
assert.equal((await one(`select * from points_requests where id='${uuid(2)}'`)).points, 120);
assert.equal((await one(`select stars from star_totals where kid_id='luis'`)).stars, 80);
await run(sql); // repeat-safe conversion
// The trio list in 20261003 predates retiring Change Maker; 20261008 brings it back in line with SQBrainCore.
const trioSql = readFileSync(new URL('../supabase/migrations/20261008_brain_trio_sync.sql', import.meta.url), 'utf8');
await run(trioSql); await run(trioSql);
assert.equal((await wallet('luis')).available, 600);
assert.equal((await rpc('points_approve_redemption', `'${uuid(3)}'`)).status, 'approved');
assert.equal((await wallet('luis')).available, 600, 'interrupted old approval cannot charge twice');
await assert.rejects(() => rpc('points_refund_redemption', `'${uuid(3)}','Unknown original charge'`), /reconciliation/);
const migratedReading = await claim('lucien', '2026-09-01', 'reading');
assert.equal(migratedReading.status, 'confirmed'); assert.equal(migratedReading.amount, 0);
assert.equal((await wallet('lucien')).total_earned, 10);

const today = (await one(`select (now() at time zone 'Asia/Taipei')::date as day`)).day;
const care = await claim('lili', today, 'morning_teeth', 'default', { amount: 999999 });
assert.equal(care.amount, 5);assert.equal(care.status, 'confirmed');
assert.equal((await claim('lili', today, 'morning_teeth', 'forged-new-slot')).id, care.id);
await assert.rejects(() => claim('lili', today, 'balanced_day'), /calculated by the server/);
await assert.rejects(() => claim('lili', today, 'learning', '1'), /parent must assign/);
await assert.rejects(() => rpc('points_review_claim', `'${care.id}',true`, 'authenticated', stranger), /Parent approval/);
await assert.rejects(() => run(`insert into stars_ledger(kid_id,delta,reason,unit_version) values('lili',999999,'forged',2);`, 'anon', ''), /Points RPC/);
await assert.rejects(() => run(`truncate table stars_ledger;`, 'authenticated'), /permission denied/);
await assert.rejects(() => run(`delete from family_settings where key='points_economy_v1';`, 'authenticated', stranger), /cannot be deleted/);
await assert.rejects(() => run(`delete from stars_ledger where id='${uuid(1)}';`, 'authenticated'), /cannot be edited or deleted/);
await assert.rejects(() => run(`update family_settings set value='{"awards":{"reading":1000}}' where key='points_policy_v1'; insert into family_settings(key,value) values('points_policy_v1','{"awards":{"reading":1000}}');`, 'authenticated', stranger), /Parent setting/);

for (const kind of ['evening_teeth', 'dressing', 'shower']) await claim('lili', today, kind);
for (const meal of ['breakfast', 'lunch', 'dinner']) await claim('lili', today, 'table_helper', meal);
await assert.rejects(() => claim('lili', today, 'table_helper', 'snack'), /Choose one meal/);
for (let i = 1; i <= 20; i++) {
  const day = `2026-09-${String(i).padStart(2, '0')}`;
  for (const kid of ['lucien', 'lili', 'luis']) assert.deepEqual((await one(`select points_brain_trio('${kid}','${day}') as trio`)).trio, brain.dailyThree(kid, day, {}));
}
const trio = brain.dailyThree('lili', today, {});
for (const game of trio) {
  await run(`insert into brain_done(kid_id,day,game_id,score) values('lili','${today}','${game}',0);`, 'anon', '');
  assert.equal((await claim('lili', today, 'brain', game)).amount, 10);
  await claim('lili', today, 'brain', game);
}
const otherBrain = Object.keys(require('../js/brain-data.js').GAMES).find(id => !trio.includes(id));
await run(`insert into brain_done(kid_id,day,game_id) values('lili','${today}','${otherBrain}');`, 'anon', '');
await assert.rejects(() => claim('lili', today, 'brain', otherBrain), /assigned Brain/);
const reading = await claim('lili', today, 'reading');assert.equal(reading.status, 'pending');
await approve(reading.id);await approve(reading.id);
const move = await claim('lili', today, 'movement');await approve(move.id);
assert.equal((await wallet('lili')).total_earned, 125, 'approved example day');

// Historical offline work is durable and receives parental verification.
for (const day of ['2026-09-21', '2026-09-22', '2026-09-24', '2026-09-27']) {
  for (const [kind, slot] of [['reading', 'default'], ['table_helper', 'lunch'], ['movement', 'default']]) {
    const c = await claim('lucien', day, kind, slot);assert.equal(c.status, 'pending');await approve(c.id);
  }
}
assert.equal((await wallet('lucien')).total_earned, 320, '10 old + four balanced days + weekly bonus');
assert.equal((await one(`select count(*)::int as n from points_claims where kid_id='lucien' and kind='balanced_week'`)).n, 1);
const denied = await claim('luis', today, 'reading');
await rpc('points_review_claim', `'${denied.id}',false,'Try again'`);
const redone = await claim('luis', today, 'reading');assert.equal(redone.id, denied.id);assert.equal(redone.status, 'pending');
await approve(redone.id);

// A trusted assignment shares one real work identity. Project only tops up to 50.
await rpc('points_assign', `'luis','${today}','creative','default','build-1','["Build a model","做模型"]'`);
await rpc('points_assign', `'luis','${today}','project','default','build-1','["Show completed model","展示模型"]'`);
const creative = await claim('luis', today, 'creative');await approve(creative.id);
const project = await claim('luis', today, 'project');assert.equal((await approve(project.id)).amount, 30);
await rpc('points_assign', `'luis','${today}','learning','1','outing-1','["Observe animals","觀察動物"]'`);
await rpc('points_assign', `'luis','${today}','outing','default','outing-1','["Observe animals outside","在戶外觀察動物"]'`);
const learned = await claim('luis', today, 'learning', '1', { work_id: 'forged' });
const outing = await claim('luis', today, 'outing', 'default', { work_id: 'another-forged-id' });assert.equal(learned.id, outing.id);

// An attempt retains the price from its archived policy even while offline.
const beginId = uuid(11);
const begin = await rpc('points_begin_attempt', `${quote(JSON.stringify({ id: beginId, kid_id: 'luis', day: today, kind: 'photo' }))}::jsonb`, 'anon', '');
assert.equal(begin.status, 'started');assert.equal(begin.amount, 15);
await run(`insert into family_settings(key,value) values('points_policy_v1','{"awards":{"photo":30,"music":30}}') on conflict(key) do update set value=excluded.value;`, 'authenticated');
const begunPhoto = await claim('luis', today, 'photo');assert.equal(begunPhoto.amount, 15);
const offlineMusic = await claim('luis', today, 'music', 'default', { evidence: { policy_snapshot: { updated_at: null, amount: 15 } } });
assert.equal(offlineMusic.amount, 15);assert.equal(offlineMusic.status, 'pending');
await assert.rejects(() => claim('lucien', today, 'photo', 'default', { evidence: { policy_snapshot: { updated_at: null, amount: 1000 } } }), /does not match/);

// Old device submissions are converted exactly once and never assumed confirmed.
const legacy = { id: uuid(12), kid_id: 'luis', delta: 2, reason: 'old offline work', created_at: '2026-09-30T01:23:45.000Z' };
const imported = await rpc('points_legacy_award', `${quote(JSON.stringify(legacy))}::jsonb`, 'anon', '');
assert.equal(imported.amount, 20);assert.equal(imported.status, 'pending');
assert.equal((await rpc('points_legacy_award', `${quote(JSON.stringify(legacy))}::jsonb`, 'anon', '')).id, imported.id);
await approve(imported.id);
const preservedLegacy = await one(`select reason,created_at from stars_ledger where id='${imported.id}'`);
assert.equal(preservedLegacy.reason, legacy.reason);assert.equal(new Date(preservedLegacy.created_at).toISOString(), legacy.created_at);
const existing = await rpc('points_legacy_award', `${quote(JSON.stringify({ id: uuid(1), kid_id: 'luis', delta: 3 }))}::jsonb`, 'anon', '');assert.equal(existing.amount, 800);
await run(`insert into stars_ledger(id,kid_id,delta,reason) values('${uuid(13)}','luis',1,'old tablet direct insert');`, 'anon', '');
assert.equal((await one(`select amount from points_claims where id='${uuid(13)}'`)).amount, 10);

// Catalog/rate snapshots survive edits. Native separate sessions race for funds.
await run(`update family_settings set value='[{"id":"a","cost":500,"title":["Old label","原名"],"points_version":1},{"id":"b","cost":500,"title":["Second","第二"],"points_version":1},{"id":"cash","kind":"cash","cost":100,"title":["Cash","現金"],"points_version":1},{"id":"gift","kind":"gift","cost":100,"title":["Gift","禮物"],"points_version":1}]' where key='reward_catalog_v1';`, 'authenticated');
await assert.rejects(() => rpc('points_request_reward', `'${uuid(20)}','luis','cash'`, 'anon', ''), /Configure/);
const a = await rpc('points_request_reward', `'${uuid(21)}','luis','a',500`, 'anon', '');
assert.equal((await rpc('points_request_reward', `'${uuid(99)}','luis','a'`, 'anon', '')).id, a.id, 'double tap reuses pending request');
const b = await rpc('points_request_reward', `'${uuid(22)}','luis','b',500`, 'anon', '');
await run(`update family_settings set value=replace(replace(value,'Old label','Changed label'),'500','700') where key='reward_catalog_v1';`, 'authenticated');
await assert.rejects(() => rpc('points_approve_redemption', `'${a.id}'`, 'anon', ''), /permission denied/);
await assert.rejects(() => rpc('points_approve_redemption', `'${a.id}'`, 'authenticated', stranger), /Parent approval/);
const outcomes = await Promise.allSettled([rpc('points_approve_redemption', `'${a.id}'`), rpc('points_approve_redemption', `'${b.id}'`)]);
assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1, 'concurrent sessions cannot spend the same funds');
const winner = outcomes.find(x => x.status === 'fulfilled').value;
assert.equal(winner.points, 500);if (winner.id === a.id) assert.equal(winner.label[0], 'Old label');
const balance = await wallet('luis');assert.ok(balance.available >= 0);assert.equal(balance.spent, 700);
await rpc('points_approve_redemption', `'${winner.id}'`);assert.deepEqual(await wallet('luis'), balance);
await rpc('points_refund_redemption', `'${winner.id}','Unavailable'`);
await rpc('points_refund_redemption', `'${winner.id}','Unavailable'`);
assert.equal((await wallet('luis')).spent, 200);
await assert.rejects(() => run(`update asks set answer='Approved',answered_at=now() where id='${uuid(2)}';`, 'authenticated'), /atomic Points/);
await assert.rejects(() => run(`update family_settings set value='0' where key='reward_spend_luis';`, 'authenticated'), /Points RPC/);
await run(`update family_settings set value='{"currency":"TWD","pointsPerUnit":10,"monthlyBudget":15,"cashEnabled":true}' where key='points_economy_v1';`, 'authenticated');
const cash = await rpc('points_request_reward', `'${uuid(23)}','luis','cash'`, 'anon', '');
const gift = await rpc('points_request_reward', `'${uuid(24)}','luis','gift'`, 'anon', '');
await run(`update family_settings set value='{"currency":"TWD","pointsPerUnit":20,"monthlyBudget":15,"cashEnabled":true}' where key='points_economy_v1';`, 'authenticated');
const budgetRace = await Promise.allSettled([rpc('points_approve_redemption', `'${cash.id}'`), rpc('points_approve_redemption', `'${gift.id}'`)]);
assert.equal(budgetRace.filter(x => x.status === 'fulfilled').length, 1, 'gift and cash share monthly budget under concurrent approval');
assert.equal(budgetRace.find(x => x.status === 'fulfilled').value.points_per_unit, 10);
await assert.rejects(() => run(`update family_settings set value=replace(value,'TWD','USD') where key='points_economy_v1';`, 'authenticated'), /currency unchanged/);
const budgetWinner = budgetRace.find(x => x.status === 'fulfilled').value;
const budgetOther = budgetRace[0].status === 'fulfilled' ? gift : cash;
const preMonth = await wallet('luis');
await run(`update points_redemptions set created_at=date_trunc('month',now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei' - interval '1 day' where request_id='${budgetWinner.id}';`);
assert.deepEqual(await wallet('luis'), preMonth, 'month boundary never clears the wallet');
await rpc('points_approve_redemption', `'${budgetOther.id}'`);
const manual = await rpc('points_manual_award', `'${uuid(30)}','lili',10,'Recorded correction test'`);
await rpc('points_correct_award', `'${manual.id}','Accidental duplicate'`);
await rpc('points_correct_award', `'${manual.id}','Accidental duplicate'`);
assert.equal((await wallet('lili')).total_earned, 125);

const beforeReset = await rows('select * from point_totals order by kid_id');
await rpc('reset_season', '');
assert.deepEqual(await rows('select * from point_totals order by kid_id'), beforeReset);
assert.equal((await one(`select count(*)::int as n from points_refunds`)).n, 1);
assert.ok((await one(`select count(*)::int as n from points_migration_backup`)).n > 0);
// Games points gate slice 02: four home-help kinds, applied after the points migration, twice.
const kindsSql = readFileSync(new URL('../supabase/migrations/20261008_games_gate_kinds.sql', import.meta.url), 'utf8');
await run(kindsSql); await run(kindsSql);
const lucienBefore = (await wallet('lucien')).total_earned;
const garden = await claim('lucien', today, 'garden_tidy', 'default', { amount: 999 });
assert.deepEqual([garden.amount, garden.status, garden.category], [15, 'pending', 'helping']);
assert.equal((await claim('lucien', today, 'garden_tidy', 'forged-slot')).id, garden.id, 'once a day, slot forced to default');
const shoes = await claim('lucien', today, 'shoe_tidy');
assert.deepEqual([shoes.amount, shoes.status], [5, 'confirmed'], 'shoes are self-checked');
for (const kind of ['living_tidy', 'office_tidy']) {
  const c = await claim('lucien', today, kind);assert.deepEqual([c.amount, c.status], [10, 'pending'], kind);
}
await approve(garden.id);
assert.equal((await wallet('lucien')).total_earned, lucienBefore + 20, 'shoes + approved garden');
assert.equal((await wallet('lucien')).pending, 20, 'living room + office wait for Papa');
// Games points gate slice 03: games_gate_v1 is seeded off and only a parent can change it, with checked values.
const gateSql = readFileSync(new URL('../supabase/migrations/20261008_games_gate_settings.sql', import.meta.url), 'utf8');
await run(gateSql); await run(gateSql);
const gateValue = async () => JSON.parse((await one(`select value from family_settings where key='games_gate_v1'`)).value);
assert.equal((await gateValue()).enabled, false, 'seeded switched off');
const setGate = (v, role = 'authenticated', uid = parent) => run(`update family_settings set value=${quote(JSON.stringify(v))} where key='games_gate_v1';`, role, uid);
await assert.rejects(() => setGate({ enabled: true, threshold: { lili: 50 } }, 'authenticated', stranger), /Parent setting required/);
await assert.rejects(() => setGate({ enabled: true, threshold: { lili: 42 } }), /steps of five/);
await assert.rejects(() => setGate({ enabled: 'yes' }), /true or false/);
await assert.rejects(() => setGate({ enabled: true, ai: { dailyUsdCap: -1 } }), /zero or more/);
await setGate({ enabled: true, threshold: { luis: 50, lili: 50, lucien: 40 } });
assert.deepEqual((await gateValue()).threshold, { luis: 50, lili: 50, lucien: 40 });
await setGate({ enabled: false }, 'anon', '');
assert.equal((await gateValue()).enabled, true, 'a tablet cannot switch the gate off');
await assert.rejects(() => run(`delete from family_settings where key='games_gate_v1';`, 'authenticated'), /cannot be deleted/);
console.log('Points PostgreSQL checks passed: repeat-safe 10× migration, legacy task reservations/queues, server amounts/eligibility, 60 Brain assignment cases, daily/weekly bonuses, caps, redo, project top-up, offline snapshots, RLS, concurrent funds/budget approvals, request snapshots, idempotent refunds, season preservation, games-gate home-help kinds and settings guard.');
