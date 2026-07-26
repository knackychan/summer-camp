# Design — Admin three-column layout + conversation rail

**Date:** 2026-07-26
**Status:** approved by Papa (brainstorm session, Claude Code)
**Scope:** `admin.html`, `css/admin.css`, `js/admin.js`, one RLS policy in `supabase/schema.sql`. **No kid-facing change** — `index.html` is not touched.
**Extends:** `docs/SPEC.md`. Where this document disagrees with SPEC.md on admin *layout*, this document wins; every behavioural rule (bilingual, coach-not-cop, ledger-is-a-ledger, offline-first) stands unchanged.
**Slices:** `12-admin-shell.md`, `13-conversation-rail.md`, `14-rail-content.md` (numbering continues the global sequence; slices 01–08 in `2026-07-26-homework-lock-drills-outing/`, 09–11 in `2026-07-26-brain-gym/`).

## Context

`admin.html` today is a single centred column, `max-width: 1480px`, twelve `.panel` sections stacked vertically. Papa runs it **live all day on a desktop second screen** while the kids work. Two problems follow from that:

1. **Wasted width.** On a wide monitor the page is a narrow ribbon with empty margins on both sides.
2. **Scroll to react.** The things that need a reaction — a kid's question, a captain claim, a pass request — sit below the fold. Papa scrolls to answer, scrolls back.

Papa asked for panels on the left and the right. Mid-brainstorm he added: the Messages panel should be **a conversation panel, chat-bot style, on the right**, with **filtering by kind of message**.

## 1. Papa's decisions (verbatim intent)

| # | Decision |
|---|---|
| D1 | Usage model is **live all day, desktop second screen**. Design for glance-and-react, not batch review. |
| D2 | **Grant stars** and the **live feed** must be visible without scrolling. |
| D3 | Ask inbox + Captain claims + Pass requests **merge into one stream**, not three panels. |
| D4 | That stream is a **chat/conversation panel on the right rail** — kid bubbles left, Papa bubbles right, send box at the bottom. |
| D5 | The conversation rail **filters by kind of message**. |
| D6 | Cold panels **collapse to `<details>`, closed by default**, staying in the centre column. |
| D7 | Shell is **sticky rails + page-scrolling centre**, not a full-height three-scroller app shell. |
| D8 | Ledger is **split**: last 8 entries in the left rail for confirmation, full ledger in a centre fold for audit. |
| D9 | Old `Messages`, `Captain claims`, `Pass requests` panels are **deleted**, not duplicated. |

## 2. Shell

```
.app-shell {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr) 380px;
  gap: 14px;
  max-width: 1800px;   /* was 1480 */
  margin: 0 auto;
}

.rail {
  position: sticky;
  top: 14px;
  max-height: calc(100vh - 28px);
  overflow-y: auto;
}
```

Page scroll drives the centre column only. Rails scroll internally when their content exceeds the viewport — on a 1080p screen the left rail fits without scrolling (≈780px of content), and degrades to an internal scroll on shorter screens.

Breakpoints:

| Width | Columns |
|---|---|
| ≥ 1401px | `300px 1fr 380px` — full three-column |
| 1081–1400px | `1fr 380px` — left rail folds into the top of the centre column, conversation rail stays |
| ≤ 1080px | `1fr` — everything stacks, rails lose `position: sticky`, i.e. today's behaviour |

The header (`.app-top`) spans all three columns. The `#configState` and `#login` panels are centre-only; rails render nothing until `#dash` is visible.

`prefers-reduced-motion` and the existing coarse-pointer sizing are untouched — no hover-only affordance is introduced anywhere in this design.

## 3. Right rail — conversation panel

One chronological stream, newest at the bottom (chat convention), built by a single `buildStream()` that maps every source table into a common row shape.

