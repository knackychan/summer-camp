# Slice 03 — Quest Studio, guided assistant flow and reward economy

**Package:** Summer Quest 2026-09-23 v0.2.0

## Goal

Move day-to-day configuration away from manually editing a timetable. Papa defines reusable rules; the child app decides what is currently eligible and Summer presents a small, playful set of choices.

## Parent Quest Studio

The admin app now has a dedicated **Quests** route with three panels:

1. **Tasks & routines** — create, edit, pause and scope reusable rules.
2. **Rewards** — configure the child-facing reward shop and see available wallets.
3. **Summer assistant** — control guided questions and recommendation density.

Quest rules support:

- bilingual title and description;
- icon;
- routine / quest / activity type;
- care / help / learn / move / play / family category;
- duration and energy level;
- daily availability window;
- daily, weekday, weekend or every-N-days recurrence;
- child scope;
- daily-essential flag;
- Quest Coin reward;
- bilingual step list;
- enabled/paused state.

Configuration is stored in the existing `family_settings` table under versioned keys. This avoids a schema migration in v0.2.0 while keeping child and admin on the same source of truth.

## Child guided flow

The child Quest screen is no longer a static category filter. Summer can ask a short sequence:

```text
How much energy do you have?
        ↓
What sounds good right now?
        ↓
2–3 currently valid quests
```

Papa may switch the assistant to **Direct** mode, which skips the questions and immediately offers suitable quests.

The deterministic Quest Engine filters first. Summer only sees valid candidates.

## Reward economy

Lifetime stars remain permanent achievement/progression.

Spendable Quest Coins are derived as:

```text
available coins = lifetime stars - approved reward spending
```

This keeps the current append-only star ledger intact. Reward spending is stored separately and therefore never deletes or rewrites earned stars.

Child flow:

```text
Rewards → Shop → Ask Papa
```

Parent flow:

```text
Needs you → Reward request → Approve / Decline
```

The child cannot spend currency directly.

Approved spend state records request IDs as well as the total, making approval idempotent across double-clicks, realtime refreshes and reconnects.

## Migration rule

The old Today schedule remains operational because it currently owns important existing behavior including schedule overrides, block acceptance, lock/gate logic and provenance. It is now a secondary surface and will be gradually reduced to fixed events / exceptional day control as equivalent rule-based services are introduced.
