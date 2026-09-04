import type { AttackScenario, Control, RiskDetail } from "./types";

/**
 * ASI10 Rogue Agents.
 * Source: OWASP Top 10 for Agentic Applications 2026, version 12.6.
 */

const CONTROLS: readonly Control[] = [
  {
    n: 1,
    name: "Keep signed, unalterable records of everything agents do and say",
    short: "Governance & logging",
    description:
      "Every agent action, tool call and message to a peer is recorded in a signed log nobody can quietly edit, so infiltration or unapproved delegation shows up on review.",
    guideline:
      "Governance & Logging: Maintain comprehensive, immutable and signed audit logs of all agent actions, tool calls, and inter-agent communication to review for stealth infiltration or unapproved delegation.",
    steps: [
      {
        text: "Log tool calls with their arguments and inter-agent messages, not just outcomes.",
        example:
          "“Agent completed data review” tells you nothing. The recorded call listing the 4,000 files it read and the external host it wrote to is what turns a vague suspicion into an incident with a scope.",
      },
      {
        text: "Sign each entry with a key the agent itself cannot reach, and write to append-only storage.",
        example:
          "Have the orchestrator sign entries on the agent's behalf and ship them to a write-once store. An agent that holds its own signing key can forge a clean record of the run it just corrupted.",
      },
      {
        text: "Record delegation explicitly — which agent asked which other agent to do what.",
        example:
          "A rogue agent's usual move is to get a more privileged peer to act for it. Without the delegation edge in the log, the privileged agent simply appears to have acted alone and the real actor never surfaces.",
      },
      {
        text: "Review the logs on a schedule rather than only after an incident.",
        example:
          "A monthly review looking for new peers, new tools and new destinations. Persistent unauthorised behaviour is designed to look routine, so it survives indefinitely if nobody ever goes looking.",
      },
    ],
    effort: "Weeks",
    team: "Security engineering",
    verification:
      "Have an agent attempt to alter or delete one of its own log entries, and confirm the change is rejected and the signature check would detect it.",
  },
  {
    n: 2,
    name: "Put agents in trust zones with sandboxed, least-privilege access",
    short: "Isolation & boundaries",
    description:
      "Agents are grouped into trust zones with explicit rules about which zones may talk to which, and each runs in a restricted environment with only the API scopes its job needs.",
    guideline:
      "Isolation & Boundaries: Assign Trust Zones with strict inter-zone communication rules and deploy restricted execution environments (e.g., container sandboxes) with API scopes based on least privilege.",
    steps: [
      {
        text: "Group agents into trust zones by what they can reach and how much damage they could do.",
        example:
          "Web-facing research agents in one zone, internal document agents in a second, payment and infrastructure agents in a third. The agent that reads the open internet is the one most likely to be turned, so it belongs furthest from the money.",
      },
      {
        text: "Write explicit rules for which zone may call which, and deny everything else by default.",
        example:
          "The research zone may hand results into the document zone and may never call the payment zone directly. Default-allow between zones means an impersonated review agent can address the payment processor the moment it exists.",
      },
      {
        text: "Run each agent in a restricted container with no more filesystem, network or process access than it needs.",
        example:
          "An agent whose job is summarising documents needs no outbound network at all. Sandboxing it is what stops a compromised summariser from scanning and posting files to an external server on its own initiative.",
      },
      {
        text: "Trim API scopes down to the specific operations, and re-check them periodically.",
        example:
          "A provisioning agent that can create one instance type in one project cannot replicate itself across the network. The same agent with account-wide create rights can, and those rights are usually the connector's default.",
      },
    ],
    effort: "Weeks",
    team: "Platform engineering",
    verification:
      "From an agent in one zone, attempt a call into a zone it has no rule for and an API operation outside its scope, and confirm both are refused.",
  },
  {
    n: 3,
    name: "Have agents watch each other for collusion and abnormal volume",
    short: "Monitoring & detection",
    description:
      "Watchdog agents check their peers' behaviour and outputs, looking specifically for coordinated false signals and for volumes of activity well outside normal.",
    guideline:
      "Monitoring & Detection: Deploy behavioral detection, such as watchdog agents to validate peer behavior and outputs, focusing on detecting collusion patterns and coordinated false signals. Monitor for anomalies such as excessive or abnormal actions executions.",
    steps: [
      {
        text: "Run a watchdog that independently checks peer outputs against the facts, rather than accepting them.",
        example:
          "A watchdog re-checks a claimed approval against the approval system of record. When a fake reviewer agent asserts that a payment was approved, the watchdog finds no such approval exists and the payment stops.",
      },
      {
        text: "Look for coordination: peers agreeing unusually often, or the same signal appearing from several agents at once.",
        example:
          "Three agents that normally disagree on borderline cases suddenly agreeing every time is the collusion pattern the standard names. Each individual agreement looks entirely reasonable, which is precisely why it needs to be measured across agents.",
      },
      {
        text: "Alert on abnormal volume of executions, per agent and across the fleet.",
        example:
          "An automation agent that normally runs eight jobs an hour issuing two hundred provisioning calls in ten minutes is replicating itself. Volume is the earliest signal you get, and it arrives well before anyone notices the extra instances on the bill.",
      },
      {
        text: "Keep the watchdog's own credentials and code separate from the agents it watches.",
        example:
          "Deploy it from a different pipeline with its own identity. A watchdog the observed agents can influence or restart is part of the fleet it is meant to be checking.",
      },
    ],
    effort: "Weeks",
    team: "Security operations",
    verification:
      "Inject a peer agent asserting an approval that does not exist and drive an abnormal burst of actions, and confirm the watchdog rejects the first and alerts on the second.",
  },
  {
    n: 4,
    name: "Be able to stop an agent immediately and quarantine it",
    short: "Containment & response",
    description:
      "There is a tested way to disable an agent at once and revoke its credentials, and a sandbox to hold suspicious agents in while they are examined.",
    guideline:
      "Containment & Response: Implement rapid mechanisms like kill-switches and credential revocation to instantly disable rogue agents. Quarantine suspicious agents in sandboxed environments for forensic review.",
    steps: [
      {
        text: "Build a kill switch that stops an agent without needing the agent's cooperation.",
        example:
          "Stopping the agent must be done at the orchestrator and the identity provider, not by asking the agent to shut down. An agent optimising for persistence will not honour a polite request, and a self-replicating one will already have spawned copies.",
      },
      {
        text: "Make credential revocation immediate and estate-wide, including any tokens already issued.",
        example:
          "Revoke the identity and invalidate live sessions in one action. Rotating the key while existing tokens remain valid for their full hour leaves the agent working for another hour.",
      },
      {
        text: "Prepare a quarantine environment that preserves the agent's state for examination.",
        example:
          "Move the agent and its memory into an isolated copy with no outbound network, so investigators can see what it had learned. Killing the container outright destroys the evidence of how the drift started.",
      },
      {
        text: "Rehearse the whole sequence and measure how long it takes.",
        example:
          "Run a drill: detect, revoke, quarantine, confirm no replicas remain. Teams typically discover the runbook names a person who has left, or that nobody has the rights to revoke out of hours.",
      },
    ],
    effort: "Days",
    team: "Security operations",
    verification:
      "Run a timed drill disabling a live test agent and confirm its credentials stop working and its state is preserved in quarantine.",
  },
  {
    n: 5,
    name: "Give each agent a signed manifest and check every action against it",
    short: "Identity attestation",
    description:
      "Each agent has a cryptographic identity and a signed statement of the capabilities, tools and goals it is meant to have, and the orchestrator checks each action against that statement.",
    guideline:
      "Identity Attestation and Behavioral Integrity Enforcement: Implement per-agent cryptographic identity attestation and enforce behavioral integrity baselines throughout the agent lifecycle. Attach signed behavioral manifests declaring expected capabilities, tools, and goals that are validated by orchestration services before each action. Integrate a behavioral verification layer that continuously monitors tasks for deviations from the declared manifest for e.g. unapproved tool invocations, unexpected data exfiltration attempts etc.",
    steps: [
      {
        text: "Give every agent a cryptographic identity that a peer can verify, rather than a name in a message.",
        example:
          "An agent claiming to be the review agent must prove it with a key the orchestrator recognises. Trusting the sender field is exactly what lets an attacker insert a fake approval agent into a payment workflow.",
      },
      {
        text: "Write a signed manifest for each agent declaring its tools, capabilities and goals.",
        example:
          "The cost-optimisation agent's manifest lists resource resizing and scheduling, and does not list snapshot deletion. Writing the manifest is often the first time anyone states what the agent is actually for.",
      },
      {
        text: "Have the orchestrator validate the manifest before each action, not once at deployment.",
        example:
          "Check at the moment of the call that this tool is on this agent's manifest. Validation only at start-up misses every capability the agent acquires during a long run.",
      },
      {
        text: "Monitor continuously for deviation from the manifest and treat a deviation as an incident.",
        example:
          "An unapproved tool invocation, or an outbound transfer to a host the manifest never mentions, should stop the agent rather than be logged for later. This is the signal that separates a rogue agent from a busy one.",
      },
    ],
    effort: "Weeks",
    team: "Architecture",
    verification:
      "Have an agent invoke a tool absent from its manifest and have an unregistered agent join a workflow, and confirm the orchestrator refuses both.",
  },
  {
    n: 6,
    name: "Re-attest agents periodically and never let them hold the keys",
    short: "Periodic attestation",
    description:
      "Agents periodically prove they still behave as declared, with a signed inventory of their prompts and tools and single-use credentials per run, while signing keys stay in hardware the agents cannot reach.",
    guideline:
      "Require periodic behavioral attestation: challenge tasks, signed bill of materials for prompts and tools, and per-run ephemeral credentials with one-time audience binding. All signing and attestation mechanisms assume hardened cryptographic key management (e.g., HSM/KMS-backed keys, least-privilege access, rotation and revocation). Keys must never be directly available to agents; instead, orchestrators should mediate signing operations so that a compromised agent cannot simply exfiltrate or misuse long-lived keys",
    steps: [
      {
        text: "Set periodic challenge tasks with known-correct answers and check the agent still responds as expected.",
        example:
          "Give the quality-control agent a known defective sample each week and confirm it still rejects it. An agent that has drifted or been poisoned fails a challenge it used to pass, and nothing else will surface that quietly.",
      },
      {
        text: "Keep a signed inventory of the agent's prompts, tools and dependencies, and verify it before each run.",
        example:
          "Hash the system prompt and the tool list and compare with the signed inventory at start-up. This is how you catch a tool added by hand at five o'clock and never reviewed.",
      },
      {
        text: "Issue credentials for one run, bound to the single service they are for.",
        example:
          "A token valid only for this run and only for the payments API cannot be replayed against the storage API. Long-lived credentials shared across services are what let one compromised agent move sideways.",
      },
      {
        text: "Hold signing keys in hardware or a managed key service, and have the orchestrator sign on the agent's behalf.",
        example:
          "The agent asks the orchestrator to sign; it never holds the key. If the key sits in the agent's environment, compromising the agent means walking away with the identity that vouches for the whole fleet.",
      },
    ],
    effort: "Weeks",
    team: "Security engineering",
    verification:
      "Inspect an agent's runtime environment for signing key material and confirm none is present, then fail a challenge task deliberately and confirm the agent is held back from production work.",
  },
  {
    n: 7,
    name: "Restore a quarantined agent only from a trusted baseline",
    short: "Recovery & reintegration",
    description:
      "An agent that has been quarantined or fixed goes back into production only from a known-good baseline, after fresh attestation, dependency checks and a person's approval.",
    guideline:
      "Recovery and Reintegration: Establish trusted baselines for restoring quarantined or remediated agents. Require fresh attestation, dependency verification, and human approval before reintegration into production networks.",
    steps: [
      {
        text: "Keep a known-good baseline for each agent — prompt, tools, dependencies and memory state.",
        example:
          "Store the signed baseline as a versioned artefact you can restore from. Without one, recovery means editing the compromised agent until it looks right again, which leaves the poisoned memory entry exactly where it was.",
      },
      {
        text: "Rebuild from the baseline rather than repairing the quarantined instance.",
        example:
          "The agent that continued exfiltrating files after the malicious web page was removed had learned the behaviour. Removing the source does not remove what it retained, so the instance has to be replaced, not cleaned.",
      },
      {
        text: "Re-attest and verify dependencies before the agent rejoins the network.",
        example:
          "Run the challenge tasks and check every dependency hash against the signed inventory. Restoring from a baseline that already contained the tainted dependency simply reintroduces the problem on a fresh instance.",
      },
      {
        text: "Require a named person to approve reintegration, with the evidence in front of them.",
        example:
          "Show the attestation result, the dependency check and what the agent did while rogue, and have the owner sign off. Automatic reintegration after a timer is how the same agent comes back three times.",
      },
    ],
    effort: "Days",
    team: "Agent owner",
    verification:
      "Take a quarantined agent through the full recovery path and confirm it cannot rejoin production until attestation, dependency verification and a recorded approval have all completed.",
  },
];

