# Agentic Risk Command Centre

A dashboard that lets a business see every AI agent it runs, what each one can
reach, and where it stands against the **OWASP Top 10 for Agentic Applications**
(2026 edition, ASI01–ASI10).

## Running it

```bash
npm install
npm run dev
```

## The four surfaces

| Tab | Who it is for | What it answers |
| --- | --- | --- |
| **Flight Deck** | Security operations | If this agent is compromised at 3am, what does it reach? |
| **OWASP Live** | Compliance managers | Which agents pass, partially pass, or fail each of the ten risks? |
| **Guided Review** | Anyone, no expertise needed | A six-question assessment that needs no integration at all. |
| **Agent Workforce** | Risk, audit and business owners | Who owns this agent, and when does its access expire? |

An **advisor** is available from every tab. It answers only from the register in
`src/lib/data.ts` and states the basis for every answer, so no claim it makes is
unverifiable.

## How the scoring works

Three measures appear throughout, and they are deliberately not independent
opinions:

- **Authority** — how much an agent can do alone. Higher is more dangerous.
  Drives ASI02, ASI03, ASI05 and ASI08.
- **Oversight** — how much human checking surrounds it. Higher is safer.
  Drives ASI01, ASI06, ASI09 and ASI10.
- **Standing** — the mean of the agent's ten OWASP control scores. Authority and
  Oversight are the plain-English drivers behind those ten.

One set of thresholds is used on every screen: **70 and above** is green
(control in place), **50–69** amber (partial), **below 50** red (missing). They
live in `src/lib/scoring.ts` as `PASS_THRESHOLD` and `PARTIAL_THRESHOLD`.

## Layout

| Path | Holds |
| --- | --- |
| `src/lib/types.ts` | The domain model. |
| `src/lib/owasp.ts` | The ten risks as the screens name them: title, one-line description, what compliance means. |
| `src/lib/risks/` | One module per risk, holding the standard's own prevention and mitigation guidelines, the fix guidance for each, and the published attack scenarios. Adding a risk is a change to that risk's file alone. |
| `src/lib/mitigations.ts` | The index over those modules. A risk not transcribed yet resolves to undefined and the screens say so plainly. |
| `src/lib/controls.ts` | Where an agent stands against each published control, so a risk score can be challenged cell by cell. |
| `src/lib/scoring.ts` | Thresholds, bands and every roll-up. Nothing recomputes these locally. |
| `src/lib/data.ts` | Demonstration register. **Replace this module with real ingestion**; no component reaches for agent data directly. |
| `src/components/` | One file per surface, plus the shared UI kit, detail drawer and advisor. |

## Status

Every screen runs on demonstration data for a fictional customer, Northwind
Group. The ingestion layer — guided self-assessment, agent configuration,
identity and cloud connectors, and live activity telemetry — is not built yet.

The standard's control detail is being transcribed one risk at a time, and
per-agent control assessments are wired up separately in `src/lib/controls.ts`.
Neither is complete for all ten risks, so the screens state which risks carry
transcribed detail and which carry a per-agent assessment rather than implying
every score is control-derived.
