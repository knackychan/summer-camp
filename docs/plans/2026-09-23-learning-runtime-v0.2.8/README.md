# Summer Quest v0.2.8 — Learning Runtime + AI Math Hint Vertical Slice

## Scope

This slice deliberately **does not redesign the child UI** and does not continue the 3D planet work.
It builds the reusable learning/runtime layer underneath the existing Summer Quest surfaces so the current UI can host real adaptive activities first.

## What is implemented

### Learner profile

`packages/learning/src/LearnerProfileStore.ts`

Keeps only the learning information required by the runtime:

- kid ID locally;
- age;
- language;
- reading level (`pre_reader`, `early_reader`, `reader`);
- per-domain level for math/language/logic.

Provider requests do **not** send the kid ID or exact age. They use an age band.

### Learning sessions

`LearningSessionEngine` owns attempts and deterministic adaptation.
Every five new attempts:

- 5/5 correct → level +1;
- 4/5 correct → maintain;
- 2–3/5 correct → maintain + support signal;
- 0–1/5 correct → level -1.

The LLM does not control difficulty progression.

### Deterministic Math runtime

Math questions and answer truth remain local.
The first supported question type is addition/subtraction practice with a difficulty ceiling.

The LLM is used only after the application already knows the answer was wrong and a hint would add value.

### Structured `lesson_hint` task

v0.2.7 already had provider-neutral routing. v0.2.8 extends that same gateway with a task-specific response contract:

```json
{
  "kind": "lesson_hint",
  "message": "Start at eight and count seven more.",
  "messageZh": "從八開始，再往前數七個。",
  "strategy": "count_forward",
  "emotion": "encouraging"
}
```

Allowed strategies are finite and application-owned:

- `count_forward`
- `count_backward`
- `make_ten`
- `objects`
- `number_line`
- `retry`

The model cannot send HTML, arbitrary UI instructions, a score, a new correct answer, or a progression decision.

### Presentation adaptation

The response strategy is converted locally into a presentation plan.

For a reader/early reader, text can accompany the visual hint.
For a pre-reader, the same hint becomes `visual_audio` and hides explanatory text.

The local application still computes number-line steps/object groups from the trusted Math question.

### Offline fallback

`MathHintService` tries the protected AI endpoint when configured.
If the endpoint is absent, times out, returns invalid data, or is offline, it silently uses a deterministic local hint.

An unavailable LLM therefore never blocks the exercise.

## Provider architecture

The existing v0.2.7 manual routing remains unchanged:

```text
Activity / Learning Runtime
          ↓
     AgentHttpClient
          ↓
 protected server endpoint
          ↓
   AgentProxyService
          ↓
   ManualModelRouter
          ↓
OpenAI / Anthropic / OpenRouter
```

No automatic model escalation is added in this slice.

## Validation

New focused command:

```sh
npm run test:learning
```

It checks:

- learner normalization/storage;
- five-attempt adaptation windows;
- deterministic Math generation;
- privacy-shaped hint context;
- pre-reader presentation conversion;
- remote structured hint validation;
- provider usage metadata preservation;
- offline/local fallback.

`test:agent-routing` also covers the new task-specific JSON schema and `lesson_hint` routing.

## Next integration step

Wire this runtime into the **existing** Summer Quest Math / Brain Gym surface rather than creating another navigation shell.
The UI should only gain the minimum controls required for the exercise:

1. local question;
2. local answer validation;
3. existing feedback animation;
4. `Hint` action after a wrong attempt;
5. rendered structured hint;
6. session attempt stored;
7. next local question.

No planet/home redesign is required for that step.
