# Slice 06 — When things go wrong

**Decisions:** D9, D11. **Depends on:** 05.

| Case | Behaviour |
|---|---|
| Host closes the world / app / tablet sleeps | Guests: "Maya's world closed · Maya 的世界關閉了", back to their menu. |
| Guest loses wifi | "Looking for Maya's world… 正在找 Maya 的世界…", retry ~30 s via discovery; rejoin = fresh `welcome`; pending requests dropped. After 30 s: back to the menu with the "closed" line. |
| Nobody hosting | "No worlds open nearby · 附近沒有開著的世界". No error tone. |
| `proto` mismatch | Both: "Update the app on both tablets · 兩台平板都要更新"; `refuse`, clean close. |
| Same kid joins twice | The second connection replaces the first. |
| Papa pause on a guest | The guest sends `bye` and leaves. |
| Papa pause on the host | The world closes for everyone (row 1). |
| Shared undo after a sibling's change | "Someone changed that · 有人改過了", nothing changes. |

No red, no alarm sounds (coach, not cop).

## Tests
- Loopback: each row above that can be simulated (drop, refuse, duplicate kid, pause).
- Real tablets: rows 1, 2, 6, 7.

**DONE WHEN:** `node scripts/check.mjs` green; tests pass; every row checked on real tablets.
