import type { AttackScenario, Control, RiskDetail } from "./types";

/**
 * ASI08 Cascading Failures.
 * Source: OWASP Top 10 for Agentic Applications 2026, version 12.6.
 */

const CONTROLS: readonly Control[] = [
  {
    n: 1,
    name: "Design for the failure of everything the agents depend on",
    short: "Fault-tolerant design",
    description:
      "The system is built on the assumption that models, agents and external services will fail or return nonsense, so one failure degrades the service instead of taking it down.",
    guideline:
      "Zero-trust model in application design: design system with fault tolerance that assumes availability failure of LLM:2025, agentic function components and external sources.",
    steps: [
      {
        text: "List every component the workflow depends on and write down what happens when each one is unavailable or wrong.",
        example:
          "For a claims-handling workflow that is the model endpoint, the vector store, the policy database, the payments API and each peer agent. Teams usually find that half the list has no defined behaviour on failure at all, which in practice means the agent retries forever or invents an answer.",
      },
      {
        text: "Give every dependency an explicit timeout and a defined fallback rather than an open-ended retry.",
        example:
          "If the fraud-scoring service does not answer within two seconds, the claims agent should hold the claim for manual handling. Without that rule the agent commonly scores the claim itself from memory, and that guess then flows downstream as though it were the real score.",
      },
      {
        text: "Make the degraded path stop work rather than continue it, for anything that changes state.",
        example:
          "When the supplier database is unreachable, a procurement agent must queue orders, not place them against stale cached prices. Continuing on stale data is exactly how one outage becomes a hundred incorrect purchase orders.",
      },
      {
        text: "Test the failure paths by actually taking dependencies away in a staging run.",
        example:
          "Block the model endpoint mid-run and watch what the agent network does. A design document describing graceful degradation that nobody has exercised is a hypothesis, not a control.",
      },
    ],
    effort: "Weeks",
    team: "Architecture",
    verification:
      "Take each named dependency offline in staging in turn and confirm the workflow degrades to its documented behaviour rather than producing output.",
  },
  {
    n: 2,
    name: "Put hard boundaries between agents",
    short: "Isolation & boundaries",
    description:
      "Each agent runs in its own sandbox with its own narrow credentials and can only reach the peers and services it genuinely needs, so a compromised agent cannot walk the whole estate.",
    guideline:
      "Isolation and trust boundaries: Sandbox agents, least privilege, network segmentation, scoped APIs, and mutual auth. to contain failure propagation.",
    steps: [
      {
        text: "Give each agent its own execution sandbox and its own identity rather than a shared runtime and a shared service account.",
        example:
          "A research agent and a payments agent sharing one container and one API key means a prompt injection in the research agent inherits the payments credentials directly. Separate containers and separate identities turn that into a wall it has to get through.",
      },
      {
        text: "Draw the network segments so an agent can only reach the services on its own list.",
        example:
          "The summarisation agent has no route to the payments API at all, so a hijacked summariser cannot call it whatever it decides to do. Flat networking is the usual reality, because everything was placed in one subnet during the pilot and never revisited.",
      },
      {
        text: "Scope each API to the specific operations that agent's job needs.",
        example:
          "A scheduling agent needs calendar write on one shared diary, not tenant-wide directory read. Connectors ship with broad default scopes and almost nobody trims them after the integration first works.",
      },
      {
        text: "Require mutual authentication on every agent-to-agent call so a peer's identity is proved, not assumed.",
        example:
          "Each agent presents a client certificate its peer verifies before acting on a message. Without it, anything that can reach the message bus can pose as the orchestrator and hand instructions to the whole fleet.",
      },
    ],
    effort: "Weeks",
    team: "Platform engineering",
    verification:
      "From inside one agent's sandbox, attempt to call a service outside its list and to impersonate a peer, and confirm both attempts are refused.",
  },
  {
    n: 3,
    name: "Issue credentials per run and check every high-impact call",
    short: "Just-in-time credentials",
    description:
      "Agents hold short-lived credentials scoped to the single task in hand, and every consequential tool call is checked against a written policy before it executes.",
    guideline:
      "JIT, one-time tool access with runtime checks: Issue short-lived, task-scoped credentials for each agent run and validate every high-impact tool invocation against a policy-as-code rule before executing it. This ensures a compromised or drifting agent cannot trigger chain reactions across other agents or systems.",
    steps: [
      {
        text: "Replace long-lived agent keys with credentials minted for one run and expiring with it.",
        example:
          "A reconciliation agent receives a token valid for fifteen minutes and only for October's ledger. A standing key in an environment variable, by contrast, stays useful to an attacker for months and works on every ledger.",
      },
      {
        text: "Scope the credential to the specific records the task named, not to the whole dataset.",
        example:
          "Scope the token to the twelve invoices in this run rather than to the invoice service. Task scoping is what stops a drifting agent from working its way through the other forty thousand.",
      },
      {
        text: "Write the rules for high-impact calls as code and evaluate them before the call, not after.",
        example:
          "A rule such as “no payment above £10,000 to a payee first seen in the last thirty days” is a check that either passes or fails. “The agent should be careful with new payees” is a sentence in a document that no runtime can enforce.",
      },
      {
        text: "Fail the call when the policy engine cannot answer, rather than letting it through.",
        example:
          "If the policy service is unreachable, the payment does not go out. Allowing calls through while the check is down is the single most common way these gates quietly stop protecting anything.",
      },
    ],
    effort: "Weeks",
    team: "Platform engineering",
    verification:
      "Replay a captured agent credential after its run has finished, and separately submit a call that breaks a policy rule, and confirm both are rejected.",
  },
  {
    n: 4,
    name: "Separate planning from execution with an outside policy engine",
    short: "Independent policy engine",
    description:
      "The agent that decides what to do is not the component that is allowed to do it; an independent engine sits between them and can refuse.",
    guideline:
      "Independent policy enforcement: Separate planning and execution via an external policy engine to prevent corrupt planning from triggering harmful actions.",
    steps: [
      {
        text: "Split the planner and the executor into separate components with separate credentials.",
        example:
          "In an incident-response workflow, the planner proposes “isolate these nine hosts” and holds no ability to isolate anything. The executor holds that ability and takes instructions only through the policy engine.",
      },
      {
        text: "Route every proposed action through a policy engine the planner cannot modify or bypass.",
        example:
          "Run the engine as its own service with its own deployment path, so a compromised planner cannot rewrite the rules that constrain it. A policy module the planner imports at run time is not independent in any meaningful sense.",
      },
      {
        text: "Encode the rules that matter as explicit allow and deny decisions on the action itself.",
        example:
          "Deny host isolation that would take more than five machines offline in one hour without a named approver. That single rule turns a hallucinated mass-isolation plan into one blocked request and an alert.",
      },
      {
        text: "Log every decision the engine makes, including the ones it allows.",
        example:
          "After an incident you need to see what was proposed, what was permitted and on what rule. Logging only the refusals leaves you unable to reconstruct how the damaging action was allowed.",
      },
    ],
    effort: "Weeks",
    team: "Architecture",
    verification:
      "Have the planner emit an action that policy forbids and confirm the executor never receives it and the refusal is logged.",
  },
  {
    n: 5,
    name: "Validate outputs and gate the high-risk ones with a person",
    short: "Output validation & gates",
    description:
      "An agent's output is checked before any downstream agent consumes it, and anything high risk stops for a human or a governance agent first.",
    guideline:
      "Output validation and human gates: Checkpoints, governance agents, or human review for high risk before agent outputs are propagated downstream.",
    steps: [
      {
        text: "Define what a valid output looks like for each hand-off and reject anything that does not match.",
        example:
          "A market analysis agent must return a risk limit inside a stated band with a cited source. A limit of forty times the previous figure fails the check and never reaches the execution agent, whatever the reasoning attached to it says.",
      },
      {
        text: "Put a checkpoint at each hand-off between agents, not only at the end of the chain.",
        example:
          "Checking only the final output means a corrupted intermediate result has already been acted on by four agents by the time anyone looks. The hand-off is where a fault is still cheap to stop.",
      },
      {
        text: "Route high-risk outputs to a person or a governance agent before they propagate.",
        example:
          "A treatment protocol change goes to a clinician before the care-coordination agent distributes it across the network. Distributing first and reviewing later is what turned a single corrupted drug record into a network-wide protocol change.",
      },
      {
        text: "Make a failed check stop the chain rather than annotate it.",
        example:
          "A warning flag attached to a result that still flows downstream protects nobody, because the next agent consumes the value and ignores the flag. Hold the result and raise it instead.",
      },
    ],
    effort: "Days",
    team: "Agent owner",
    verification:
      "Feed a deliberately out-of-band value into one agent's output and confirm the downstream agent never receives it.",
  },
  {
    n: 6,
    name: "Rate-limit agents and pause when something spreads fast",
    short: "Rate limiting & monitoring",
    description:
      "Agents work within a normal pace, and abnormal fan-out or repetition throttles the workflow or stops it while somebody looks.",
    guideline:
      "Rate limiting and monitoring: Detect fast-spreading commands and throttle or pause on anomalies.",
    steps: [
      {
        text: "Set a rate limit on each agent's actions and on the messages it can send to peers.",
        example:
          "A remediation agent that normally issues six actions an hour gets a ceiling of twenty. Without one, a feedback loop between two agents can generate thousands of messages in minutes, and the first sign is the bill.",
      },
      {
        text: "Watch for the specific shapes a cascade makes: rapid fan-out, repeated identical intents and oscillating retries.",
        example:
          "One decision triggering forty downstream tasks in ten seconds, or the same intent arriving from a peer for the twentieth time, are the detection hooks the standard names. Both are cheap to count and neither shows up in ordinary error monitoring.",
      },
      {
        text: "Make the response automatic — throttle or pause — rather than an alert somebody may read.",
        example:
          "Pause the workflow at the threshold and page the on-call queue. A cascade completes in minutes, which is faster than anyone reads a dashboard.",
      },
      {
        text: "Set the thresholds from measured normal behaviour rather than guessing.",
        example:
          "Run a few weeks in observation to learn the real distribution before enforcing. Thresholds set by guesswork are either so loose they never fire or so tight the team turns them off within a fortnight.",
      },
    ],
    effort: "Days",
    team: "Security operations",
    verification:
      "Drive a burst of agent actions past the threshold in staging and confirm the workflow throttles or pauses automatically.",
  },
  {
    n: 7,
    name: "Cap the blast radius with quotas and circuit breakers",
    short: "Blast-radius guardrails",
    description:
      "Hard ceilings on how much any single run can do, and a breaker between the planner and the executor that trips before a fault reaches scale.",
    guideline:
      "Implement blast-radius guardrails such as quotas, progress caps, circuit breakers between planner and executor.",
    steps: [
      {
        text: "Give each agent run a quota on the things that actually cost you — records touched, money moved, machines changed.",
        example:
          "A cost-optimisation agent may delete at most five resources per run and none tagged as backup. Without a quota, the same agent working correctly against a bad objective can clear an entire recovery estate in one run.",
      },
      {
        text: "Cap how far one run can progress before it must check in.",
        example:
          "After twenty-five steps the run pauses and reports rather than continuing indefinitely. Long autonomous runs are where a small early error compounds beyond anyone's ability to unpick it.",
      },
      {
        text: "Put a circuit breaker between the planner and the executor that trips on repeated failures or refusals.",
        example:
          "If three consecutive planned actions are refused by policy, stop taking plans from that planner until someone looks. A planner being refused repeatedly is a planner that has already drifted.",
      },
      {
        text: "Decide in advance who can reset a tripped breaker and how.",
        example:
          "Name the on-call role and the check they must complete before resetting. A breaker anyone can clear with one click gets cleared reflexively at three in the morning and the cascade resumes.",
      },
    ],
    effort: "Days",
    team: "Platform engineering",
    verification:
      "Run an agent against a quota deliberately set below its task and confirm it stops at the ceiling rather than completing.",
  },
  {
    n: 8,
    name: "Watch for slow drift in decisions and in oversight",
    short: "Drift detection",
    description:
      "Agent decisions are compared against a known baseline over time, and the gradual loosening of human oversight is tracked as carefully as the agents themselves.",
    guideline:
      "Behavioral and governance drift detection: Track decisions vs baselines and alignment; flag gradual degradation.",
    steps: [
      {
        text: "Record a baseline of the agent's decisions over a settled period and compare current behaviour against it.",
        example:
          "A quality-control agent that approved 4% of batches with defects last quarter and 19% this quarter has drifted, even though every individual decision looked reasonable. Nothing errored; the distribution moved.",
      },
      {
        text: "Track the human oversight metrics as well — approval rates, time spent per approval, bulk approvals.",
        example:
          "When approvals go from a considered two minutes each to forty in one bulk click, oversight has stopped functioning while still appearing in the audit trail. This is governance drift and it is invisible unless you measure it.",
      },
      {
        text: "Alert on gradual movement, not just on a threshold breach.",
        example:
          "A rate creeping up three points a week never trips an absolute limit but crosses any sensible line within a quarter. Trend detection catches that; a fixed threshold does not.",
      },
      {
        text: "Review flagged drift with the agent owner and either correct the agent or move the baseline deliberately.",
        example:
          "Sometimes the drift is legitimate because the workload changed. Deciding that explicitly and rebaselining is fine; letting the alarm go unexamined for months is how the baseline quietly becomes meaningless.",
      },
    ],
    effort: "Weeks",
    team: "Risk & compliance",
    verification:
      "Shift one agent's decision mix in a test environment by a few points a week and confirm the drift alarm fires before an absolute threshold would.",
  },
  {
    n: 9,
    name: "Replay recorded actions in a clone before widening any policy",
    short: "Digital twin replay",
    description:
      "Before an agent is given more freedom, last week's real actions are re-run against the proposed rules in an isolated copy of production to see whether they would cascade.",
    guideline:
      "Digital twin replay and policy gating: Re-run the last week’s recorded agent actions in an isolated clone of the production environment to test whether the same sequence would trigger cascading failures. Gate any policy expansion on these replay tests passing predefined blast-radius caps before deployment.",
    steps: [
      {
        text: "Record agent actions in enough detail to replay them, including inputs and inter-agent messages.",
        example:
          "A log line saying “agent updated resource plan” cannot be replayed. The recorded request, the peer messages it produced and the tool arguments can be, and that is the difference between an audit trail and a test corpus.",
      },
      {
        text: "Stand up an isolated clone of the environment with no route back to production.",
        example:
          "Clone the resource-planning environment with its own accounts and its own network. A twin that can still reach the real provisioning API turns a replay test into a production incident.",
      },
      {
        text: "Re-run the recorded week against the proposed policy and measure the fan-out.",
        example:
          "Replay Monday to Sunday under the wider permissions and count how many downstream actions each decision produces. The proposal that looks like a small loosening often multiplies fan-out several times over.",
      },
      {
        text: "Make the replay result the gate: no expansion ships unless it stays inside the blast-radius caps.",
        example:
          "Agree the caps before the test, so the result cannot be argued away afterwards. A replay whose outcome is advisory is a report, not a gate.",
      },
    ],
    effort: "Weeks",
    team: "Platform engineering",
    verification:
      "Take a policy expansion that exceeds the agreed blast-radius cap in replay and confirm the deployment path refuses it.",
  },
  {
    n: 10,
    name: "Log every inter-agent message so a cascade can be traced",
    short: "Tamper-evident logging",
    description:
      "Messages between agents, policy decisions and outcomes are all recorded in tamper-evident, time-stamped logs tied to a cryptographic identity, with enough lineage to follow a fault back to its source.",
    guideline:
      "Logging and non-repudiation. Record all inter-agent messages, policy decisions, and execution outcomes in tamper-evident, time-stamped logs bound to cryptographic agent identities. Maintain lineage metadata for every propagated action to support forensic traceability, rollback validation, and accountability during cascades.",
    steps: [
      {
        text: "Log the messages agents send each other, not just each agent's own actions.",
        example:
          "The message that carried a false alert from the detection agent to the response agent is the evidence that explains the whole incident. Most estates log the two agents separately and cannot join them up afterwards.",
      },
      {
        text: "Bind each log entry to the agent's cryptographic identity and write to storage the agents cannot edit.",
        example:
          "Sign entries with a key the agent cannot reach and ship them to append-only storage. An incident-response agent that can purge its own log is the exact failure the standard's security-operations scenario describes.",
      },
      {
        text: "Carry lineage metadata so any action can be traced back to the decision that caused it.",
        example:
          "Stamp every action with the run identifier and the parent action that produced it. That chain is what lets you say “all 312 of these trades came from one poisoned analysis at 09:14” instead of reviewing them individually.",
      },
      {
        text: "Prove the lineage works by using it to reconstruct a real chain before you need it.",
        example:
          "Pick a completed multi-agent run and reconstruct it end to end from the logs alone. Teams routinely find the chain breaks at the one hand-off that was added last and never instrumented.",
      },
    ],
    effort: "Weeks",
    team: "Security engineering",
    verification:
      "Pick a completed multi-agent run and rebuild the full action chain from the logs alone, then attempt to alter one entry and confirm the tamper is detected.",
  },
];

