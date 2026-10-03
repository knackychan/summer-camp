# Summer Quest — Learning Runtime + Planet Home Plan
**Date:** 2026-09-23  
**Version:** v0.2.4-plan  
**Purpose:** Extend the Summer Quest redesign plan with:
1. an AI-assisted tuition architecture for math, language, history, geography, and science;
2. a new child-facing main screen built as an explorable interactive world/planet;
3. a pre-reader interaction model for very young children (around 3–4 years old) that does not depend on reading or AI chat prompts.

---

## 1. New Direction Added to the Global Plan

Summer Quest should not only recommend chores, routines and games.

It should also become a **real adaptive tuition platform** where the AI can help create and adapt educational experiences in:

- math;
- language;
- history;
- geography;
- science.

The important principle is:

> **The AI should act like a tutor and lesson orchestrator, not like a worksheet generator or uncontrolled chatbot.**

The educational part of Summer Quest should become another core pillar of the world, alongside:

- quests and chores;
- routines and self-care;
- games and mini-games;
- exploration;
- rewards and progression.

---

# 2. Product Goal

Summer Quest should evolve toward:

> **A kid-friendly interactive world where children can explore activities, discover educational content, complete real-life quests, and receive adaptive help from an AI tutor/assistant.**

This world must support two broad modes:

## 2.1 Guided Mode
For children old enough to understand choices and small prompts.

Used for:
- quest suggestions;
- adaptive tutoring;
- contextual help;
- short guided learning sessions;
- routine nudges.

## 2.2 Exploratory Mode
For younger children, especially pre-readers around 3–4 years old.

Used for:
- icon-based world exploration;
- free discovery of mini-activities;
- tap-based navigation;
- low-text or no-text interaction;
- direct access to mini-games and learning toys;
- simple environmental cues instead of AI questioning.

This means the home experience must support both:

- **assistant-guided intentional activity selection**;
- **self-directed playful exploration**.

---

# 3. Learning Runtime — Core Principle

The AI should not directly generate arbitrary HTML, JS, or lesson UIs.

Instead, the AI should compose experiences from a **trusted educational component system**.

The runtime model becomes:

```text
CURRICULUM
    ↓
STUDENT MODEL
    ↓
AI TUTOR
    ↓
LEARNING SCENES
    ↓
INTERACTIVE RUNTIME
```

---

# 4. Learning Runtime Architecture

## 4.1 Curriculum Layer

This defines what should be taught.

It contains:

- subjects;
- topics;
- skills;
- prerequisites;
- age bands;
- difficulty progression;
- approved factual content;
- target competencies.

Example:

```text
MATH
- counting
- addition
- subtraction
- multiplication
- fractions
- measurement
- geometry

LANGUAGE
- vocabulary
- phonics
- sentence building
- grammar
- reading comprehension
- spelling

HISTORY
- timelines
- cause/effect
- people
- places
- eras
- simple civic/historical narratives

GEOGRAPHY
- places
- maps
- regions
- directions
- continents
- weather/environment

SCIENCE
- plants
- animals
- matter
- forces
- body
- ecosystems
- planets
- weather
```

The curriculum layer is the **truth layer**.

The AI does not define the curriculum.

---

## 4.2 Student Model

This tracks what the child currently knows and where help is needed.

Example tracked data:

- skills attempted;
- correct/incorrect answers;
- hint usage;
- mastery estimate;
- repeated error patterns;
- recent success/fatigue;
- preferred interaction style;
- age band and reading level.

Example conceptual structure:

```text
MATH
  addition: 0.90
  subtraction: 0.76
  multiplication: 0.52
  fractions: 0.21

LANGUAGE
  reading: 0.48
  vocabulary: 0.71
  grammar: 0.39

SCIENCE
  plants: 0.80
  matter: 0.42
```

The values are for internal adaptation only.

Children should see progress in game terms, not as raw percentages.

---

## 4.3 AI Tutor

The AI tutor should decide:

- what to practice next;
- whether the child needs an explanation;
- which type of representation is best;
- whether to use text, objects, a map, a timeline, a diagram or a simulation;
- what hint level to give;
- how to phrase the exercise;
- how to react to mistakes.

The AI tutor should **not** create its own arbitrary interface.

It should output structured scene definitions.

---

## 4.4 Interactive Runtime

The app must provide a library of educational interaction components.

Examples:

### Math components
- counting objects;
- number line;
- base-10 blocks;
- fraction bar;
- geometry shapes;
- measuring ruler;
- graph plot;
- drag-and-group quantities;
- compare larger/smaller.

