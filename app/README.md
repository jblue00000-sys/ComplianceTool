# Agentic Risk Command Centre

A dashboard that lets a business see every AI agent it runs, what each one can
reach, and where it stands against the **OWASP Top 10 for Agentic Applications**
(2026 edition, ASI01–ASI10).

## Running it

```bash
npm install
npm run dev
```

## The surfaces

| Tab | Who it is for | What it answers |
| --- | --- | --- |
| **Flight Deck** | Security operations | If this agent is compromised at 3am, what does it reach? |
| **OWASP Live** | Compliance managers | Which agents pass, partially pass, or fail each of the ten risks? |
| **Remediation** | Whoever has to fix it | Which control gaps are open, who owns them, and in what order? |
| **Guided Review** | Anyone, no expertise needed | A six-question assessment that needs no integration at all. |
| **Agent Workforce** | Risk, audit and business owners | Who owns this agent, and when does its access expire? |

The controls the standard asks for are transcribed for ASI01–ASI04. In OWASP
Live, expanding an agent's row against a risk nobody has assessed them on lists
each control's number, name and one-line description; against an assessed risk
it lists the number, the short label and the evidence behind that agent's
status. The full **control detail** — the standard's own guideline wording, the
steps that close it with their worked examples, effort, team and verification —
is rendered only for ASI01, the one risk the agents have been assessed against.

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
| `src/lib/owasp.ts` | The ten risks as a catalogue: name, one-line description, and what compliant means. |
| `src/lib/risks/` | One module per risk, holding the controls and attack scenarios transcribed from the standard, plus the shape they share. ASI01–ASI04 are transcribed; the rest are stubs carrying the published counts. |
| `src/lib/mitigations.ts` | The index over those modules: detail lookup, whether a risk is transcribed, and the coverage counts. |
| `src/lib/controls.ts` | Per-agent control assessments, held per risk. Only ASI01 has an assessment matrix; a risk without one has no per-agent status, and every screen says so rather than borrowing another risk's ratings. |
| `src/lib/scoring.ts` | Thresholds, bands and every roll-up. Nothing recomputes these locally. |
| `src/lib/data.ts` | Demonstration register. **Replace this module with real ingestion**; no component reaches for agent data directly. |
| `src/components/` | One file per surface, plus the shared UI kit, detail drawer and advisor. |

## Status

Every screen runs on demonstration data for a fictional customer, Northwind
Group. The ingestion layer — guided self-assessment, agent configuration,
identity and cloud connectors, and live activity telemetry — is not built yet.

Control detail is transcribed for ASI01–ASI04; ASI05–ASI10 show the catalogue
entry only. Per-agent control assessments exist for ASI01 alone, so the other
risks show the published controls without a per-agent verdict.
