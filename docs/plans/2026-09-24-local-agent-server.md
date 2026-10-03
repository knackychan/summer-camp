# Summer Quest v0.3.3 — Local/LAN Agent Server
**Date:** 2026-09-24

## Goal

Make the existing Summer Quest prototype actually runnable with live LLM providers on the family computer and tablets without putting OpenAI, Anthropic or OpenRouter keys in browser code.

This milestone deliberately does **not** redesign the child UI. It turns the provider architecture from v0.2.7–v0.3.2 into a usable local runtime.

## Runtime

```text
Windows / family computer
┌─────────────────────────────────────────────┐
│ Summer Quest Node server                    │
│                                             │
│ static existing UI                          │
│ /js/config.js (generated, public fields)    │
│ /api/summer-agent                           │
│ /api/summer-agent/health                    │
│                                             │
│ server-only keys                            │
│   OpenAI / Anthropic / OpenRouter           │
└──────────────────────┬──────────────────────┘
                       │ LAN
              ┌────────┴────────┐
              │                 │
           tablet A          tablet B
```

The tablet only receives a same-origin endpoint URL. Provider keys never appear in the PWA, dynamic config, API response, health response or static files.

## Two launch modes

### Child-safe

```sh
npm run agent:serve
```

- manual routing remains server-authoritative;
- only the configured default/allow-listed profiles can run;
- browser profile override is off by default;
- default rate limit is 60 agent calls per client/minute.

### AI Lab

```sh
npm run agent:serve:lab
```

- explicitly developer-only;
- browser profile override is enabled;
- model profiles are exposed only for providers whose server key is configured;
- development-only profiles can be tested;
- default rate limit is 180 calls/client/minute for sequential evaluation suites.

## Environment

Copy:

```text
server/agent-proxy/.env.example
```

to:

```text
server/agent-proxy/.env
```

Provider keys live only there or in the process environment.

The local server dynamically serves `/js/config.js`, so the existing UI automatically receives:

- `/api/summer-agent`;
- `/api/summer-agent/health`;
- the default model profile;
- request timeout;
- optional public Supabase/ntfy values.

## Safety / hardening included in prototype

- 64 KB default agent request body limit;
- per-client request throttling;
- no CORS enablement for arbitrary origins;
- static denial of `.env`, dotfiles, `server/`, `packages/`, `scripts/`, `supabase/`, `node_modules/` and other implementation directories;
- health endpoint contains readiness booleans/profile metadata only, never credentials;
- structured response validation remains in `AgentProxyService`;
- API keys are never serialized to the child.

This is appropriate for a trusted home/LAN prototype. It is **not** an Internet-facing production server and should sit behind a proper authenticated deployment boundary if exposed outside the LAN.

## AI Lab integration

Operations → AI Lab now reads `/api/summer-agent/health` when available.

It shows whether the local server is online and which provider families have a key. Model profile checkboxes are disabled when:

- the corresponding provider has no server key; or
- the server allow-list does not permit that profile.

This prevents fake comparisons where the UI requests a model that cannot actually run.

## Windows convenience

Two double-click launchers are included:

- `START-SUMMER-QUEST.cmd`
- `START-SUMMER-QUEST-AI-LAB.cmd`

They keep the existing browser UI and only change the backend launch policy.

## Validation

New test: `npm run test:agent-server`

It verifies:

- `.env` parsing;
- runtime browser config contains no provider key;
- health endpoint;
- static UI serving;
- secret/server paths return 404;
- no-key agent requests fail safely;
- ephemeral port startup/shutdown.

Existing agent routing, learning, vocabulary, AI evaluation, mobile architecture, Brain, registry and core suites must remain green.
