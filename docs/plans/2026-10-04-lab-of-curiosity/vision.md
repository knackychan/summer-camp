# Code Quest — Laboratory of Curiosity
## Game Design, UI/UX and System Design Plan

> **Status:** source vision supplied by Papa, 2026-10-04 (chat, with a painted mock of the lab scene). Kept verbatim as the long-range reference. **Not itself an approved build plan** — `design.md` in this folder holds the approved decisions; where they differ, `design.md` wins.

**Project:** Summer Quest / Code Quest RPG
**Feature:** Potion Craft — Camp & Lab
**Working name:** **The Laboratory of Curiosity**
**Design direction:** High-detail magical pixel-art laboratory, tactile tablet-first interaction, systemic experimentation
**Core principle:** **There should always be something interesting to try.**

---

## 1. Vision

The Laboratory of Curiosity should not feel like a conventional crafting menu.

It should feel like a **real magical place the child inhabits and experiments inside**.

The room itself becomes the interface:

- shelves contain real ingredients;
- drawers can be opened;
- books can be inspected;
- crystals can be picked up;
- plants can be harvested;
- strange machines can be activated;
- creatures can react to experiments;
- ingredients and objects in the background can be dragged directly into experiments;
- the workbench is the primary play surface rather than a large overlay UI.

The core fantasy is:

> **“What happens if I put THIS with THAT?”**

The experience should reward curiosity, experimentation, observation, prediction and discovery rather than simply asking the child to reproduce known recipes.

---

# 2. Core Gameplay Loop

The primary loop is:

**Explore → Pick Up → Combine → Manipulate → Observe → Modify → Discover → Understand → Record → Try Again**

A child should be able to enter the laboratory with no specific quest and still find something meaningful to do.

Known recipes are useful, but discovering something unexpected should often be more exciting.

Examples:

- make a useful potion;
- accidentally create a fireball;
- duplicate a mushroom;
- open a tiny portal;
- create a cute creature;
- reverse time for a few seconds;
- make a plant grow across the room;
- turn an object into crystal;
- create a miniature gravitational anomaly;
- discover a new interaction rule.

---

# 3. Design Philosophy

## 3.1 The laboratory is the UI

Avoid turning the screen into a traditional dashboard.

The room should carry most of the interface.

Examples:

- recipe book physically lies on the table;
- ingredient jars live on shelves;
- the cauldron is the primary mixing target;
- a notebook contains discoveries;
- a scale is used by dragging materials onto it;
- a mortar and pestle can physically process ingredients;
- burners control heat;
- a cooling plate reduces temperature;
- a crystal resonator manipulates magical energy;
- a containment jar stores unstable reactions.

The permanent HUD should remain lightweight.

Recommended always-visible UI:

- Camp / Lab / Quest / Map navigation;
- small resource counters;
- current objective if one exists;
- contextual hints only when useful.

Everything else should ideally exist inside the physical scene.

---

## 3.2 Curiosity before instructions

The player should not always be told what to do.

The laboratory should constantly create moments of:

> “Wait... can I use that too?”

Background objects should often be secretly interactable.

Examples:

- candle flame;
- moonlight;
- smoke;
- a creature feather;
- a flower growing near the window;
- a strange shadow;
- water dripping from a pipe;
- a spark from a machine;
- dust from an old book;
- reflections from a mirror.

This encourages exploration of the environment itself.

---

## 3.3 Failure should be entertaining

There should be very little conventional failure.

An unsuccessful experiment may create:

- smoke;
- soot;
- a harmless explosion;
- slime;
- bubbles;
- a strange smell;
- a tiny monster;
- runaway vines;
- reversed gravity;
- duplicated junk;
- a portal;
- a temporarily transformed owl;
- an annoyed cat;
- a funny sound;
- an unstable potion.

The reaction itself is the reward.

This prevents experimentation from feeling risky or punitive.

---

# 4. Visual Direction

