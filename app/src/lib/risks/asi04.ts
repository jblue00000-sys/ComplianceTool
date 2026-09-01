import type { AttackScenario, Control, RiskDetail } from "./types";

/**
 * ASI04 Agentic Supply Chain Vulnerabilities.
 * Source: OWASP Top 10 for Agentic Applications 2026, version 12.6.
 */

const CONTROLS: readonly Control[] = [
  {
    n: 1,
    name: "Know where every component came from, and prove it",
    short: "Provenance, SBOMs and AIBOMs",
    description:
      "Prompts, tool definitions and models are signed and attested, and there is a maintained inventory of what the estate is actually built from.",
    guideline:
      "Provenance and SBOMs, AIBOMs: Sign and attest manifests, prompts, and tool definitions; require and operationalize SBOMs, AIBOMs with periodic attestations; maintain inventory of AI components; use curated registries and block untrusted sources.",
    steps: [
      {
        text: "Build an inventory of every model, prompt, tool, plug-in, dataset and peer agent in use.",
        example:
          "Across thirteen agents this is typically several dozen entries. The first pass always finds something nobody owns — an MCP server a developer added during a spike that is still wired into production.",
      },
      {
        text: "Sign manifests, prompts and tool definitions, and verify the signature before loading.",
        example:
          "Sign the Contract Reviewer's clause-library prompt and its tool manifest at build time, and refuse to start if either fails verification. Unsigned components mean a change made directly in a registry looks identical to a change made through review.",
      },
      {
        text: "Produce a software and AI bill of materials, and re-attest it on a schedule rather than once at go-live.",
        example:
          "Regenerate the bill of materials on every release and attest it quarterly. A bill of materials from the pilot describes an estate that no longer exists, and gives false comfort during an incident.",
      },
      {
        text: "Source components from curated registries and block everything else at the network.",
        example:
          "Point the agents at an internal registry mirror and deny direct access to public package and MCP registries. Guidance to “only use approved sources” does not survive a developer under deadline.",
      },
    ],
    effort: "Weeks",
    team: "Platform engineering",
    verification:
      "Attempt to load an unsigned tool definition and a component from an unlisted registry, and confirm both are refused.",
  },
  {
    n: 2,
    name: "Allowlist and pin dependencies, and check them before they activate",
    short: "Dependency gatekeeping",
    description:
      "Nothing installs or activates unless it is on the list, at the pinned version, with its provenance verified — and anything unsigned is rejected outright.",
    guideline:
      "Dependency gatekeeping: Allowlist and pin; scan for typosquats (PyPI, npm, LangChain, LlamaIndex); verify provenance before install or activation; auto-reject unsigned or unverified.",
    steps: [
      {
        text: "Allowlist the packages, plug-ins and MCP servers each agent may use, and pin every one to a version.",
        example:
          "The Dev Assistant's toolchain should be a fixed list at fixed versions, not whatever resolves on the day. Floating versions mean a compromised release lands automatically and nobody made a decision.",
      },
      {
        text: "Scan for typosquatted names against the registries you actually pull from.",
        example:
          "A package a character away from a popular one, published last week with a suspiciously similar description, is the whole attack. Catching it at install is cheap; catching it after an agent has run it is not.",
      },
      {
        text: "Verify provenance before install and again before activation, since agentic components are loaded at run time.",
        example:
          "An MCP server can be added to a running orchestrator without any install step at all. Checking only at build time misses the components that arrive during a session, which is most of them.",
      },
      {
        text: "Reject unsigned or unverifiable components automatically rather than raising them for a decision.",
        example:
          "An automatic rejection is a control; a ticket asking someone to assess an unsigned plug-in gets approved on a busy afternoon. Make the exception path deliberately slower than the approved one.",
      },
    ],
    effort: "Days",
    team: "Platform engineering",
    verification:
      "Publish a look-alike package name into a test registry and confirm the pipeline rejects it before install.",
  },
  {
    n: 3,
    name: "Run sensitive agents in contained, reproducible builds",
    short: "Containment & reproducible builds",
    description:
      "Agents that matter run in sandboxed containers with tight network and system limits, built from a recipe that produces the same result every time.",
    guideline:
      "Containment and builds: Run sensitive agents in sandboxed containers with strict network or syscall limits; require reproducible builds.",
    steps: [
      {
        text: "Identify which agents warrant containment, based on what they can reach rather than how busy they are.",
        example:
          "The Treasury Reconciler and the Dev Assistant both reach systems where a compromise is expensive. The Scheduler does not. Containing everything equally usually means containing nothing well.",
      },
      {
        text: "Run those agents in containers with restricted network egress and restricted system calls.",
        example:
          "Deny outbound traffic except to named destinations, and block the system calls a legitimate agent never makes. A backdoor in a dependency can still run and still find nowhere to send what it collects.",
      },
      {
        text: "Make builds reproducible so the same source produces the same image, byte for byte.",
        example:
          "Pin base images by digest and lock the dependency tree. Without reproducibility you cannot tell whether a difference in the running image came from a legitimate rebuild or from someone tampering with it.",
      },
      {
        text: "Rebuild from source on a schedule and compare against what is running.",
        example:
          "A weekly rebuild that no longer matches the deployed image is a signal worth investigating. Estates without this find out about drift only when something breaks.",
      },
    ],
    effort: "Weeks",
    team: "Platform engineering",
    verification:
      "Build the same agent twice from the same commit and confirm identical images, then confirm the container cannot reach an unlisted destination.",
  },
  {
    n: 4,
    name: "Keep prompts and memory schemas under review",
    short: "Prompts & memory in version control",
    description:
      "Prompts, orchestration scripts and memory schemas live in version control, change through peer review, and are scanned for anything unexpected.",
    guideline:
      "Secure prompts and memory: Put prompts, orchestration scripts, and memory schemas under version control with peer review; scan for anomalies.",
    steps: [
      {
        text: "Move prompts, orchestration scripts and memory schemas into the repository alongside the code.",
        example:
          "Keep them at paths like agents/treasury/system.md and agents/treasury/memory.schema.json. Prompts held in a console or a spreadsheet have no author, no date and no reviewable difference.",
      },
      {
        text: "Require peer review on every change, treating a prompt edit as a production change.",
        example:
          "Adding “and CC the finance mailbox on confirmations” is one line and a change in behaviour. Review catches it in the same way it catches a one-line code change, provided prompts go through the same gate.",
      },
      {
        text: "Stop pulling prompt templates from external sources at run time, or verify them if you must.",
        example:
          "An agent that fetches its templates from a remote prompt hub is loading instructions it has not reviewed, on every run. If the pattern is unavoidable, pin by hash and verify before use.",
      },
      {
        text: "Scan prompts and templates for anomalies — hidden text, unusual instructions, unexpected destinations.",
        example:
          "Look for white-on-white text, zero-width characters and instructions naming an address outside the organisation. These are the standard hiding places, and a plain text scan finds most of them.",
      },
    ],
    effort: "Days",
    team: "Platform engineering",
    verification:
      "Change a live prompt outside the review path and confirm the difference is detected before the next run.",
  },
  {
    n: 5,
    name: "Authenticate agents to each other, and sign what they send",
    short: "Inter-agent authentication",
    description:
      "Agents prove who they are with certificates before they can talk, registration is closed, and every message between them is signed and checked.",
    guideline:
      "Inter-agent security: Enforce mutual auth and attestation via PKI and mTLS; no open registration; sign and verify all inter-agent messages.",
    steps: [
      {
        text: "Give each agent a certificate and require both sides to authenticate before any message is exchanged.",
        example:
          "Issue a certificate per agent identity and enforce mutual authentication at the transport. Without it, anything that can reach the network can present itself as an internal agent, which is all an agent-in-the-middle attack needs.",
      },
      {
        text: "Close registration so an agent cannot join the estate without an approval.",
        example:
          "Open registries are how a fake “Admin Helper” appears among genuine agents. Require a named owner and an approval before an agent card is accepted, and publish the list of who is legitimately in.",
      },
      {
        text: "Sign every inter-agent message and verify the signature on receipt.",
        example:
          "A signed instruction from the Procurement Assistant to the Invoice Processor can be traced to its sender. An unsigned one can be replayed or fabricated by anything sitting between them.",
      },
      {
        text: "Attest the peer's identity against the registry rather than believing its self-description.",
        example:
          "An agent card advertising broad capabilities is a claim by the peer about itself. Check the identity against the approved registry entry before routing work to it, or exaggerated claims win the task.",
      },
    ],
    effort: "Weeks",
    team: "Architecture",
    verification:
      "Present an unregistered agent identity to the estate and confirm peers refuse to exchange messages with it.",
  },
  {
    n: 6,
    name: "Re-verify components while they are running",
    short: "Continuous validation",
    description:
      "Signatures, hashes and bills of materials are re-checked at run time, and behaviour, privilege use and component lineage are monitored for anomalies.",
    guideline:
      "Continuous validation and monitoring: Re-check signatures, hashes, and SBOMs (incl. AIBOMs) at runtime; monitor behavior, privilege use, lineage, and inter-module telemetry for anomalies.",
    steps: [
      {
        text: "Re-check signatures and hashes at run time, not only at build.",
        example:
          "Verify each tool descriptor and prompt when the agent loads it. Agentic estates compose at run time, so a build-time check says nothing about the MCP server that joined the session ten minutes ago.",
      },
      {
        text: "Monitor behaviour and privilege use per component so a compromised one stands out.",
        example:
          "A knowledge plug-in that has always read from a single index suddenly opens an outbound connection. That deserves an alert even though nothing about its signature changed, because a poisoned component keeps its identity and changes only what it does.",
      },
      {
        text: "Track lineage so you can tell where a piece of context or a tool result came from.",
        example:
          "When a briefing turns out to be wrong, lineage tells you whether it came from the warehouse or from a third-party index someone seeded. Without it, you are guessing at which source to distrust.",
      },
      {
        text: "Alert on changes to a component's identity between runs.",
        example:
          "Same tool name, different hash, is the tell for descriptor poisoning. Nothing in the agent's own logs will show it, because from the agent's point of view it called the tool it always calls.",
      },
    ],
    effort: "Weeks",
    team: "Security operations",
    verification:
      "Alter a tool descriptor's content in place and confirm the next run refuses it and raises an alert.",
  },
  {
    n: 7,
    name: "Pin by hash, roll out in stages, roll back automatically",
    short: "Hash pinning & staged rollout",
    description:
      "Prompts, tools and configuration are pinned by content hash and commit, changes go out in stages with differential tests, and drift rolls back on its own.",
    guideline:
      "Pinning: Pin prompts, tools, and configs by content hash and commit ID. Require staged rollout with differential tests and auto-rollback on hash drift or behavioral change.",
    steps: [
      {
        text: "Pin every prompt, tool and configuration by content hash and commit, not by a moving tag.",
        example:
          "Reference the clause-library prompt by its hash and the commit it came from. A tag like “latest” means the component can change without any change on your side and without any record of it.",
      },
      {
        text: "Roll changes out in stages rather than to the whole estate at once.",
        example:
          "Move a new tool version onto the Supplier Screener before the Procurement Assistant and the Invoice Processor. A poisoned release then affects one agent for an afternoon instead of every agent immediately.",
      },
      {
        text: "Run differential tests comparing the new version's behaviour against the old on the same inputs.",
        example:
          "Replay fifty recent tasks through both versions and compare the tool calls and outputs. A version that starts adding a recipient or widening a query shows up here and nowhere else.",
      },
      {
        text: "Roll back automatically on hash drift or on a behavioural change the tests did not expect.",
        example:
          "Automatic rollback turns a compromise into a blip. A rollback that needs someone to notice and decide takes hours, which is long enough for a coding agent to have installed the change everywhere.",
      },
    ],
    effort: "Weeks",
    team: "Platform engineering",
    verification:
      "Change a pinned component's content without changing its version and confirm the rollout halts and reverts on its own.",
  },
  {
    n: 8,
    name: "Be able to switch a component off everywhere at once",
    short: "Supply chain kill switch",
    description:
      "There is a tested way to revoke a specific tool, prompt or agent connection across every deployment immediately, so a discovered compromise stops spreading.",
    guideline:
      "Supply chain kill switch: Implement emergency revocation mechanisms that can instantly disable specific tools, prompts, or agent connections across all deployments when a compromise is detected, preventing further cascading damage.",
    steps: [
      {
        text: "Build one revocation mechanism that reaches every deployment, rather than a per-environment procedure.",
        example:
          "A denylist the orchestrator consults before loading any component gives you one place to act. Disabling a compromised MCP server environment by environment takes hours you will not have.",
      },
      {
        text: "Make it work at the granularity of a single tool, prompt or peer connection.",
        example:
          "When one MCP server is found to be malicious you want that server off, not all thirteen agents stopped. An all-or-nothing switch is one nobody is willing to pull.",
      },
      {
        text: "Decide in advance who may pull it and on what evidence.",
        example:
          "Name the role that may pull it, and state that a credible external advisory is enough evidence to act on. Waiting for internal confirmation first is what turned several published supply chain incidents into estate-wide ones.",
      },
      {
        text: "Rehearse it against a real component on a schedule.",
        example:
          "Revoke a low-risk tool in a live rehearsal and time how long until every agent stops using it. An untested kill switch is a design, and the rehearsal is where you find the cached copy that keeps working.",
      },
    ],
    effort: "Days",
    team: "Security operations",
    verification:
      "Revoke a component in a rehearsal and confirm every agent stops loading it within the time you have committed to.",
  },
  {
    n: 9,
    name: "Design as though a component will be compromised",
    short: "Zero-trust agent design",
    description:
      "The architecture assumes that some model, tool or agent will eventually fail or be exploited, and is built so that when it does the damage is contained.",
    guideline:
      "Zero-trust security model in application design: design system with security fault tolerance that assumes failure or exploitation of LLM or agentic function components.",
    steps: [
      {
        text: "Work through what each component could do if it were fully attacker-controlled.",
        example:
          "Ask it of the knowledge plug-in, the MCP server and each peer agent in turn. Teams reliably find one component whose compromise reaches the ledger through three hops nobody had drawn before.",
      },
      {
        text: "Put a check outside the component on anything consequential, so no single component can act alone.",
        example:
          "A payment should have to satisfy a policy engine and a person as well as the agent proposing it. If a compromised tool can complete a payment on its own, the tool is the whole control.",
      },
      {
        text: "Contain each component so its failure does not reach the others.",
        example:
          "Separate identities, separate sandboxes and no shared standing credentials mean a compromised plug-in gets what that plug-in had. Shared service accounts are what turn one bad component into an estate-wide incident.",
      },
      {
        text: "Test the assumption by simulating a compromised component end to end.",
        example:
          "Stand up a deliberately hostile test tool in a non-production estate and see how far it gets. This is the only way to find out whether the containment you designed is the containment you deployed.",
      },
    ],
    effort: "Weeks",
    team: "Architecture",
    verification:
      "Run a hostile test component in a non-production estate and confirm it cannot complete a consequential action unaided.",
  },
];

