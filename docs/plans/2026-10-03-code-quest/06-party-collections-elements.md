# Code Quest RPG v0.6 — Party Collections & Elements

## Goal
Move Code Quest from single-target programming into deterministic multi-entity dungeon algorithms. The child should have a concrete reason to learn collections, indexing and target selection: several enemies are present at once and the chosen target changes the outcome.

This release intentionally stops short of general JavaScript arrays. The teaching surface is a small read-only **active-enemy collection** backed by the pure dungeon model.

## Active enemy collection

The written-code layer can read:

```js
let count = enemies.length;
let firstHp = enemies[0].hp;
let firstArmor = enemies[0].armor;
```

Supported indexed fields are:

- `hp`
- `maxHp`
- `armor`
- `distance`
- `element`
- `alive`

Only literal indices `0`, `1`, `2`, or `3` are accepted. Dynamic indexing such as `enemies[i]`, mutation, `.push()`, `.map()`, custom iterators and arbitrary object access remain outside the safe language.

`enemies` contains the **currently living enemies** in deterministic model order. When an enemy is defeated, the active collection shrinks and later members may move to a lower index. This makes collection state visibly change during combat without retaining stale object references.

Aggregate reads are also available:

```js
enemies.length
enemies.armoredCount
enemies.weakCount
enemies.burningCount
enemies.frozenCount
```

## Target selection

A new AST `target` node supports a bounded expression but runtime selection is restricted to indices `0..3`.

Written code can use:

```js
hero.target(0);
hero.cast();
```

The visual/card layer can also select semantic targets:

```js
hero.targetNearest();
hero.targetWeakest();
hero.targetArmored();
hero.targetElementWeak();
```

The hero keeps `targetId` in model state. If the selected enemy disappears, normal deterministic fallback targeting can choose an available target where appropriate.

## Elemental weapons

The RPG combat stat surface now exposes:

```js
hero.weapon.damage
hero.weapon.range
hero.weapon.spellDamage
hero.weapon.element
```

v0.6 adds:

- **Ember Wand** — Fire spell weapon
- **Frost Scepter** — Frost spell weapon
- **Seeker Lens** — charm increasing spell range

`hero.cast()` is deliberately separate from `hero.attack()`. Existing melee behavior is retained exactly so old quests do not silently change when the profile owns magic equipment.

### Elements

Current elements:

- Neutral
- Fire
- Frost

Some creatures declare an elemental weakness. Casting the weak element adds damage. Casting the creature's own element applies resistance and reduces damage.

### Status effects

Fire can apply a short **Burn** status. Burn damage resolves before the affected enemy's normal world-turn action.

Frost can apply **Freeze**. A frozen enemy skips its next eligible world turn.

Both states are represented in the deterministic model and surfaced visually in the angled dungeon renderer.

## Element Nexus curriculum

- **q31 Enemy Collection** — read `enemies.length`
- **q32 Indexed Target** — inspect `enemies[0].hp`, choose `hero.target(0)`, then cast
- **q33 Element Match** — select elementally weak targets and observe weakness/resistance
- **q34 Freeze the Turn** — use Frost to change a later world turn
- **q35 Target Algorithm** — compare semantic target selectors such as armored and weakest
- **q36 Nexus Array** — combine collection length, functions, parameters/returns and changing target state in a multi-enemy encounter

The region appears after Algorithm Vault, so children encounter collections only after variables, functions, parameters, return values and safe property reads already have concrete meaning.

## Infinite Tower

The deterministic room-family count grows from eight to ten:

1. traversal
2. combat
3. treasure
4. traps
5. key / locked door
6. armored enemy
7. venom enemy
8. telegraph / archer
9. multi-enemy collection
10. elemental combat

Automated verification is extended through floors **1–480**.

## Profile format

Profile schema is now **v4**. v1, v2 and v3 profiles migrate locally and deterministically. v4 adds no network identity or raw-code authority; existing progression, inventory, equipment, recipes and Endless Tower state remain bounded browser-local data under the host's existing storage authority.

## Safety / determinism

v0.6 preserves all previous restrictions:

- no `eval`
- no `new Function`
- no DOM or browser globals
- no network APIs
- no computed/dynamic property access
- no general arrays or collection mutation
- no post-declaration assignment
- no recursion
- bounded source, nodes, nesting, calls, variables, repeats and target indices
- all live RPG values are supplied through the pure model read/test API

## Patch contract

v0.6 is a drop-in upgrade over untouched Code Quest v0.1–v0.5 files. Unknown local Code Quest modifications stop installation unless `--force` is explicitly requested.