```
┌─ 💬 Conversation 對話 ───── (3) ─┐
│ [All][🟢Lu][🩷Li][🔵Ls]         │  kid filter — single-select
│ [⚡Needs you][💬Ask][🏅Claim]    │  type filter — multi-select
│ [🎟Pass][📷Photo][⚙System]      │
├─────────────────────────────────┤
│ 📌 Papa today: "Be brave!"   ✎  │  pinned, never filtered out
├─────────────────────────────────┤
│      ── 09:14 Lili ✓ Reading ── │  system chip, centred, muted
│ ┌──────────────┐                │
│ │🟢 Lucien 9:20│                │  kid bubble — left, kid colour
│ │how say 儀餐?  │  🎤 0:06 ▶    │
│ └──────────────┘                │
│               ┌───────────────┐ │
│               │"dashboard" ✓  │ │  Papa bubble — right, gold
│               └───────────────┘ │
│ ┌────────────────────┐          │
│ │🔵 Luis · captain   │          │  action card — carries buttons
│ │helped Lili tidy up │          │
│ │[✓ Approve 批准][✕] │          │
│ └────────────────────┘          │
├─────────────────────────────────┤
│ [To: All 全部 ▾] type…    [↑]  │  send box, pinned to bottom
└─────────────────────────────────┘
```

### 3.1 Row model

| Source table | Row type | Side | Inline actions |
|---|---|---|---|
| `asks` (kid row) | `ask` | left bubble | reply field, `▶` voice playback |
| `asks.answer` | `reply` | right bubble | — |
| `help_claims` | `claim` | left action card | Approve 批准 / Deny 不行 |
| `passes` where `status='requested'` | `pass` | left action card | Grant 給 / Deny 不行 |
| `photos` | `photo` | left, thumbnail | opens existing gallery |
| `day_ticks`, `stars_ledger`, `day_redos` | `system` | centred chip | — |
| `papa_notes` for today | `pin` | top, sticky | edit in place |

Every row carries `{ id, type, kidId, at, body, actions }`. Sorting is by `at`. Rendering is one `renderConversation()` replacing `renderAsks()`, `renderHelpClaims()` and `renderPasses()`.

### 3.2 Filtering

- **Kid filter** — single-select, `All 全部` default. Hides other kids' rows; the pin is exempt.
- **Type chips** — multi-select. Default **on**: Ask, Claim, Pass. Default **off**: System, Photo (too noisy to watch all day).
- **⚡ Needs you** — a special chip that overrides both axes: unanswered `asks` + `help_claims.status='requested'` + `passes.status='requested'`. The header badge `(3)` is that same count, so badge and chip can never disagree.
- Filter state persists in `localStorage.sqAdminChatFilters`.
- Empty result renders "Nothing here 沒有訊息" plus a one-tap "Clear filters 清除篩選".

Filtering is client-side over the already-fetched merged array. **No new queries, no new realtime subscriptions** — `js/admin.js` already subscribes to all ten relevant tables (`day_ticks`, `stars_ledger`, `asks`, `passes`, `photos`, `help_claims`, `family_settings`, `day_overrides`, `day_redos`, `act_done`).

### 3.3 Scroll behaviour

Auto-scroll to the bottom on new rows **only when the rail is already at the bottom**. If Papa has scrolled up to read, new arrivals must not yank the viewport; show a "3 new ↓ 新訊息" pill instead, which scrolls down on tap.

### 3.4 Archived asks

The existing `showArchivedAsks` toggle survives as a `⚙` menu item on the panel header, off by default. Same semantics as today.

## 4. Left rail

```
┌─ 📅 Sat 26 Jul ─────────────┐  fixed
│ [↻ Refresh][⟲ Reset day]    │
│ ☑ Removed blocks earn stars │
├─────────────────────────────┤
│ ⭐ Grant stars 加星星        │  fixed
│ 🟢 Lucien 24⭐ [−][+1]      │
│ 🩷 Lili   19⭐ [−][+1]      │
│ 🔵 Luis   31⭐ [−][+1]      │
│ reason… ______________      │
├─────────────────────────────┤
│ 🧾 Recent 最近      [all ▸] │  own scroll, max-height 26vh
│ 9:22 🩷 +1 reading        ⟲│  newest first
│ 9:14 🔵 +2 helped Lili    ⟲│  ⟲ = undo (delete ledger row)
│ 8:57 🟢 +1 brain gym      ⟲│
├─────────────────────────────┤
│ 🔒 App locks 暫停            │  fixed, one row per kid
│ 🟢 free  🩷 free  🔵 games  │  tap a kid → controls expand inline
└─────────────────────────────┘
```