## 4.1 Art style

Use **modern high-detail pixel art**, not minimalist retro pixel graphics.

Target qualities:

- dense environmental storytelling;
- readable silhouettes;
- warm, handcrafted fantasy atmosphere;
- strong lighting contrast;
- small animated details everywhere;
- tactile physical props;
- readable tablet-scale interaction targets.

Primary lighting palette:

### Warm light
- candle orange;
- burner fire;
- lantern amber;
- wooden workbench tones.

### Magical contrast
- moonlight blue;
- potion green;
- crystal purple;
- cyan magical energy;
- void violet;
- electric yellow.

The room should feel cozy, mysterious and alive.

---

## 4.2 Environment composition

Recommended composition:

### Background
- moonlit arched window;
- ingredient shelves;
- magical artifacts;
- hanging plants;
- books;
- notes;
- strange machinery;
- creature habitat;
- hidden interactables.

### Midground
- main shelves;
- cauldron;
- workbench apparatus;
- owl mentor;
- cat or other creature;
- recipe / research notebook.

### Foreground
- workbench surface;
- cutting board;
- mortar and pestle;
- loose ingredients;
- test tubes;
- tools;
- inventory tray when necessary.

The scene should communicate depth without making touch interaction ambiguous.

---

# 5. Laboratory Layout

The laboratory should gradually expand, but the initial room can already support several workstations.

## 5.1 Main workbench

Core stations:

1. **Cauldron** — combine ingredients; heat mixtures; create potions; trigger systemic reactions.
2. **Mortar and Pestle** — crush; grind; mix powders; change ingredient state.
3. **Cutting Board** — cut; slice; separate components.
4. **Burner** — heat; ignite; melt; boil.
5. **Cooling Plate** — freeze; stabilize; slow reactions.
6. **Scale** — measure quantity; compare mass; introduce exact ratios later.
7. **Test Tube Rack** — isolate small reactions; compare variations.
8. **Crystal Resonator** — amplify magical properties; detect resonance; trigger advanced interactions.
9. **Containment Chamber** — hold unstable matter; capture creatures; safely observe strange phenomena.
10. **Curiosity Journal** — recipes; discovered properties; phenomena; player notes; experiment history.

---

# 6. Ingredient System

Ingredients must not behave as simple recipe tokens.

Every ingredient should contain a set of meaningful properties.

## Red Mushroom

```yaml
id: red_mushroom
elements:
  - nature

properties:
  - organic
  - growth
  - volatile

affinities:
  life: 0.8
  transformation: 0.6
  replication: 0.2

heat_sensitivity: high
stability: medium
```

## Echo Crystal

```yaml
id: echo_crystal
elements:
  - crystal

properties:
  - resonance
  - echo
  - replication

affinities:
  replication: 1.0
  space: 0.5
  organic: 0.2

stability: high
```

## Void Dust

```yaml
id: void_dust
elements:
  - void

properties:
  - space
  - instability
  - transformation

affinities:
  space: 1.0
  time: 0.7
  transformation: 0.8

stability: very_low
```

This means the simulation reacts to **properties and affinities**, not only authored ingredient pairs.

---

# 7. Ingredient Synergy System

Ingredient synergy is one of the central pillars of the Laboratory.

Properties should: reinforce each other; cancel each other; amplify each other; destabilize each other; transform each other; trigger special reaction families.

```text
Fire + Growth
→ Flaming vines
```

But:

```text
Fire + Growth + Water
→ Steam-fed giant flower
```

And:

```text
Growth + Replication
→ 2 mushrooms
→ 4 mushrooms
→ 8 mushrooms
→ laboratory mushroom outbreak
```

The child learns the system by observing consequences.

---

# 8. Stateful Ingredients

An ingredient should be able to change state and remain useful afterward.

Example states: fresh; chopped; crushed; burned; frozen; boiled; charged; duplicated; crystallized; enchanted; corrupted; ghostified; enlarged; shrunken; animated.

