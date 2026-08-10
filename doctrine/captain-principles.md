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

## The quality bar

The captain's standard, in his words: "Simplicity and speed. End user's experience needs to be the baseline for anything that is built."
The lesson that set it: a feature shipped technically working, passed its pipeline, and was rejected on sight because a real person could not reasonably complete it.
"The pipeline passed" never substitutes for "a real person could do this."

`bin/fm-brief.sh` copies the fenced block below into every ship brief verbatim, and that brief requires it to travel in the validation pipeline's `--intent`, which the reviewing agent treats as authoritative acceptance criteria.
Edit the block here and every future brief and review inherits the change; never restate it in a brief by hand.
Record the same bar in each application's own committed `AGENTS.md` so its contributors inherit it too.

<!-- quality-bar:start -->
Answer these four questions about the finished work, in this order, before calling it done.
Each is yes or no: "mostly", "sort of", and a silent "not applicable" are all no, and any no is a defect to fix or an exception to state out loud.
They are weighted at simplicity, speed, and the end user rather than at craft and correctness, which are already the default strength.

1. **End user.** Could a non-technical person get through this unaided on a phone, without copying a token, reading an error code, or running a command?
   If the change has no user-facing surface, answer instead whether it leaves every user-facing path it touches no harder than it found it.
2. **Simplicity.** Is this the smallest change that delivers the asked-for behavior?
   Name every file, flag, dependency, setting, or layer of indirection it adds, and say in one sentence why the direct path could not carry it; an unnamed addition is a no.
3. **Speed.** Is it still fast for the person waiting on it?
   Name every network call, scan, poll, retry, or added wait it puts on a path someone waits on; an unaccounted addition on such a path is a no.
4. **What was asked.** Does it satisfy this job's definition of done, all of it, and add nothing beyond it?
   Take each stated acceptance criterion in turn and answer yes or no, then name anything delivered that was not asked for and anything asked for that is missing.
<!-- quality-bar:end -->

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
- **Checking is proportional to whether the words are executed, not to the file's type.**
  Captain's words, 2026-08-10: "if it's just text changes, like in AGENTS.md or something like that, there's no point going through a whole no-mistakes run or full checking because it's really just text updates."
  Measured the same day: building a change takes 5-15 minutes while review, tests, and the fixing that follows take 20-40, so roughly three quarters of the cost was checking, and it was spent identically on a one-line wording fix and on a change to how the assistant authenticates.
  **Fast path** - prose nothing acts on, such as documentation, README, comments, evidence write-ups, and task notes - ships `direct-PR` instead of `no-mistakes`: still a pull request under the captain's standing merge posture, just no validation pipeline.
  **Full path** - prose the system executes, such as anything under `agent_behavior/`, prompts, refusal and reply templates, policy or service-level data files, anything a script parses, and this environment's own AGENTS.md and `doctrine/` - stays on `no-mistakes`, because it reads like text and behaves like code.
  AGENTS.md is the case people will get wrong: the quote above names it only as a gesture at "text files", but an agent loads and acts on it every session, so it and `doctrine/` are the most executed text in the system and one wrong sentence there changes how the whole fleet behaves; the captain agreed with the executed-words test when it was put to him explicitly, so the test governs rather than his example.
  The fast path never lowers a rigor level the captain set deliberately for a project: this test decides how much checking prose needs only where no stronger standing posture already applies, so on a `no-mistakes-prod-only` project product-facing documentation keeps the full path.
  **When genuinely unsure, take the full path** and say why in one line.
  The line is drawn at execution rather than file type because two defects on 2026-08-10 were pure wording changes in text files that broke live behavior: the internal label `RESPONSE_TIME_SENTENCE:` leaked verbatim into client-facing replies in 3 of 5 live attempts, and a refusal template told the MSP owner to "contact your IT administrator" - himself - because one shared string served two audiences.
  Neither was caught by reading the change and both were caught by running it, so revisit this boundary if that stops holding in either direction.

## Communication style

- Prefers **plain, non-technical explanations** when asking how the system works, has explicitly asked for increasing levels of plain language, and wants to be shown real source code when discussing mechanisms rather than design-document descriptions.
- Wants decisions presented **one at a time with room to give feedback**, rather than a single bulk dump.
- Expects claims to be **verified, not assumed**: the captain has asked firstmate to personally run a user test rather than trust a worker's completion report.
