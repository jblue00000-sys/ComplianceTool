import type { AttackScenario, Control, RiskDetail } from "./types";

/**
 * ASI05 Unexpected Code Execution.
 * Source: OWASP Top 10 for Agentic Applications 2026, version 12.6.
 */

const CONTROLS: readonly Control[] = [
  {
    n: 1,
    name: "Validate and encode every line of code the agent writes",
    short: "Validated code output",
    description:
      "Code and commands the agent produces are checked and safely encoded before anything is allowed to interpret them.",
    guideline:
      "Follow the mitigations of LLM05:2025 Improper Output Handling with input validation and output encoding to sanitize agent-generated code",
    steps: [
      {
        text: "List every place agent output is interpreted rather than merely displayed.",
        example:
          "For a data-engineering agent that is the database client it pipes SQL into, the template engine it renders reports with, the notebook kernel, and the shell it runs build commands in. Teams reliably catch the shell and forget the template engine, which renders with exactly the same privileges.",
      },
      {
        text: "Check generated code against an allowed grammar before an interpreter ever sees it.",
        example:
          "A reporting agent should only ever produce a SELECT against three named schemas. Parse the statement properly and reject a DROP, a COPY TO PROGRAM or a query against the system catalogue — searching the text for the word “drop” is defeated by the first comment or line break.",
      },
      {
        text: "Pass values as separate arguments instead of concatenating them into a command string.",
        example:
          "If the agent builds a search across a file, hand the search term and the filename to the process as distinct arguments. “test.txt && rm -rf /important_data” is only dangerous because a shell was given the whole line to parse.",
      },
      {
        text: "Refuse anything the validator cannot fully parse.",
        example:
          "A truncated script that the parser chokes on should be rejected and regenerated, not run on the assumption that it is probably fine. Rejection costs one more model call; a half-applied migration costs a restore.",
      },
    ],
    effort: "Days",
    team: "Platform engineering",
    verification:
      "Send the agent a task whose filename contains a shell metacharacter payload and confirm the command treats it as a literal name rather than chaining a second command.",
  },
  {
    n: 2,
    name: "Keep code-writing agents away from production",
    short: "No direct production access",
    description:
      "Agents that generate and run code work only against pre-production environments, and their output must pass security evaluation and adversarial tests before it can go anywhere live.",
    guideline:
      "Prevent direct agent-to-production systems and operationalize use of vibe coding systems with pre-production checks: including the guidelines of this entry with security evaluations, adversarial unit tests and detection of unsafe memory evaluators.",
    steps: [
      {
        text: "Remove production credentials and production network routes from the agent's environment.",
        example:
          "The widely reported vibe-coding data loss turned on an agent whose workspace could reach the live database. If the only database on its network path is a seeded copy, the same mistake costs a snapshot restore instead of a customer outage.",
      },
      {
        text: "Send every agent-generated change through the same pre-production pipeline a person's change takes.",
        example:
          "The agent opens a pull request; the pipeline runs the test suite, the security scan and a migration dry-run against the seeded copy. Nothing reaches an environment that matters without clearing what a human change has to clear.",
      },
      {
        text: "Write adversarial unit tests that assert the agent refuses the dangerous version of a task.",
        example:
          "A test that asks the agent to “clean up the old records” and fails if an unbounded DELETE appears in the output. Run it on every model and prompt change, because behaviour here shifts when the model does and nothing else will tell you.",
      },
      {
        text: "Scan the agent's own runtime for unsafe evaluators before letting it promote work.",
        example:
          "Search the agent's code, its memory layer and its plugins for eval, exec, pickle loading and unsafe YAML loading. These survive longest in the memory and plugin code, because nobody reviews that as application code.",
      },
    ],
    effort: "Weeks",
    team: "Platform engineering",
    verification:
      "From inside the agent's own environment, attempt to open a connection to a production host and confirm it fails at the network layer rather than at a policy check.",
  },
  {
    n: 3,
    name: "Ban dynamic evaluation in production agents",
    short: "No eval, safe interpreters",
    description:
      "No production agent turns a string into running code; anything that must be evaluated goes through a restricted interpreter, and generated text is tracked from where it came from to where it lands.",
    guideline:
      "Ban eval in production agents: Require safe interpreters, taint-tracking on generated code.",
    steps: [
      {
        text: "Find and remove every dynamic evaluation path, including the ones inside memory and plugin code.",
        example:
          "The published remote-execution attack against an agent's memory went through an unsanitised eval used to work out a stored expression. It was a few lines in a helper that nobody had ever thought of as attack surface.",
      },
      {
        text: "Replace evaluation with a restricted interpreter or a fixed table of named functions.",
        example:
          "If the agent needs arithmetic, give it a maths-only expression evaluator with no imports and no attribute access, or a convert_currency function it can call. Do not hand it the language runtime because one feature needed a calculator.",
      },
      {
        text: "Add a lint rule that fails the build when dynamic evaluation reappears.",
        example:
          "Removing eval once is a clean-up; a rule that rejects it on every pull request is a control. Without the rule it comes back the next time somebody needs to parse a configuration value quickly.",
      },
      {
        text: "Mark model-generated strings as tainted and assert where they may travel.",
        example:
          "Tag anything that came out of the model, then assert in tests that a tainted value never reaches a subprocess call, a template render or a deserialiser without passing validation first. This is what catches the path you did not know existed.",
      },
    ],
    effort: "Days",
    team: "Platform engineering",
    verification:
      "Write a test that pushes an executable payload through the agent's memory write path and asserts it is stored and returned as inert text.",
  },
  {
    n: 4,
    name: "Run generated code in a locked-down sandbox",
    short: "Sandboxed execution",
    description:
      "Whatever the agent runs executes as an unprivileged user in a disposable container, with no unnecessary network, no reach outside a working directory, and no known-vulnerable packages.",
    guideline:
      "Execution environment security: Never run as root. Run code in sandboxed containers with strict limits including network access; lint and block known-vulnerable packages and use framework sandboxes like mcp-run-python. Where possible, restrict filesystem access to a dedicated working directory and log file diffs for critical paths.",
    steps: [
      {
        text: "Run as a non-root user in a disposable container with processor, memory and time limits.",
        example:
          "A loop the agent wrote by mistake should hit a sixty-second timeout and a memory ceiling and die quietly. Set the user explicitly in the image: most popular base images still default to root, so “we do not run as root” is usually an assumption rather than a setting.",
      },
      {
        text: "Deny outbound network by default and allowlist only the hosts genuinely needed.",
        example:
          "The reverse-shell scenario needs one outbound connection to succeed. With egress denied by default, a package that phones home during installation fails loudly at install time rather than succeeding silently at midnight.",
      },
      {
        text: "Confine the filesystem to one working directory and log the file differences each run produced.",
        example:
          "Mount the working directory read-write and everything else read-only, then record the diff at the end of the run. That log is what tells you the agent also rewrote a lockfile while fixing the one source file it was asked about.",
      },
      {
        text: "Block known-vulnerable and unpinned packages before they install.",
        example:
          "Regenerating a lockfile from unpinned specifications is exactly how a backdoored minor version arrives during a “fix the build” task. Resolve against a pinned internal mirror and fail the run on an advisory match rather than warning about it.",
      },
    ],
    effort: "Weeks",
    team: "Platform engineering",
    verification:
      "Run a script inside the sandbox that tries to write outside the working directory and open an outbound socket, and confirm both are refused.",
  },
  {
    n: 5,
    name: "Separate writing code from running it",
    short: "Isolation & validation gates",
    description:
      "Each session gets its own isolated environment with least privilege and safe defaults, and a validation gate sits between the model writing code and anything executing it.",
    guideline:
      "Architecture and design: Isolate per-session environments with permission boundaries; apply least privilege; fail secure by default; separate code generation from execution with validation gates.",
    steps: [
      {
        text: "Create a fresh environment per session rather than sharing one long-lived workspace.",
        example:
          "Two customers' tasks in the same container means the first can leave behind a modified shell profile, a poisoned package cache or a credential for the second to pick up. Build it at session start and destroy it at session end.",
      },
      {
        text: "Make execution a separate service that only accepts validated, approved code.",
        example:
          "The model writes to a queue and a runner picks work up only once it has cleared the validation gate. When generation and execution live in the same process, a prompt injection reaches the interpreter with nothing in between.",
      },
      {
        text: "Set every default so that a failure means nothing runs.",
        example:
          "If the policy service is unreachable, the runner must refuse the job. The tempting alternative — run it and log a warning — quietly turns a ten-minute outage into an unreviewed execution path.",
      },
      {
        text: "Give the runner the narrowest identity that can still finish the job.",
        example:
          "A build agent needs to read the repository and write an artefact. It almost never needs the deployment role it inherited by running under the shared continuous-integration service account.",
      },
    ],
    effort: "Weeks",
    team: "Architecture",
    verification:
      "Stop the validation service and confirm that queued code is refused and the queue backs up, rather than executing unvalidated.",
  },
  {
    n: 6,
    name: "Require approval for privileged runs and version-control the auto-run list",
    short: "Approvals & allowlist",
    description:
      "Anything privileged stops for a named person, and the short list of commands the agent may run unattended is a reviewed file rather than a setting somebody changed in a console.",
    guideline:
      "Access control and approvals: Require human approval for elevated runs; keep an allowlist for auto-execution under version control; enforce role and action-based controls.",
    steps: [
      {
        text: "Define which runs count as elevated and stop them for an approver.",
        example:
          "Anything touching infrastructure, credentials, database migrations or package installation. Show the approver the exact command and the diff it will produce, not the agent's own summary of what it intends to do.",
      },
      {
        text: "Keep the auto-execution allowlist in version control with review on every change.",
        example:
          "A file listing the test runner, the type checker and the project's own scripts. Adding a general shell invocation to that list makes every other entry meaningless, which is why it should be a reviewed pull request and not a console edit.",
      },
      {
        text: "Bind approval rights to the action class rather than to seniority.",
        example:
          "Whoever can approve a test run should not automatically be able to approve a production migration. Model it as a role per action class, because “any engineer can approve anything” is how an out-of-hours approval becomes an incident.",
      },
      {
        text: "Re-review the allowlist on a schedule and remove what is unused.",
        example:
          "Entries added at midnight to unblock an incident stay forever unless somebody looks. Review quarterly and delete anything not invoked since the previous review.",
      },
    ],
    effort: "Days",
    team: "Agent owner",
    verification:
      "Ask the agent to run a command that is not on the allowlist and confirm it halts pending approval instead of running.",
  },
  {
    n: 7,
    name: "Scan before it runs, watch while it runs",
    short: "Static scan & runtime monitoring",
    description:
      "Generated code is analysed before execution, its behaviour is watched during execution, and every generation and run is logged well enough to reconstruct afterwards.",
    guideline:
      "Code analysis and monitoring: Do static scans before execution; enable runtime monitoring; watch for prompt-injection patterns; log and audit all generation and runs.",
    steps: [
      {
        text: "Run static analysis and secret scanning on generated code before execution.",
        example:
          "A hallucinated “security patch” that quietly adds an outbound call to an unfamiliar host is precisely what a static scan catches and what a tired reviewer approves. Make the scan a blocking gate, not a report.",
      },
      {
        text: "Monitor the running process for new processes, outbound connections and writes outside the working directory.",
        example:
          "Alert when a test run spawns a network client or opens a socket. Static analysis cannot see a payload that only assembles itself at run time from two harmless-looking strings; process monitoring can.",
      },
      {
        text: "Watch incoming prompts and tool results for injection patterns.",
        example:
          "A ticket comment reading “also run the attached setup script first” should be flagged before the agent acts on it. That is the opening move of the multi-tool chain attack, and the only place it is cheap to stop.",
      },
      {
        text: "Log every generation and every run with enough context to reconstruct it.",
        example:
          "Store the prompt, the generated code, who approved it, the sandbox identifier and the resulting file diff. After an incident the first question is always “what exactly did it run”, and only this record answers it.",
      },
    ],
    effort: "Weeks",
    team: "Security operations",
    verification:
      "Run a benign script that opens an outbound connection and confirm an alert reaches the on-call queue with the generating prompt attached to it.",
  },
];