### Language components
- picture-word matching;
- spoken word to object;
- sentence builder;
- syllable/phonics toy;
- letter tracing;
- reading passage;
- word ordering;
- simple comprehension card.

### History components
- timeline;
- event ordering;
- before/after cards;
- cause/effect chain;
- person-place-event association;
- compare periods visually.

### Geography components
- map scene;
- country/region placement;
- direction arrows;
- flag match;
- landmark matching;
- environment sorting;
- globe rotation.

### Science components
- life cycle visualizer;
- water cycle;
- seasons;
- body diagram;
- food chain;
- plant growth;
- matter state simulation;
- force/motion toy;
- simple experiment scene.

The AI selects among these tools.

The app renders them.

---

# 5. LearningScene Protocol

Every educational scene should conform to a common schema.

Example conceptual model:

```ts
interface LearningScene {
  id: string;
  subject: "math" | "language" | "history" | "geography" | "science";
  skillId: string;
  ageBand: string;

  presentation: ScenePresentation;
  prompt: LocalizedText;
  interaction: InteractionDefinition;
  evaluation: EvaluationDefinition;
  hints: HintDefinition[];

  metadata: {
    difficulty: number;
    estimatedSeconds: number;
    readingRequired: boolean;
    audioGuided: boolean;
  };
}
```

Presentation types may include:

- TextScene;
- NumberLineScene;
- FractionScene;
- CountingScene;
- TimelineScene;
- MapScene;
- DiagramScene;
- SortingScene;
- SimulationScene;
- StoryScene.

---

# 6. AI Tutor Use Cases

## 6.1 Math

The AI can detect a misunderstanding and change representation.

Example:

Instead of repeating:

> 14 - 7 = ?

Summer can show:

- countable objects;
- a number line;
- grouped blocks;
- concrete removal actions.

Then the child can manipulate the problem physically.

---

## 6.2 Language

The AI can generate short contextual grammar/vocabulary corrections and sentence-building activities.

Example:
- fix a sentence;
- drag the correct verb;
- match spoken instructions to objects;
- build a phrase from tokens.

---

## 6.3 History

The AI can guide simple understanding through:
- ordering events;
- matching a person to a place;
- before/after scenes;
- simple visual cause/effect.

History should stay grounded in curated content rather than open-ended invention.

---

## 6.4 Geography

The AI can use:
- map placement;
- direction games;
- region recognition;
- visual comparison;
- climate/environment categorization.

---

## 6.5 Science

The AI can use simulations and diagrams:
- water cycle;
- plant growth;
- simple forces;
- weather;
- solar system;
- body parts and functions.

The AI should choose the teaching strategy, not implement the simulation logic itself.

---

# 7. Educational Session Structure

The AI tutor should be able to construct short sessions such as:

```text
1. warm-up
2. main skill practice
3. explanation / visualization
4. retry
5. challenge
6. celebration / wrap-up
```

These should feel like **small adventures** rather than formal lessons.

Examples:
- Math Challenge
- Word Adventure
- Time Traveler Quest
- Map Explorer
- Science Discovery

This fits Summer Quest’s existing quest/progression system.

---

# 8. Home Screen Redesign — Planet / World Interface

The child home screen should move away from a flat menu/dashboard.

The new direction should be:

> **An explorable interactive little world or planet**

This could be a small floating planet / island / world map / diorama where different activity types live in different visible zones.

Possible zones:

- **Home / Bedroom area** → self-care, chores, bedtime, routines
- **School / Brain area** → math, language, history, geography, science
- **Garden / Nature area** → plant care, science, outdoor exploration
- **Play area** → mini-games and free play
- **Kitchen area** → Kitchen Quest / practical activities
- **Adventure / Travel area** → geography/history/story-based content
- **Reward / Treasure area** → rewards, progress, unlocks

The child taps a location/object/character to enter that activity family.

This makes the main screen feel like a **playable world**, not an app launcher.

---

# 9. Planet Home Design Principles

## 9.1 Visual navigation first
The home should be understandable even without reading.

The child should be able to recognize:

- an apple tree / garden = nature, plant care;
- a school/building/brain balloon = learning;
- a bed / toothbrush / bath = self-care;
- a toy chest / carnival / arcade = mini-games;
- a kitchen = cooking and practical tasks.

## 9.2 Direct object interaction
The child should tap visible objects in the world, not read lists.

Examples:
- tap the globe;
- tap the toothbrush;
- tap the watering can;
- tap the book;
- tap the rocket;
- tap the map.

