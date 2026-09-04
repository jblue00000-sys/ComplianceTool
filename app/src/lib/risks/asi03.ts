import type { AttackScenario, Control, RiskDetail } from "./types";

/**
 * ASI03 Identity and Privilege Abuse.
 * Source: OWASP Top 10 for Agentic Applications 2026, version 12.6.
 */

const CONTROLS: readonly Control[] = [
  {
    n: 1,
    name: "Issue permissions per task, with an expiry",
    short: "Task-scoped, time-bound rights",
    description:
      "Each agent works with its own identity and a token cut to the task in front of it, which expires when the task does.",
    guideline:
      "Enforce Task-Scoped, Time-Bound Permissions: Issue short-lived, narrowly scoped tokens per task and cap rights with permission boundaries - using per-agent identities and short-lived credentials (e.g., mTLS certificates or scoped tokens) - to limit blast radius, block delegated-abuse and maintenance-window attacks, and mitigate un-scoped inheritance, orphaned privileges, and reflection-loop elevation.",
    steps: [
      {
        text: "Give every agent its own identity rather than letting it act as a shared service account or as the user.",
        example:
          "The Invoice Processor and the Treasury Reconciler both touch the ledger, and both usually end up on the same finance integration account. Separate identities are what make it possible to say which one moved the money, and to revoke one without stopping the other.",
      },
      {
        text: "Mint a token per task, scoped to the records that task needs and nothing wider.",
        example:
          "A token for “reconcile the October Acme invoices” should reach the Acme supplier records for that period. A token that reaches every supplier because it was easier to issue turns one poisoned invoice into an estate-wide problem.",
      },
      {
        text: "Set the lifetime to the expected length of the task, and let it lapse rather than be renewed by default.",
        example:
          "A reconciliation run takes minutes, so the token should last minutes. Tokens that live for a day are what an attacker collects during a maintenance window and uses that evening.",
      },
      {
        text: "Cap the ceiling with a permission boundary so no delegation can exceed it, whatever the caller holds.",
        example:
          "Attach a boundary saying the HR Intake Agent can never reach payroll, no matter which manager delegated to it. Without a ceiling, least privilege depends on every caller getting the scoping right every time.",
      },
    ],
    effort: "Weeks",
    team: "Security engineering",
    verification:
      "Take a token issued for one task, use it against a record outside that task, and confirm it is refused; then confirm it also stops working after its stated lifetime.",
  },
  {
    n: 2,
    name: "Keep each agent's identity and memory separate",
    short: "Identity & context isolation",
    description:
      "Agents run in per-session sandboxes with their own permissions and memory, wiped between tasks, so nothing from one job leaks into the next.",
    guideline:
      "Isolate Agent Identities and Contexts: Run per-session sandboxes with separated permissions and memory, wiping state between tasks to prevent Memory-Based Escalation and reduce Cross-Repository Data Exfiltration.",
    steps: [
      {
        text: "Give each session its own sandbox rather than sharing one long-running process across users.",
        example:
          "One Customer Support Bot process serving every conversation means one customer's record can surface in another's reply. A sandbox per session costs a little more and removes the whole class of leak.",
      },
      {
        text: "Clear memory and cached credentials between tasks, not just between days.",
        example:
          "If the Dev Assistant handles a production incident and then a routine pull request, the credentials from the incident must be gone before the second task starts. Otherwise the routine task is running with incident-grade access nobody granted it.",
      },
      {
        text: "Segment stored context by the user and the task it came from, so a later run cannot read across.",
        example:
          "Tag every stored item with the identity it was gathered under and filter retrieval on that tag. Shared vector stores are the usual failure: an executive briefing indexed once is retrievable by whoever asks next.",
      },
      {
        text: "Prove the wipe actually happens rather than trusting the framework's default.",
        example:
          "Plant a marker string during one task and search for it at the start of the next. Most agent frameworks keep something — a scratch file, a conversation buffer, a cached token — that the documentation does not mention.",
      },
    ],
    effort: "Weeks",
    team: "Platform engineering",
    verification:
      "Plant a unique marker during one session and confirm a following session on the same infrastructure cannot retrieve it.",
  },
  {
    n: 3,
    name: "Re-check authorisation at every privileged step",
    short: "Per-action authorisation",
    description:
      "A central policy engine decides each privileged action on its own merits, rather than the workflow assuming the check it did at the start still holds.",
    guideline:
      "Mandate Per-Action Authorization: Re-verify each privileged step with a centralized policy engine that checks external data, stopping Cross-Agent Trust Exploitation and Reflection Loop Elevation.",
    steps: [
      {
        text: "Move the decision out of the agent and into one policy engine every agent must call.",
        example:
          "Thirteen agents each deciding for themselves gives you thirteen policies that drift. One engine gives a single place to tighten a rule and a single record of what was permitted.",
      },
      {
        text: "Re-evaluate before each privileged action rather than once per workflow.",
        example:
          "The Procurement Assistant should be re-authorised at place_order, not only when the run began. Between those two moments the buyer's limit may have changed, their role may have changed, or the run may have been redirected.",
      },
      {
        text: "Have the engine consult live external data — role, limit, employment status — instead of what the agent passed it.",
        example:
          "Read the approver's current spending limit from the source system at decision time. A limit the agent read at the start of the run and carried along is a claim, and a hijacked agent can make that claim say anything.",
      },
      {
        text: "Check the originating human's rights, not just the calling agent's, when one agent asks another.",
        example:
          "When the email sorter asks the Treasury Reconciler to pay something, the question is whether the person behind the request may authorise that payment. Trusting the caller because it is internal is precisely the confused-deputy mistake.",
      },
    ],
    effort: "Weeks",
    team: "Platform engineering",
    verification:
      "Reduce a user's rights mid-workflow and confirm the next privileged step is refused rather than proceeding on the earlier decision.",
  },
  {
    n: 4,
    name: "Require a person to approve privilege escalation",
    short: "Human approval on escalation",
    description:
      "When an agent needs rights beyond its usual scope, or is about to do something irreversible, a named person approves it first.",
    guideline:
      "Apply Human-in-the-Loop for Privilege Escalation: Require human approval for high-privilege or irreversible actions to provide a safety net that would stop Memory-Based Escalation, Cross-Agent Trust Exploitation, and Maintenance Window attacks.",
    steps: [
      {
        text: "Write down which actions count as high-privilege or irreversible for each agent.",
        example:
          "For the Dev Assistant that is anything touching production and anything creating an account or a key. Teams that skip the list end up deciding in the moment, which in practice means approving.",
      },
      {
        text: "Stop those actions for approval by a person who is not the requester.",
        example:
          "An engineer asking the agent to create a service account should not be the one who approves it. Self-approval turns the control into a confirmation dialogue.",
      },
      {
        text: "Show the approver what rights are being granted and who ultimately asked, not just the action name.",
        example:
          "“Create account with domain-admin rights, requested via the security triage agent, originating from a ticket raised by an external address” gives the approver something to refuse. “Create account” does not.",
      },
      {
        text: "Give the approval an expiry and a single use, so it cannot be replayed.",
        example:
          "An approval valid for five minutes and one action prevents a granted escalation from being reused later in the run. Standing approvals quietly become permanent permissions.",
      },
    ],
    effort: "Days",
    team: "Agent owner",
    verification:
      "Have an agent request rights above its profile and confirm it halts for approval, and that the same approval cannot be used twice.",
  },
  {
    n: 5,
    name: "Bind tokens to a signed statement of intent",
    short: "Intent-bound tokens",
    description:
      "Each token carries a signed record of who it is for, what it is for and which session it belongs to, and is refused when the request does not match.",
    guideline:
      "Define Intent: Bind OAuth tokens to a signed intent that includes subject, audience, purpose, and session. Reject any token use where the bound intent doesn’t match the current request.",
    steps: [
      {
        text: "Record the subject, audience, purpose and session at the moment a token is issued.",
        example:
          "“Issued for buyer J. Okafor, to SAP Ariba, to place purchase order 4471, in session 9c2f.” All four matter: purpose alone still lets the token be replayed in a different session.",
      },
      {
        text: "Sign that statement so it cannot be edited in flight.",
        example:
          "Sign the intent with the issuing service's key and verify it at the resource. An unsigned intent field is a comment — anything that can pass the token can rewrite the comment beside it.",
      },
      {
        text: "Check the bound intent against the actual request at the resource, and reject on any mismatch.",
        example:
          "A token bound to purchase order 4471 presented against order 4610 must be refused, even though both are legitimate orders and the buyer is the same. That mismatch is what a redirected agent looks like.",
      },
      {
        text: "Fail closed when the intent is absent or unreadable.",
        example:
          "A token arriving with no intent should be refused, not treated as unrestricted. Treating a missing field as permission is how a rollout with two systems half-migrated becomes a gap.",
      },
    ],
    effort: "Weeks",
    team: "Security engineering",
    verification:
      "Present a valid token against a resource outside its bound purpose and confirm the resource refuses it.",
  },
  {
    n: 6,
    name: "Manage agents as identities in the identity platform",
    short: "Agentic identity management",
    description:
      "Agents are enrolled in the organisation's identity and access management system as governed non-human identities, with the same lifecycle and audit as any other account.",
    guideline:
      "Evaluate Agentic Identity Management Platforms. Major platforms integrate agents into their identity and access management systems, treating them as managed non-human identities with scoped credentials, audit trails, and lifecycle controls. Examples include Microsoft Entra, AWS Bedrock Agents, Salesforce Agentforce, Workday’s Agentic System of Record (ASOR) model, and similar emerging patterns in Google Vertex AI.",
    steps: [
      {
        text: "Assess what your existing identity platform already offers for non-human identities.",
        example:
          "Most organisations are already paying for something that manages service principals or workload identities. Starting there is usually faster than adopting an agent-specific tool that the joiners and leavers process does not know about.",
      },
      {
        text: "Enrol each agent as a managed identity with a named owner and a review date.",
        example:
          "Register the Exec Briefing Agent with its business owner recorded and a quarterly access review, exactly as a contractor account would be. Ownerless agents are the ones still running with live credentials two years after the project ended.",
      },
      {
        text: "Bring agent credentials into the platform's issuance and rotation, rather than leaving keys in configuration.",
        example:
          "Let the platform mint and rotate the credential. A key pasted into a deployment variable during a pilot outlives the pilot and never rotates.",
      },
      {
        text: "Make decommissioning part of the lifecycle so retiring an agent removes its access.",
        example:
          "Switching off the container is not decommissioning; the token, the mailbox rule and the CRM integration user all survive it. Tie the retirement to the identity record so removal is one step.",
      },
    ],
    effort: "Weeks",
    team: "Architecture",
    verification:
      "Pick a retired agent and confirm no live credential, session or integration account of its remains usable.",
  },
  {
    n: 7,
    name: "Tie permissions to subject, resource, purpose and duration",
    short: "Bounded, re-validated permissions",
    description:
      "Access is granted as a four-part statement rather than a role, cannot be inherited between agents without re-validation, and is withdrawn automatically when idle or anomalous.",
    guideline:
      "Bind permissions to subject, resource, purpose, and duration. Require re-authentication on context switch. Prevent privilege inheritance across agents unless the original intent is re-validated. Include automated revocation on idle or anomaly.",
    steps: [
      {
        text: "Express each grant as subject, resource, purpose and duration rather than as a role name.",
        example:
          "“The Contract Reviewer, on the Acme master agreement, to draft a renewal clause, for this session” is checkable. “Contract Reviewer role” tells you nothing about which contract or why.",
      },
      {
        text: "Force re-authentication when the context changes — a new user, a new task, a new system.",
        example:
          "When the Scheduler moves from one requester's diary to another's, that is a context switch. Carrying the first requester's session into the second is how one person's calendar becomes readable to another.",
      },
      {
        text: "Block privilege inheritance across agents unless the original intent is re-validated at the receiving end.",
        example:
          "When a manager agent hands work to a worker agent, the worker should request its own rights for that job. Passing the manager's context down is the un-scoped inheritance the standard warns about, and it is almost always done for convenience.",
      },
      {
        text: "Revoke automatically on idle or on anomaly rather than waiting for a review.",
        example:
          "A grant unused for an hour should lapse; a grant used in a pattern the agent has never shown should be pulled and raised. Both happen faster than any human review cycle.",
      },
    ],
    effort: "Weeks",
    team: "Security engineering",
    verification:
      "Switch an agent's requesting user mid-session and confirm it re-authenticates rather than reusing the earlier context.",
  },
  {
    n: 8,
    name: "Watch for rights arriving through delegation chains",
    short: "Delegated privilege detection",
    description:
      "Monitoring shows when an agent has picked up permissions indirectly, and flags a low-privilege agent that ends up holding high-privilege scopes.",
    guideline:
      "Detect Delegated and Transitive Permissions: Monitor when an agent gains new permissions indirectly through delegation chains. Flag cases where a low-privilege agent inherits or is handed higher-privilege scopes during multi-agent workflows.",
    steps: [
      {
        text: "Record the delegation chain on every multi-agent call, not just the immediate caller.",
        example:
          "Log that the payment originated with an email, passed through the sorter, then the Treasury Reconciler. With only the last hop you see an internal agent making a routine call, which is exactly what it is designed to look like.",
      },
      {
        text: "Compute each agent's effective permissions, including everything reachable through delegation.",
        example:
          "The Supplier Screener may hold read-only scopes of its own while being able to ask the Procurement Assistant to place an order. Its effective privilege is the union, and that is the number worth reviewing.",
      },
      {
        text: "Alert when an agent's effective rights exceed its own approved profile.",
        example:
          "A low-privilege agent that briefly holds finance scopes during a workflow is the pattern to catch. It usually appears the first time somebody wires two agents together to fix a hand-off.",
      },
      {
        text: "Review the delegation graph on a schedule, not only when something fires.",
        example:
          "Draw the who-can-ask-whom map quarterly. New edges appear without anyone deciding to add them, and the graph is where an unintended path from a public-facing agent to a payment tool becomes visible.",
      },
    ],
    effort: "Days",
    team: "Security operations",
    verification:
      "Wire a test delegation that hands a low-privilege agent a finance scope and confirm the monitoring flags it.",
  },
  {
    n: 9,
    name: "Alert on scope requests outside the agreed intent",
    short: "Escalation & phishing detection",
    description:
      "Monitoring flags agents asking for new permissions, or reusing tokens beyond the purpose they were issued for, which is what cross-agent escalation and device-code phishing look like in the logs.",
    guideline:
      "Detect abnormal cross-agent privilege elevation and device-code style phishing flows by monitoring when agents request new scopes or reuse tokens outside their original, signed intent.",
    steps: [
      {
        text: "Log every scope request an agent makes and compare it with the scopes on its approved profile.",
        example:
          "The Reporting Analyst asking for a mailbox scope has no business reason to. It is a two-line comparison, and it catches an agent being steered into a consent flow it never normally touches.",
      },
      {
        text: "Alert specifically on device-code and out-of-band consent flows initiated by an agent.",
        example:
          "A browsing agent following a device-code link and a second agent completing the code is a normal-looking pair of actions that binds your tenant to somebody else's scopes. Treat any agent-initiated device-code flow as an incident until proven otherwise.",
      },
      {
        text: "Detect tokens used outside the purpose they were signed for, even when the token itself is valid.",
        example:
          "A token issued to read a candidate CV that later appears against the interview calendar is being reused. Nothing has expired and nothing has been forged; the purpose no longer matches.",
      },
      {
        text: "Send these alerts to the security queue with the agent, the chain and the requested scope attached.",
        example:
          "The responder needs to know which agent asked, who was behind it and what was requested, or the first ten minutes go on working that out. Escalation alerts without the chain get closed as noise.",
      },
    ],
    effort: "Days",
    team: "Security operations",
    verification:
      "Trigger an agent-initiated consent flow in a test tenant and confirm an alert reaches the security queue.",
  },
];