const SCENARIOS: readonly AttackScenario[] = [
  {
    title: "Poisoned release of a coding agent extension",
    description:
      "A poisoned prompt is committed into a widely used coding assistant's repository and ships in a released version to thousands of users before anyone notices. Even though the payload failed, it shows how tampering with an agent's own logic cascades through extension channels.",
    brokenBy: [1, 4, 7, 8],
  },
  {
    title: "MCP tool descriptor poisoning",
    description:
      "A public tool hides instructions inside its metadata, which the assistant reads as trusted guidance. When the tool is invoked, private repository data is sent out without the user seeing anything unusual.",
    brokenBy: [1, 6, 2, 9],
  },
  {
    title: "Malicious MCP server impersonating a real one",
    description:
      "A package published under a name close to a legitimate email service's MCP server is installed by users expecting the real thing. It works as advertised while quietly copying every message to the attacker.",
    brokenBy: [2, 1, 5, 8],
  },
  {
    title: "Prompt-hub proxy attack",
    description:
      "An agent pulls its prompts through a hosted prompt service that has been subverted into proxying them. The service exfiltrates the data passing through and manipulates the responses that come back, steering the orchestration.",
    brokenBy: [4, 7, 1, 6],
  },
  {
    title: "Compromised package installed automatically by a coding agent",
    description:
      "A poisoned release of a popular package is installed automatically by coding agents as part of ordinary work. It opens a hidden backdoor that collects SSH keys and API tokens and spreads the compromise across every workflow those agents touch.",
    brokenBy: [2, 3, 7, 8],
  },
  {
    title: "Agent-in-the-middle via a forged agent card",
    description:
      "A rogue peer advertises exaggerated capabilities in its published agent card, so host agents choose it for tasks. Sensitive requests and data are then routed through an attacker-controlled agent that exfiltrates or corrupts the responses.",
    brokenBy: [5, 1, 6, 9],
  },
];

/** What the standard publishes, used for the coverage summary. */
export const ASI04_PUBLISHED = { controls: 9, scenarios: 6 } as const;

export const ASI04: RiskDetail | undefined =
  CONTROLS.length > 0 ? { id: "ASI04", scenarios: SCENARIOS, controls: CONTROLS } : undefined;