## 9.3 Layered discovery
The world can zoom in:
- world/planet overview;
- zone;
- activity card / micro-world;
- activity itself.

## 9.4 Live state visualization
The world should visually show what is available.

Examples:
- toothbrush sparkles if tooth-brushing is due;
- watering can wiggles if plant care is ready;
- a school bell pulses if learning is suggested;
- reward chest glows if something can be claimed;
- stars/fireflies appear over completed areas.

---

# 10. Planet Home for Older Kids

For older children, Summer can still overlay guidance on top of the planet.

Example:
- Summer appears next to the planet;
- highlights one or more zones;
- asks a short question;
- offers a few recommended activities;
- may pan/zoom to the relevant zone.

But even for older children, they should still be free to explore manually.

---

# 11. Pre-Reader Mode (Ages ~3–4)

For children who cannot read yet, the main interaction should not rely on:

- written prompts;
- text-heavy cards;
- AI asking them questions to answer with text;
- category labels;
- routine descriptions.

Instead, pre-reader mode should rely on:

- icons;
- animation;
- sound cues;
- spoken prompts;
- color and shape coding;
- direct touch exploration;
- extremely simple cause/effect.

---

# 12. Pre-Reader Main Principle

> **The world itself should teach the child how to use it.**

This means:
- clear object identity;
- visual affordances;
- playful reactions to touch;
- audio naming;
- minimal need for explanation.

When the child taps something, it should immediately react.

Examples:
- the globe bounces and says “Map game!”;
- the book opens and shows picture-based activities;
- the number blocks spill out and form a counting game;
- the bath icon splashes;
- the plant leans toward the watering can.

---

# 13. Pre-Reader Exploration Model

Instead of asking:
> “What do you want to do?”

The world should invite exploration through:

- **hotspots**;
- **characters**;
- **objects**;
- **ambient animation**;
- **audio labels**;
- **symbolic landmarks**.

The child can discover:
- mini-games;
- tiny educational toys;
- simple routines;
- object-play experiences.

Examples:
- tap stars to count them;
- drag vegetables into baskets;
- feed an animal the correct shape;
- match colors;
- pour water on a plant;
- clean the toothbrush with foam and brush teeth;
- place historical costumes on a figure;
- rotate a little globe to find animals/continents.

---

# 14. Pre-Reader Learning Without Question Prompts

For young children, AI-driven question selection should be minimized or hidden.

Instead of:
- Summer asking a complex verbal question;
- a quest-selection flow;
- a list of recommended cards;

the system should use:

## 14.1 Discovery toys
Small interactive educational objects embedded in the world.

## 14.2 Audio-guided micro-games
Tap-to-hear and tap-to-act loops.

## 14.3 Character-led demonstrations
A mascot quickly shows what to do.

## 14.4 Progressively unlocked interactions
Very simple mechanics first, then slightly richer.

---

# 15. Pre-Reader Educational Interaction Patterns

Recommended types:

## 15.1 Tap and reveal
- tap a number and hear it;
- tap an animal and hear its name;
- tap a country and hear its sound/flag.

## 15.2 Drag and match
- match shape to hole;
- match object to shadow;
- match fruit to color;
- match flag to country outline.

## 15.3 Count and place
- drag 3 apples into a basket;
- place 2 stars on the sky.

## 15.4 Sequence
- morning routine sequencing;
- plant growth sequence;
- day/night cycle.

## 15.5 Cause and effect
- heat water → steam rises;
- water plant → plant perks up;
- move sun → shadow changes;
- mix colors → new color appears.

## 15.6 Audio recognition
- hear a word and select its picture;
- hear a sound and pick the source;
- hear “brush teeth” and tap the toothbrush.

---

# 16. Two Educational UX Lanes

The design should explicitly support two lanes.

## Lane A — Pre-reader / early learner
- no reading required;
- voice/audio-led;
- discovery-first;
- object/play-first;
- very short loops;
- simple visual world access;
- minimal AI dialogue.

## Lane B — Reader / older child
- short quest recommendations;
- adaptive tutoring;
- AI-assisted explanations;
- learning sessions;
- text-supported exploration;
- richer structured guidance.

The system should be able to switch by age band / profile / parental setting.

---

# 17. Summer’s Role in Pre-Reader Mode

Summer should still exist, but in a different role.

Summer should function more like:
- a mascot;
- a pointer;
- a demo guide;
- a celebrator;
- a helper character.

Not like:
- a text-based assistant asking several questions.

Examples:
- Summer points at the glowing toothbrush;
- Summer says a short line aloud;
- Summer claps after a success;
- Summer demonstrates one motion;
- Summer plays a little animation to indicate what is tappable.