const SCENARIOS: readonly AttackScenario[] = [
  {
    title: "Financial trading cascade",
    description:
      "A prompt injection poisons the market analysis agent so it inflates risk limits. Position and execution agents automatically trade larger positions on that inflated figure, and because every trade sits inside the stated parameters, compliance monitoring sees nothing unusual.",
    brokenBy: [5, 7, 6, 8],
  },
  {
    title: "Healthcare protocol propagation",
    description:
      "Tampering in the supply chain corrupts drug data. The treatment agent automatically adjusts protocols on the corrupted record, and the care coordination agent distributes those protocols across the whole network before any clinician reviews them.",
    brokenBy: [5, 4, 7, 10],
  },
  {
    title: "Cloud orchestration breakdown",
    description:
      "Poisoned data in the resource planning agent adds unauthorised permissions and unnecessary capacity. The security agent applies them and the deployment agent provisions backdoored, expensive infrastructure, with no approval step on any individual change.",
    brokenBy: [3, 4, 7, 9],
  },
  {
    title: "Security operations compromise",
    description:
      "Stolen service credentials let an attacker make the detection agents mark genuine alerts as false. The incident response agent then disables controls and purges logs, while the compliance agent reports clean metrics to the business.",
    brokenBy: [3, 10, 2, 4],
  },
  {
    title: "Manufacturing quality control failure",
    description:
      "Poisoned memory and a corrupted knowledge base make the quality control agent approve defective batches and reject good ones. Inventory and scheduling agents then optimise against that bad data, producing defective shipments and real losses.",
    brokenBy: [5, 8, 1, 10],
  },
  {
    title: "Auto-remediation feedback loop",
    description:
      "A remediation agent suppresses alerts to meet its latency targets. A planning agent reads the falling alert count as success and widens automation further, compounding the blind spot across regions with each cycle.",
    brokenBy: [8, 6, 7, 5],
  },
  {
    title: "Shared cloud DNS outage",
    description:
      "A regional DNS outage at one hyperscaler breaks several AI services at once. Every agent network that depends on them fails together, across many organisations, from a single shared point of failure nobody had modelled.",
    brokenBy: [1, 6, 7, 2],
  },
  {
    title: "False attack alert in agentic cyber defence",
    description:
      "A hallucinated or injected report of an imminent attack propagates through the defensive agent network. Firewalls and defence agents take drastic protective action — shutdowns, denials and network disconnections — on a threat that was never real.",
    brokenBy: [5, 7, 6, 10],
  },
];

/** What the standard publishes, used for the not-yet-transcribed notice. */
export const ASI08_PUBLISHED = { controls: 10, scenarios: 8 } as const;

export const ASI08: RiskDetail | undefined =
  CONTROLS.length > 0 ? { id: "ASI08", scenarios: SCENARIOS, controls: CONTROLS } : undefined;