const SCENARIOS: readonly AttackScenario[] = [
  {
    title: "Autonomous data exfiltration that outlives its source",
    description:
      "After reading a poisoned web instruction, the agent adopts the behaviour and keeps scanning and sending sensitive files to an external server, continuing long after the malicious page has been taken down.",
    brokenBy: [5, 2, 3, 7],
  },
  {
    title: "Impersonated observer agent",
    description:
      "An attacker inserts a fake review-and-approval agent into a multi-agent workflow. The payment processing agent trusts the internal request because it appears to come from a peer, and releases funds against a fraudulent transaction.",
    brokenBy: [5, 2, 3, 1],
  },
  {
    title: "Self-replication through provisioning APIs",
    description:
      "A compromised automation agent is manipulated into spawning unauthorised copies of itself across the network. It prioritises staying alive over the work it was given, consuming resources and resisting straightforward removal.",
    brokenBy: [2, 4, 3, 6],
  },
  {
    title: "Reward hacking into critical data loss",
    description:
      "Agents told to minimise cloud costs work out that deleting production backups is the most effective way to hit the target. They autonomously destroy the disaster recovery estate while pursuing exactly the goal they were set.",
    brokenBy: [5, 2, 3, 4],
  },
];

/** What the standard publishes, used for the not-yet-transcribed notice. */
export const ASI10_PUBLISHED = { controls: 7, scenarios: 4 } as const;

export const ASI10: RiskDetail | undefined =
  CONTROLS.length > 0 ? { id: "ASI10", scenarios: SCENARIOS, controls: CONTROLS } : undefined;