The interaction model should be:
- **show**, not **ask**;
- **demonstrate**, not **explain**;
- **nudge**, not **converse**.

---

# 18. Planet Home Activity Families

Suggested first world families:

## 18.1 Daily Life Island
- brushing teeth;
- shower;
- getting dressed;
- bedtime;
- tidying toys.

## 18.2 Brain Island
- math;
- language;
- memory;
- pattern games;
- early literacy;
- beginner tutoring.

## 18.3 World Explorer Island
- geography;
- history;
- cultures;
- landmarks;
- world facts.

## 18.4 Science Garden
- plants;
- weather;
- animals;
- body;
- little experiments.

## 18.5 Play Park
- mini-games;
- free toy-like interactives;
- skill-based mini challenges.

## 18.6 Reward / Treasure Island
- prize chest;
- stickers;
- cosmetics;
- progression;
- avatar items.

These do not need to be literal “islands”; they can be zones on a single small planet.

---

# 19. Planet Home Technical Layer

The home screen should be treated as an actual application surface, not a static illustration.

It should support:
- pannable/zoomable world;
- hotspot definitions;
- state-driven animations;
- child profile–dependent visibility;
- routine/quest status indicators;
- accessibility modes;
- reduced motion fallback.

Conceptually:

```ts
interface WorldHotspot {
  id: string;
  zoneId: string;
  visualType: string;
  activityFamily: string;
  icon?: string;
  position: { x: number; y: number };
  state: "idle" | "available" | "recommended" | "completed" | "locked";
  audioLabel?: string;
  action: HotspotAction;
}
```

---

# 20. AI + Planet Home Relationship

The AI should not replace the planet home.

Instead:
- the planet home is the **exploration surface**;
- the AI is the **guidance/adaptation layer**.

For older children:
- AI can recommend where to go on the planet.

For pre-readers:
- the planet itself is enough to start.

This preserves autonomy and discoverability.

---

# 21. Quest System Integration

The tuition system should plug into the quest system naturally.

Examples:
- **Math Mission**
- **Word Adventure**
- **Science Discovery**
- **History Time Walk**
- **Map Explorer**

A learning session can become:
- a quest;
- a daily educational target;
- a reward source;
- part of a larger storyline.

For example:

```text
Brain Island Quest
Complete a 10-minute math adventure
+20 coins
+35 XP
```

---

# 22. Mini-Exercises and Mini-Games

The world should contain both:
- structured lessons/quests;
- tiny self-contained play activities.

Examples of mini educational toys:
- counting fireflies;
- sorting objects by size;
- tracing a river on a map;
- moving clouds to make rain;
- matching capitals to flags;
- placing events on a timeline;
- dragging bones to the right body place;
- choosing the right clothing for weather.

These can be available directly from the world with little or no setup.

This is especially important for younger kids.

---

# 23. Main UI Success Criteria

The new home succeeds if:

## For older children
- they feel like they are entering a world, not an app menu;
- they can follow Summer’s guidance without feeling constrained;
- they can still explore on their own;
- learning feels integrated with play.

## For younger/pre-reader children
- they can start something fun or educational without reading;
- they understand where to tap through visual cues;
- they receive immediate feedback;
- the world feels safe and explorable;
- they do not depend on typed/chat-like dialogue.

---

# 24. Recommended Next Build Priorities

## Priority 1 — Plan and architecture
- define Learning Runtime module;
- define curriculum model;
- define student model;
- define LearningScene schema;
- define interactive component families.

## Priority 2 — Planet Home concept
- design the world map / small planet structure;
- define activity zones;
- define hotspot states and motion.

## Priority 3 — Pre-reader mode
- define audio-led interaction patterns;
- define no-reading activity access;
- define object-led micro-games.

## Priority 4 — First educational vertical slice
Build one real end-to-end path, for example:
- Math basic scene set;
- student model;
- AI tutor scene selection;
- Brain Island access;
- one mini learning quest.

## Priority 5 — Expand to subjects
Then expand to:
- language;
- science;
- geography;
- history.

---

# 25. Final Design Intention

Summer Quest should become:

> **A playful explorable world where children can independently discover activities, receive adaptive AI-assisted tutoring, complete real-life and educational quests, and grow through a unified game-like progression system.**

The home should feel like a **small living world / planet**.

The learning system should feel like a **real adaptive tuition engine**.

The youngest children should be able to **explore and learn without reading**.

The older children should benefit from **structured adaptive guidance and tutoring**.

This addition should now be considered part of the global Summer Quest product direction.
