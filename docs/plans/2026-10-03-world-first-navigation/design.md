# World-first navigation

**Status:** approved by Papa, 2026-10-03 (chat request: "focus on the navigation, correct the return button, accessing to world, to main menu. access to heroes should not be that important as it is more like a log out button… kids should get into the world first screen, and have a clear button to get to the classic menu, rename it differently… maybe make the planet show some notification or interest point"). Claude picked the names "Base Camp 營地" and "🌍 Planet 星球". Papa can still rename them; the change is copy only.
**Builds on:** `docs/plans/2026-10-02-pixel-planet/` and `docs/plans/2026-10-03-planet-focus-readability/`. Where this doc and those disagree, this one wins for navigation.

## Why
- The kid's root screen was not consistent. Back from the classic hub went to **Heroes** whenever the hub had not been opened from the planet. That happened after every app restart that restored the hub, and on some browser-history paths. So the kid was logged out by pressing Back.
- **Heroes** had the top-left "←" slot on the planet. That made logging out look like the main way back.
- Back labels did not say where they led. The game Back read "← Lili". Activities, music and books always named their hub shelf, even when Back actually returned to the planet.
- "☰ Classic menu" is a developer's word for it, and it had no 中文.
- Nothing on the planet showed that a quest, the Brain Gym or a message from Papa was waiting.

## Decisions
| # | Decision | Rationale |
|---|---|---|
| D1 | **The planet is the kid's root.** Picking a hero opens the planet (unchanged). The hub is renamed **"⛺ Base Camp 營地"**. It is one big button in the kid's accent colour, top-right on the planet (`#worldClassic`, id kept for the harnesses). | The planet is home. Base Camp is the full list of everything, and the name fits a summer camp with an explorer's planet. |
| D2 | **Base Camp's Back always reopens the planet**, however Base Camp was reached (restored after a restart, browser history, a landmark, or the button). Its label is always "← 🌍 Planet 星球". | One rule: Back never skips the planet. |
| D3 | **Every content Back names where it lands.** It reads "← 🌍 Planet 星球" when the content was opened from the planet, otherwise the Base Camp shelf it returns to ("← Games 遊戲", "← Practice 練習", "← Activities 活動", "← Learning 學習", "← Music 音樂", "← Books 書籍"). A Learning Director launch keeps "← Learning 學習" because it always returns there. | The label matches the destination, which `returnAfterContent`/`goHome` already decided. |
| D4 | **Switching hero is a quiet log-out control.** It is "⇄ Switch 換人", muted, inside the kid chip (`#worldHeroes`, id kept). On the planet, Back closes focus or a mini-game, then returns `false` so Android leaves the app. Back never logs a kid out. | Heroes is a log-out, not a destination. Reopening the app restores the planet, so leaving costs nothing. Base Camp comes first in the DOM, so `showOnly()` auto-focus never lands on the switch. |
| D5 | **The planet shows what is waiting.** Registry entries carry an optional `attention: [en, zh]`. A landmark with one (and still openable) gets a bobbing yellow pixel "!" bubble and sparkles. Its focus card shows the invite in place of the blurb. If the landmark is on the far side, its bubble sits on the globe rim pointing the way, and tapping that bubble spins the planet there and focuses the landmark. A HUD chip "✨ N waiting · N 件事在等你" cycles through them. | It invites the kid to look without nagging. Signals, from strongest to weakest: a quest Papa sent back (↻), a quest in progress, required quests left today, the Brain Gym gating games, a redo block (My Day), unread Rewards news. |
| D6 | **Coach, not cop.** The bubble is yellow, never red. There are no counts of missed things and no times. The chip only shows when something is waiting. Under reduced motion there is no bob, blink or glow. | CLAUDE.md non-negotiable. |

## Not changed
How the hero is picked, the PIN policy, browser-history replay, the `world-explorer.js` `start/pause/resume/back/snapshot` contract (new fields and exports are additions only), the registry launch path, locks, stars and points.

## Open
- Ask-channel replies from Papa have no landmark on the planet, so they are not flagged yet. The 💬 badge in Base Camp still shows them.

## Slices
- `01-world-first-navigation.md` — D1–D6