const SCENARIOS: readonly AttackScenario[] = [
  {
    title: "Delegated privilege abuse",
    description:
      "A finance agent hands work to a database query agent and passes its full set of permissions along with it. An attacker steering the query prompts uses that inherited access to pull HR and legal data the query agent should never have been able to see.",
    brokenBy: [1, 7, 8, 3],
  },
  {
    title: "Escalation through cached credentials",
    description:
      "An IT administration agent caches SSH credentials while running a patch. Later a non-administrator picks up the same session and prompts the agent to use those credentials to create an unauthorised account.",
    brokenBy: [2, 1, 4, 7],
  },
  {
    title: "Cross-agent trust exploitation",
    description:
      "A crafted email claiming to be from IT tells an email sorting agent to instruct the finance agent to move money. The sorter passes it on, and the finance agent processes the payment because the request came from another internal agent.",
    brokenBy: [3, 4, 8, 5],
  },
  {
    title: "Device-code phishing across agents",
    description:
      "An attacker shares a device-code link that a browsing agent follows, while a separate helper agent completes the code. The result binds the organisation's tenant to scopes the attacker controls, with no credential ever stolen.",
    brokenBy: [9, 4, 3, 6],
  },
  {
    title: "Authorisation drift within a workflow",
    description:
      "A procurement agent checks approval at the start of a purchase sequence. Hours later the buyer's spending limit is reduced, but the workflow completes on the old authorisation token and the now-unauthorised purchase goes through.",
    brokenBy: [3, 1, 7, 5],
  },
  {
    title: "Forged agent persona in the registry",
    description:
      "An attacker registers a fake “Admin Helper” agent in an internal agent registry with a forged agent card. Other agents trust the descriptor and route privileged maintenance tasks to it, and it then issues system-level commands under assumed internal trust.",
    brokenBy: [3, 6, 4, 9],
  },
  {
    title: "Shared identity across users",
    description:
      "An agent is connected to systems using its maker's own access. Other people then use the agent's tools and act with that person's identity implicitly, with no record that it was anyone else.",
    brokenBy: [1, 7, 6, 2],
  },
];

/** What the standard publishes, used for the coverage summary. */
export const ASI03_PUBLISHED = { controls: 9, scenarios: 7 } as const;

export const ASI03: RiskDetail | undefined =
  CONTROLS.length > 0 ? { id: "ASI03", scenarios: SCENARIOS, controls: CONTROLS } : undefined;