Therefore `Mushroom + Fire` is different from `Frozen Mushroom + Fire`, which is different from `Crushed Mushroom + Fire`.

This dramatically increases depth without requiring every state to be authored as an independent ingredient.

---

# 9. Experiment Inputs

An experiment result should be influenced by more than the ingredient list.

```text
Experiment
├── Ingredients
├── Ingredient State
├── Quantity
├── Order
├── Temperature
├── Processing
├── Duration
├── Environment
├── Apparatus
└── Energy
```

`Mushroom + Crystal` may produce one result. But `Crush Mushroom → Heat Crystal → Mix → Stir x3 → Cool` may produce something entirely different.

This also creates natural bridges into programming concepts.

---

# 10. Reaction Families

- **10.1 Elemental** — fire; water; steam; ice; electricity; wind; earth; light; shadow. Reactions: fireball; lightning chain; ice burst; water eruption; tornado; glowing room.
- **10.2 Physical** — bounce; explode; melt; harden; enlarge; shrink; stretch; compress; float; become heavy.
- **10.3 Biological** — grow; mutate; hatch; heal; poison; animate; sprout; regenerate.
- **10.4 Spatial** — teleport; open portal; swap positions; create pocket dimension; stretch distance; pull nearby objects.
- **10.5 Temporal** — slow time; accelerate time; reverse time; loop an event; age an object; restore an earlier state.
- **10.6 Replication** — copy; split; clone; echo; multiply; create unstable copies.
- **10.7 Transformation** — polymorph; turn to metal; crystallize; ghost form; slime form; invert material; become transparent.
- **10.8 Gravity** — float; attract; repel; invert gravity; orbit; create local gravity well.
- **10.9 Mind / Illusion** — invisibility; hallucination; memory; confusion; focus; dream; illusion duplicates.
- **10.10 Creature Creation** — summon; hatch; combine; mutate; animate; transform.
- **10.11 Reality-Breaking Effects** (rarer) — impossible geometry; duplicated room; tiny universe; local time fracture; room folded through a portal; objects briefly become pixel glitches; laboratory mirrored into another dimension.

---

# 11. Cute Monstrosities

Biological and magical combinations should sometimes produce creatures.

```text
Mushroom + Eye + Growth        → Mushroom Blob
Plant + Fire + Egg             → Ember Lizard
Berry + Replication + Life     → Berry Slime Family
Rock + Life + Shield           → Tiny Rock Golem
Moon + Cat Hair + Void         → Shadow Kitten
Crystal + Frog + Lightning     → Spark Frog
```

These creatures can become collectible and connect directly into the wider Code Quest creature system.

---

# 12. Duplication System

```text
Berry + Echo Crystal → 2 berries
Add more Echo → 4 berries → 8 berries → 16 berries
```

Then: **CRITICAL REPLICATION** — the laboratory fills with berries.

Add a stabilizer: `Echo + Echo + Stabilizer → Controlled Replication Potion`.

Design principle: **chaotic discoveries can later become useful tools once the child understands the rule.**

---

# 13. Space-Time Effects

- **Space Rupture** — a tiny portal opens above the table; nearby objects are pulled toward it; ingredients can disappear inside; unexpected objects can emerge; the player can attempt to stabilize or enlarge it.
- **Time Reversal** — ingredients jump back into jars; potion separates; broken bottle repairs itself; spilled liquid climbs back onto the table.
- **Time Acceleration** — plant grows instantly; fruit ripens; creature egg hatches; metal rusts; potion ages.
- **Time Loop** — an action repeats until the player interrupts the cause (`Mushroom falls into cauldron → resets → falls again → repeats`). This naturally introduces the idea of loops.

---

# 14. Transformation System

