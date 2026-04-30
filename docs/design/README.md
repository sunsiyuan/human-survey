# Design docs

Per-feature design rationale and implementation plans. Read these to understand *why* a feature is shaped the way it is — the user-facing API reference lives at [`/docs`](https://www.humansurvey.co/docs) and architecture overview at [`../architecture.md`](../architecture.md).

Conventions:

- One feature → one master doc (e.g. `async-results-loop.md`). Phase plans live next to it (`-phase1.md`, `-phase2.md`, …) when the work was multi-phase.
- Docs are dated by ship, not by start. Once the feature ships, the doc captures *what was actually built*; out-of-scope sections record what was deferred and why.
- New design docs land here before code. Plan, review, then implement — the doc is the contract.

## Active / shipped

| Doc | Status | Topic |
|---|---|---|
| [async-results-loop.md](./async-results-loop.md) (+ phase 1 / 2 / 3) | shipped 2026-04-30 | Cursor reads, completion webhook on all terminal events, threshold notification — primitives that let agents exit and be woken instead of polling for hours. |
| [l1-embed-plan.md](./l1-embed-plan.md) | shipped 2026-04-27 | Iframe embed (`?embed=1`) for hosting `/s/{id}` inside third-party onboarding / lead-capture flows. postMessage protocol for `loaded` / `resize` / `submitted`. |

## See also

- [`../architecture.md`](../architecture.md) — high-level system shape (agent → MCP → API → Postgres).
- [`/docs`](https://www.humansurvey.co/docs) — user-facing API reference.
- [`/llms-full.txt`](https://www.humansurvey.co/llms-full.txt) — full machine-readable reference for AI agents.
