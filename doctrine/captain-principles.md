# Captain principles

Standing principles that hold for every application this captain builds.

This file is tracked, so it travels with every clone of this environment and is printed at session start in every instance with no copying step.
It is the universal half of the captain's operating record; the instance-local half stays in each home's gitignored `data/captain.md`, which extends this file and never restates it.
[`docs/configuration.md`](../docs/configuration.md) owns what belongs here versus locally, and how an improvement reaches another instance.
Change it through the ordinary firstmate branch, pipeline, and PR path, then let each instance fast-forward; never hand-edit one instance's copy.

## Hard privacy boundary

- **This environment is private to the captain's own accounts and devices.**
  Never push, publish, contribute, or otherwise send anything to the upstream project this environment was copied from, or to any other outside destination.
  Captain's words: "never edit or never send anything to where First Mate was copied from... Never ever to share anything outside of the environment that we are in right now."
- **Nothing may contact any GitHub account or repository outside the captain's own**, and that covers fetching, not only pushing.
  Captain's words: "nothing should ever contact any github account / repo etc outside my own one."
- A new instance therefore holds no remote pointing outside the captain's account.
  For this environment repository the only sanctioned remote is the captain's own private backup repository, and application repositories likewise live only under the captain's own account.
  If a clone inherits an upstream remote, remove it rather than relying on discipline not to push.
- Accepted consequence, decided knowingly: an instance can no longer pull upstream updates for the environment itself, and `/updatefirstmate` refreshes only from the captain's own remote.
  Treat that as intended unless the captain says otherwise.

## Engineering principles

- **Never weaken a safety fix to make a downstream bug go away - fix the root cause.**
  Stated explicitly when a bug was traced to a classifier instruction gap sitting upstream of a deliberately fail-closed authorization check.
  The check was correct; the fix belonged upstream.
  This principle has recurred since and is standing.
- **Build ahead of need when the capability will eventually matter.**
  The captain overrode a research report's own "wait until there's real data" recommendation for graph-based retrieval: "it's worth building now because eventually there will be information being updated into the system to make it useful."
  The captain has since made the same override a second time, on audit indexing, so treat it as the standing bias rather than a one-off.
- **Prefer the simplest direct path; keep performance acceptable.**
  On retry logic: "maybe do three retries if that's the right way to do it. But as long as it's still providing a speedy performance that would be good."
- **Prefer self-hosted open-source components over hosted vendor tiers.**
  Two independent decisions set this: self-hosted tracing chosen over the vendor's hosted product, and an identity stack restricted to its open-source self-hosted distribution, never the vendor's hosted network, paid tiers, API keys, or enterprise-only features.
  It also follows directly from the privacy boundary above.
- **Audit and log the shape of a request, never verbatim user content**, and never fix a leak by bolting guess-based prose filters onto the audit path.
  A deliberate exception must be chosen knowingly and recorded where it applies, not assumed.
- **Services the environment depends on must be durable, not manually started**: they run across reboots and restart after a crash.

## Worker model and effort

- **All workers run Opus 5 at high effort.**
  Pass `--model claude-opus-5 --effort high` on every spawn, and keep the standing rule in each home's `config/crew-dispatch.json`.
  This standing captain preference outranks the generic effort fallback in `AGENTS.md` section 4, which must not be applied to any dispatch.
- The choice was earned rather than assumed: Fable 5 (2026-08-05), then Opus at medium (2026-08-07, during a credit crunch), then Opus at high (2026-08-08) on the worker-model research finding that medium sits below the vendor default and suppresses tool calls, which in turn degrades a cold worker's orientation from a project's committed state files.
- **Validation-pipeline agents are pinned to Opus 5 at medium effort** (captain decision 2026-08-08), set in `~/.no-mistakes/config.yaml` under `agent_args_override.claude`.
  The pin exists so the shared pipeline stops silently tracking whatever the captain's personal `/model` setting happens to be.
  A cheaper model was considered explicitly and rejected on detection rate: roughly 0.52 versus 1.30 findings per 1,000 diff lines.
  The setting is global to the machine and cannot be scoped per pipeline step, so it is an environment-level decision rather than a per-application one.
- **No cheaper tier for mechanical or config-only work** (captain veto, restated 2026-08-08: "leave it standing").
  Do not reopen it without new evidence and a captain ask.
- Never silently change a worker's model or effort tier.
  Tier changes are the captain's.

## Delivery: end-user simplicity is part of the feature

- **Every feature is shaped around the non-technical end user and must be as simple as possible for them.**
  Captain's instruction: "part of the process of delivering these features is having the end user in mind and making it as simple as possible for them."
- Treat it as an acceptance dimension in every ship brief, not an afterthought: what does the end user actually see and do, how many steps, and could a non-technical person complete it unaided on a phone?
  A flow that works but needs developer knowledge - copy a token out of browser devtools, read an error code, run a command - is not done.
- The lesson that produced this rule: a feature shipped technically working, passed its pipeline, and was rejected on sight because a real person could not reasonably complete it.
  "The pipeline passed" never substitutes for "a real person could do this."
- Record the same bar in each application's own committed `AGENTS.md` so workers inherit it without firstmate restating it in every brief.

## Environment architecture: one instance per application

- **Each application gets its own separate development and agentic-coding environment instance.**
  Captain's words: "separate development environment instances... for each app, just to keep things completely separated."
  Nothing is shared at runtime between two applications.
- An instance is a separate top-level clone of this environment, opened the same way as any other; it is a peer the captain sits in, not a subordinate that work is routed to.
- **What is reusable is the template and the doctrine, not a running system.**
  Principles, operational learnings, and the project starter kit travel into each new instance at birth; each instance then accumulates its own history.
- **Development infrastructure belongs in the coding environment, not in the application repository.**
  Tooling that knows how to understand an application lives beside the environment and reads the application from outside it.
- Known downside the captain accepted: a lesson learned in one instance does not automatically reach another.
  Propagation is a design problem to solve deliberately, not a reason to share runtime.

## Task shaping

- **Split worker tasks into small, focused, bite-size pieces** (captain's words, 2026-08-07: "manageable small bite-size pieces of work... very focused work rather than being very large").
  Prefer several sequenced or parallel small ships with explicit dependencies over one large brief, at every intake.
- **A project's committed state files are canonical.**
  The convention is a machine-readable feature inventory and a phase or progress record at the repository root, described by a short document beside them.
  Firstmate reads them at intake, and every behavior-changing PR updates them in the same PR; put that requirement in every ship brief.
- **Zero-context worker bootstrap after each major delivery.**
  After a major feature lands, the next worker starts cold and orients from the committed state surface rather than carried-over context.
  Every ship brief opens by pointing at those state files, and at a dependency or impact graph once one exists for that project.
  Workers already start with no context structurally, so this preference is about making the committed state their primary orientation source.

## Communication style

- Prefers **plain, non-technical explanations** when asking how the system works, has explicitly asked for increasing levels of plain language, and wants to be shown real source code when discussing mechanisms rather than design-document descriptions.
- Wants decisions presented **one at a time with room to give feedback**, rather than a single bulk dump.
- Expects claims to be **verified, not assumed**: the captain has asked firstmate to personally run a user test rather than trust a worker's completion report.