Transformation affects ingredients, objects, creatures and sometimes the laboratory itself: Shrink (owl becomes tiny); Enlarge (a mushroom grows huge); Feather (books float); Metal (an apple becomes conductive metal); Ghost (passes through containers); Gelatinize (a rock becomes a bouncing slime-rock); Invert (properties become their opposite).

State changes should influence later reactions: `Apple → Metal Apple → Electricity → strong conductive reaction`.

---

# 15. Rare Curiosity Events

```text
Moonflower + Echo Crystal + Void Dust → Pocket Universe
Pocket Universe + Life               → tiny planet
+ Fire                               → tiny star
+ too much Fire                      → miniature supernova
```

Not every experiment needs RPG utility. Some discoveries should exist because they make the player want to keep experimenting.

---

# 16. Hidden / Abstract Ingredients

Later: moonlight; shadow; sound; heat; cold; smoke; laughter; electricity; dreams; memories; reflections; magnetism; time; gravity. Special apparatus can let the player capture these.

Early game: `Mushroom + Leaf + Crystal`. Advanced game: `Shadow + Memory + Time + Mushroom` — the second should feel dramatically more mysterious.

---

# 17. Synergy Feedback

Do not reveal all interaction rules immediately. The room communicates compatibility through subtle feedback: compatible objects glow faintly; Echo Crystal hums near organic matter; Void Dust distorts nearby pixels; fire ingredients make the cauldron sparks accelerate; unstable combinations shake; compatible runes briefly connect.

After discovering a synergy, the Journal shows the relationship permanently — gradually building an **ingredient knowledge graph**.

---

# 18. The Curiosity Journal

The large physical book on the workbench becomes **The Curiosity Journal**. Sections: Recipes; Reactions; Phenomena; Ingredients; Creatures; Experiments; Unknowns.

- **Recipes** — repeatable results (Focus Potion).
- **Reactions** — general rules ("Echo Crystal strongly duplicates compatible organic matter.").
- **Phenomena** — rare events (First Space-Time Rupture).
- **Ingredient knowledge** — properties; affinities; compatible materials; unstable pairings; known transformations; discovered uses.

The player learns rules rather than memorizing isolated recipes.

---

# 19. Coding Concepts Hidden Inside the Lab

- **Sequence** — `Add leaf → add crystal → heat`. Order matters.
- **Variables** — `temperature = 3`, `crystal_quantity = 2`.
- **Conditions** — `IF mixture becomes purple THEN stop heating`.
- **Loops** — `Stir 3 times`; later `Stir UNTIL mixture turns green`.
- **Functions** — save a process: `MakeSparkEssence()`.
- **Events** — `WHEN heated → explode`; `WHEN moonlight reaches crystal → duplicate`. Aligns with Code Quest signal / event concepts.

---

# 20. Automation Progression

Early gameplay stays tactile: drag; drop; stir; cut; crush; heat; cool; observe.

Later, a **Rune Automation Board**:

```text
WHEN cauldron boils → add water
REPEAT stir UNTIL color = green
IF temperature > 5 → activate cooling crystal
```

> **Understand the process physically first. Then automate it with code.**

---

# 21. Interaction Design

Tablet-first; every important action works with touch.

**Dragging** — when touched, an ingredient lifts slightly, enlarges, gets a clear outline; its source shelf responds; possible targets subtly react. Above the cauldron: glow intensifies; particles increase; optional label; drop zone obvious. Released: **PLOP** — the experiment immediately responds.

**Tap alternative** — dragging is never the only method: tap ingredient → valid stations highlight → tap station.

---

# 22. Environmental Interaction

Draggable / usable background elements: mushroom in a jar; flower near the window; candle flame; hanging herb; loose feather; crystal on a shelf; water droplet; moonlight; strange bug; creature hair; glowing dust; smoke from a burner. The player repeatedly discovers that decoration is part of the system.

---

# 23. Camp Integration

Camp: rest; cooking; companions; outdoor discoveries; quests; inventory; creature care. Lab: experiments; potion crafting; transformation; research; automation; discovery.