Two placement decisions worth stating:

**App locks moves out of a cold fold into the rail.** It is live state, not an archive — a paused kid is something Papa must be able to see and undo at a glance. Compact one-row-per-kid summary; tapping a kid expands the existing control set inline.

**Ledger splits.** The left rail carries only the last 8 entries, capped at `max-height: 26vh` with its own scroll. Its job is *confirmation* — tap `+1`, watch it land, spot a mis-grant, undo it. The full ledger with history stays in a centre fold for *audit*. One fetch, two views. Putting the whole ledger in the rail would push Grant stars out of view, contradicting D2.

## 5. Centre column

`Today at a glance` is unchanged internally. Drag-to-reorder, the time field, accept, undo, remove, add-back and redo all keep working exactly as they do now — this design moves containers, it does not touch `renderOverview()`'s internals.

Below it, the cold panels become closed `<details class="fold">`:

```
▸ Activities ticked today 今天完成的活動 (7)
▸ Proof gallery 照片證明 (4)          [🍽 Dinner gallery 晚餐播放]
▸ 14-day history 14天紀錄
▸ Ledger 星星紀錄 (32)
▸ Settings 設定 — kid PINs + admin PIN
```

Each `<summary>` carries a live count badge, so a closed fold still reports something. Open/closed state persists in `localStorage.sqAdminFolds`.

`<details>` is used deliberately: keyboard-accessible and screen-reader-correct with no JavaScript, and it collapses without a height animation that would fight the sticky rails.

## 6. Schema change

Papa-initiated messages need one new policy. Today `asks` grants the authenticated admin **UPDATE only** (`admin answer`); there is no INSERT path, so Papa cannot start a conversation, only reply to one.

```sql
-- v6 addition — Papa can start a conversation, not only answer one
do $$
begin
  execute 'drop policy if exists "admin ask" on public.asks';
  execute 'create policy "admin ask" on public.asks for insert to authenticated with check (true)';
end $$;
```

Papa-authored rows are marked with **`kind = 'papa'`** — `asks.kind` is a plain `text` column with no check constraint, so this needs no migration and no new column. Such a row carries its text in `answer` with `body` null, and `buildStream()` renders it as a right-side gold bubble. Existing rows (`kind` in `question | urgent | canned`) are untouched.

Because Postgres RLS policies are OR'd, the existing `kid ask` policy (`with check (answer is null)`) does not block this: `admin ask` grants the insert on its own.

Nothing else in `supabase/schema.sql` changes. Realtime publication already includes `asks`.

## 7. Non-goals

- No change to `index.html` or anything a kid sees.
- No new dependency, no framework, no build step. Plain CSS grid, plain DOM, matching the existing file style.
- No redesign of `renderOverview()` internals, the gallery modal, or the drag-and-drop code.
- No mobile-specific admin work beyond the existing `≤1080px` single-column stack.
- No notification-permission changes; the Windows notification button keeps its current behaviour and moves into the conversation panel header.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Sticky rails fight the drag-and-drop in `Today at a glance` when auto-scrolling near a rail edge | Rails get `pointer-events` untouched but sit in separate grid columns, so a drag never crosses one. Verify manually on a real drag. |
| `buildStream()` merging six tables becomes the new complexity centre | Keep it a pure function of already-fetched state, no fetching inside. It maps and sorts, nothing else. |
| Three panels deleted at once (D9) risks losing an action that had no equivalent | Slice 13 lists every button in the three old panels and asserts each has a home in the stream before the old markup is removed. |
| 380px rail truncates long bilingual strings | Bubbles wrap; no `text-overflow: ellipsis` on message bodies. Chips may abbreviate, bubbles never. |

## 9. DONE WHEN (design level)

- Wide desktop shows three columns; Grant stars and the conversation are both visible with the page scrolled to top.
- Every action available in the old Messages, Captain claims and Pass requests panels is reachable from the conversation rail.
- Filtering by kid and by kind both work and survive a reload.
- At ≤1080px the page renders as one column with no horizontal scroll.
- `node scripts/check.mjs` passes; every new string ships EN + 繁體中文.
