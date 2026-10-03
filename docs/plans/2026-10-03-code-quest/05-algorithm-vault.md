# Code Quest RPG v0.5 — Algorithm Vault

## Goal
Move Code Quest from “written action scripts” into a real introductory programming model while preserving the deterministic, step-able dungeon RPG runtime.

## New programming concepts

### Immutable local variables
```js
let steps = 5;
repeat(steps, () => {
  hero.move();
});
```

Variables are scalar-only and bounded. Assignment after declaration is intentionally not part of this teaching subset yet.

### Function parameters and arguments
```js
function walk(steps) {
  repeat(steps, () => {
    hero.move();
  });
  return steps;
}

let moved = walk(3);
```

Functions support up to three parameters. Calls support up to three arguments. Recursion remains forbidden.

### Return values
A function can finish visible dungeon actions and then return a scalar value. The calling program can store that value in a `let` declaration and use it later.

### Safe expressions
Allowed expression concepts:
- numbers, booleans and short strings
- variables
- `+ - * /`
- `< <= > >= === !==`
- `&& || !`
- parentheses
- whitelisted RPG property reads

No mutation, arrays, arbitrary objects, dynamic property access, constructors, loops such as `while`, globals, DOM or network APIs are available.

### RPG object/property API
Readable properties:
```js
hero.hp
hero.maxHp
hero.keys
hero.weapon.damage
hero.armor.defense
hero.inventory.healing
hero.inventory.focus
hero.inventory.antidote
hero.inventory.ward

enemy.hp
enemy.maxHp
enemy.armor
enemy.distance
enemy.incoming
```

These values are supplied by the pure dungeon model through the interpreter environment. Source code never receives a live JavaScript object.

## Algorithm Vault curriculum

- **q25 Variable Steps** — variable-driven Repeat
- **q26 Parameter Passage** — parameters, arguments and a return value
- **q27 Return Gate** — branch using a function result
- **q28 Inspect the Enemy** — calculate attacks from `enemy.hp / hero.weapon.damage`
- **q29 Inventory Logic** — combine live HP and potion inventory with `&&`
- **q30 Rune Warden** — multi-turn boss algorithm using parameters, return values, live armor, incoming-shot state and final escape logic

## Rune Warden
The Warden is a real multi-phase enemy:
1. starts armored;
2. after its armor phase breaks, telegraphs ranged attacks;
3. at low HP it becomes a close-range threat.

The reference solution is deliberately reusable across turns rather than being a fixed cinematic sequence.

## Programmable potion bench
The existing physical potion lab remains authoritative for ingredients, recipe order and inventory consumption. v0.5 adds a second older-child surface over the same model:

```js
bench.add("sunHerb");
bench.add("sunHerb");
bench.add("waterCrystal");
bench.grind();
bench.stir();
bench.bottle();
```

`alchemy-code.js` parses this tiny method language into operations and passes the resulting tray/process to `brewLab`. It does not evaluate JavaScript.

## Save format
Profile version is now **v3**. v1 and v2 profiles migrate locally and deterministically. v3 adds no raw learner-code persistence requirement; existing progression, inventory, equipment and recipe fields remain bounded.

## Safety / determinism
- no `eval`
- no `new Function`
- no browser globals
- no network APIs
- no computed properties
- no post-declaration assignment
- no recursion
- bounded source/tokens/nodes/nesting/calls/variables/repeats
- live properties are read through an explicit model API

## Patch contract
v0.5 is a drop-in upgrade over untouched Code Quest v0.1–v0.4 files. Unknown local modifications stop installation unless the user explicitly opts into `--force`.