```text
Dungeon → discover strange mushroom → bring it to Camp → take it into Lab
→ experiment → discover anti-gravity property → craft item → use item during exploration
```

---

# 24. Progression

1. **Curious Beginner** — plants; mushrooms; water; basic crystals; simple heat; cauldron; mortar. Concepts: cause and effect; simple combinations; sequence.
2. **Apprentice** — fire; electricity; creature materials; transformation; cooling; test tubes. Concepts: state; variables; conditions.
3. **Experimentalist** — duplication; gravity; advanced apparatus; automation board. Concepts: loops; triggers; reusable procedures.
4. **Arcane Researcher** — space; time; void; abstract ingredients; dimensional phenomena. Concepts: events; state machines; chained systems.
5. **Curiosity Mastery** — the player invents experiments; the laboratory becomes a creative sandbox.

---

# 25. Reaction Resolver Architecture

Avoid a giant hardcoded recipe matrix.

```text
Ingredient: Elements · Properties · Affinities · Energy · Stability · State · Transformations · Special Hooks
Experiment: Ingredients · Ingredient States · Quantities · Order · Temperature · Processing · Environment · Apparatus · Duration

Reaction Resolver → Property Interactions → Synergies / Conflicts → Instability Calculation
→ Reaction Family → Specific Effect → World Consequence → Discovery / Journal Entry
```

Then add hand-authored special combinations on top.

---

# 26. Systemic + Authored Hybrid

**Systemic reactions** (from properties): broad experimentation; emergent gameplay; fewer authored combinations; meaningful predictions.

**Authored special reactions**: memorable moments; narrative discoveries; easter eggs; boss / quest mechanics; rare spectacular results. E.g. `Moonflower + Echo Crystal + Void Dust` upgraded from a generic void/replication reaction into **Pocket Universe**.

---

# 27. Suggested Data Model

```json
{
  "id": "echo_crystal",
  "name": "Echo Crystal",
  "elements": ["crystal"],
  "properties": { "replication": 1.0, "resonance": 0.9, "space": 0.4 },
  "stability": 0.85,
  "states": ["raw", "crushed", "charged"],
  "reactions": { "heat": "charge", "cold": "dampen" }
}
```

```json
{
  "ingredients": [
    { "id": "red_mushroom", "state": "raw", "quantity": 1 },
    { "id": "echo_crystal", "state": "charged", "quantity": 1 }
  ],
  "temperature": 2,
  "stirs": 3,
  "apparatus": "cauldron",
  "environment": ["moonlight"]
}
```

---

# 28. Initial Reaction Rules for Prototype

Suggested first set: Red Mushroom; Echo Crystal; Ember Seed; Moonflower; Void Dust; Life Sap; Frost Dew; Star Dust.

```text
Echo Crystal + Organic          → Duplication Bloom
Echo Crystal + Organic + Life   → Cute Monstrosity
Fire + Energy + Heat            → Fireball
Void + Energy                   → Pocket Singularity
Void + Time                     → Temporal Rupture
Growth + Life + Water           → Impossible Overgrowth
Moon + Crystal + Stabilizer     → Focus Potion
High Instability                → Spectacular Explosion
```

---

# 29. Prototype Scope

Vertical slice goal: prove the laboratory feels like a **playground rather than a recipe screen**.

- **Environment** — one pixel-art laboratory scene; central cauldron; ingredient shelf; physical Curiosity Journal; owl mentor; one creature / cat; basic workbench props.
- **Ingredients** — 8 systemic ingredients.
- **Manipulation** — drag ingredient; tap-to-add fallback; remove ingredient; change heat; brew / observe; clear experiment.
- **System** — property tags; synergy rules; instability; at least 8 reaction outcomes; persistent discoveries during session.
- **Feedback** — particles; room reactions; object animation; sound hooks; owl reactions; journal entry.

---

# 30. Second Prototype Step