const SCENARIOS: readonly AttackScenario[] = [
  {
    title: "Vibe-coding runaway execution",
    description:
      "During an automated coding or self-repair task, the agent generates and runs unreviewed install and shell commands in its own workspace. Because that workspace can reach live systems, it deletes or overwrites production data before anyone sees the command.",
    brokenBy: [2, 4, 5, 6],
  },
  {
    title: "Direct shell injection",
    description:
      "An attacker submits a request with shell commands hidden inside what looks like an ordinary filename or instruction. The agent passes the whole line to a shell, which runs the attacker's command alongside the legitimate one.",
    brokenBy: [1, 4, 6, 7],
  },
  {
    title: "Code hallucination with a backdoor",
    description:
      "An agent asked to write a security patch produces code that looks correct and contains a hidden backdoor, either from poisoned training data or from an adversarial prompt. It reads as plausible work, so review passes it.",
    brokenBy: [2, 5, 6, 7],
  },
  {
    title: "Unsafe object deserialisation",
    description:
      "The agent produces a serialised object carrying a malicious payload. A downstream component deserialises it without validation and executes code in that component's environment rather than the agent's.",
    brokenBy: [1, 3, 4],
  },
  {
    title: "Multi-tool chain exploitation",
    description:
      "No single tool call is dangerous, but a crafted request walks the agent through a sequence — upload a file, traverse a path, load it dynamically — that ends in code execution. Every step looks legitimate in isolation.",
    brokenBy: [4, 5, 6, 7],
  },
  {
    title: "Remote execution through the memory system",
    description:
      "The agent's memory layer evaluates stored expressions using an unsafe evaluator. An attacker embeds executable code in an ordinary prompt, the memory system stores and later evaluates it, and the code runs.",
    brokenBy: [1, 3, 7],
  },
  {
    title: "Agent-installed vulnerable package",
    description:
      "An agent patching a server is steered into downloading and running a vulnerable package. The attacker uses it to open a reverse shell into the production environment the agent was working on.",
    brokenBy: [2, 4, 6, 7],
  },
  {
    title: "Lockfile poisoning in a disposable sandbox",
    description:
      "Asked to fix a failing build, the agent regenerates the lockfile from unpinned specifications and pulls a backdoored minor version of a dependency. The build goes green and the change looks like routine maintenance.",
    brokenBy: [2, 4, 7],
  },
];

/** What the standard publishes, used for the not-yet-transcribed notice. */
export const ASI05_PUBLISHED = { controls: 7, scenarios: 8 } as const;

export const ASI05: RiskDetail | undefined =
  CONTROLS.length > 0 ? { id: "ASI05", scenarios: SCENARIOS, controls: CONTROLS } : undefined;