Add physical processing: mortar; burner; cooling plate; scale. New ingredient states: crushed; heated; frozen. Verify `Raw Mushroom + Crystal` and `Frozen Mushroom + Crystal` produce meaningfully different outcomes.

# 31. Third Prototype Step

Environmental ingredients: candle flame; moonlight; water; creature feather — dragged directly from the scene. Test the moment the player realizes the background itself is part of the experiment system.

# 32. Fourth Prototype Step

A small Rune Automation Board supporting `WHEN`, `IF`, `REPEAT`, `UNTIL`. Not mandatory — a new magical tool for players who already understand the underlying experiment.

---

# 33. UX Rules

1. Large tablet-friendly hit targets.
2. No essential hover interaction.
3. Drag always has tap alternative.
4. Immediate visual and audio response.
5. Interesting result within seconds.
6. Unknown combinations remain worth trying.
7. Avoid large blocking modal dialogs.
8. Keep the laboratory visible during experiments.
9. Use physical world objects as UI whenever possible.
10. Never punish curiosity.

---

# 34. Feedback Language

| Instead of | Use |
|---|---|
| Incorrect recipe. | Interesting. The crystal rejected the mixture. |
| Failed. | Unexpected Reaction! |
| Wrong ingredient. | The mushroom doesn't seem to resonate with this yet. |

---

# 35. Audio Direction

Compatible — gentle resonance, musical chime. Unstable — rattling glass, increasing hum. Void — low warped tone. Time — reversed bell, ticking. Duplication — repeated pop. Life — tiny chirps / heartbeat. Fire — crackle. Discovery — short magical motif. Audio becomes another clue.

---

# 36. Animation Direction

Cauldron bubbling; ingredients floating before dropping; shelf jars wobbling; crystal resonance; leaves reacting to magic; owl head tracking experiment; cat reacting to explosions; books fluttering; portal distortion; duplicated objects bouncing; vines physically growing; fireball crossing the room. The laboratory should feel alive even when the player is idle.

---

# 37. Educational Philosophy

Teach through systems rather than exposition: cause and effect; classification; prediction; experimentation; iteration; observation; debugging; sequencing; variables; conditions; loops; events; state; automation. The child should often learn the concept before learning the programming term.

---

# 38. Core Design Rule

> ## If the child asks, “I wonder what happens if...”, the game should try very hard to have an answer.

Sometimes **BOOM.** Sometimes “Congratulations. You created Steve.” Sometimes 64 mushrooms appear. Sometimes half the workbench briefly disappears through a portal. Sometimes the player discovers a genuinely important rule.

---

# 39. Recommended Next Implementation Order

1. Scene Foundation — pixel-art laboratory composition; responsive tablet interaction layer; draggable ingredient shelf; cauldron drop target; Curiosity Journal; basic mentor reactions.
2. Systemic Ingredient Model — properties; affinities; state; stability; synergy resolver.
3. Reaction Engine — elemental; duplication; growth; transformation; space; time; creature; instability outcomes.
4. World Consequences — visible room effects; temporary scene state; creatures; object transformation; portals; environmental animation.
5. Processing Stations — mortar; burner; cooling; scale; resonator.
6. Environmental Ingredients — moonlight; flame; smoke; creature drops; water; hidden interactive props.
7. Discovery Graph — persistent ingredient knowledge; reaction discoveries; Curiosity Journal; unknown-property hints.
8. Coding Bridge — Rune Automation Board; conditions; loops; signals; saved procedures.
9. Camp / Quest Integration — found ingredients; creature materials; quest experiments; crafted exploration tools; rewards feeding back into the world.

---

# 40. Final Product Identity

Somewhere between: magical alchemy workshop; systemic toy; discovery sandbox; lightweight simulation; coding-learning environment; RPG crafting system. Never: “Potion menu.”

> **A magical place where children can touch things, combine ideas, break the rules, observe what happens, and slowly understand the hidden systems of the world.**
