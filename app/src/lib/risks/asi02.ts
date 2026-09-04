import type { AttackScenario, Control, RiskDetail } from "./types";

/**
 * ASI02 Tool Misuse and Exploitation.
 * Source: OWASP Top 10 for Agentic Applications 2026, version 12.6.
 */

const CONTROLS: readonly Control[] = [
  {
    n: 1,
    name: "Give each tool the narrowest profile its job needs",
    short: "Least-privilege tool profiles",
    description:
      "Every tool the agent can call has a written profile — what it may reach, how often, and where it may send data — enforced by the access platform rather than by convention.",
    guideline:
      "Least Agency and Least Privilege for Tools. Define per-tool least-privilege profiles (scopes, maximum rate, and egress allowlists) and restrict agentic tool functionality and each tool’s permissions and data scope to those profiles – e.g., read-only queries for databases, no send/delete rights for email summarizers, and minimal CRUD operations when exposing APIs. Where possible, express these profiles as IAM or authorization policy stanzas attached to each tool, rather than relying on ad-hoc conventions.",
    steps: [
      {
        text: "Write a profile for each tool covering its scopes, its maximum call rate and the destinations it may reach.",
        example:
          "The Reporting Analyst's run_query tool gets read-only access to the reporting schema, a ceiling of sixty queries an hour, and no outbound network at all. Writing the ceiling down matters as much as the scope: an unbounded read-only tool can still empty a warehouse into a chart nobody asked for.",
      },
      {
        text: "Cut each tool's data scope to the objects the agent actually works on, not the whole system it lives in.",
        example:
          "The Supplier Screener needs the supplier and opportunity records. The connector it ships with usually grants every object in the CRM, so a screening question can return the full customer list. Narrow it at the integration user, not in the prompt.",
      },
      {
        text: "Express the profile as an IAM or authorisation policy attached to the tool, so the limit holds even if the agent is talked into ignoring it.",
        example:
          "“The summariser must not delete mail” in a system prompt is a suggestion. The same rule as a mailbox role without the delete permission is a control — an injected instruction cannot grant a scope the token never had.",
      },
      {
        text: "Review the profiles on a schedule and confirm the live grants still match them.",
        example:
          "Compare each agent's live scopes against its approved profile every quarter. Scopes widen during an incident and are almost never narrowed back — the Invoice Processor picking up write access to the ledger during a month-end fix is the classic case.",
      },
    ],
    effort: "Days",
    team: "Platform engineering",
    verification:
      "Call each tool with an argument outside its written profile and confirm the platform, not the prompt, refuses it.",
  },
  {
    n: 2,
    name: "Authenticate every call and get a person to approve destructive ones",
    short: "Action-level auth & approval",
    description:
      "Each tool invocation carries its own authentication, and anything that deletes, moves money or publishes stops for a person who can see exactly what is about to happen.",
    guideline:
      "Action-Level Authentication and Approval. Require explicit authentication for each tool invocation and human confirmation for high-impact or destructive actions (delete, transfer, publish). Display a pre-execution plan or dry-run diff before final approval; where possible, present a dry-run or diff preview to the user before high-impact actions are approved.",
    steps: [
      {
        text: "Require authentication on each invocation rather than once per session.",
        example:
          "A Dev Assistant session that authenticates once at start-up and then runs for six hours gives an attacker a six-hour window. Authenticating per call means a hijacked mid-run plan has to pass the same check as the first one.",
      },
      {
        text: "List the actions that delete, transfer or publish, and route each through a human confirmation.",
        example:
          "For the Treasury Reconciler that is any payment or ledger adjustment; for the Campaign Writer it is publishing a live ad and raising a budget. Teams usually catch the payment and miss the budget rise, which is how a 340% increase goes out unreviewed.",
      },
      {
        text: "Show the approver a dry run or difference preview of the real action, not the agent's description of it.",
        example:
          "Present the actual payload: payee, account, amount and matched purchase order. “I'll settle the outstanding Acme invoice” reads fine even when the account number underneath belongs to somebody else.",
      },
      {
        text: "Make the approval bind to that exact payload, so nothing can change between approval and execution.",
        example:
          "Hash the approved arguments and have the tool refuse anything that does not match. Otherwise the agent can re-plan between the click and the call, and the approval covers an action nobody saw.",
      },
    ],
    effort: "Days",
    team: "Agent owner",
    verification:
      "Approve a payment, alter one argument before it executes, and confirm the call is rejected rather than run.",
  },
  {
    n: 3,
    name: "Run tools in a sandbox that can only reach approved destinations",
    short: "Sandboxing & egress control",
    description:
      "Tool and code execution happens in an isolated environment whose outbound network is limited to a named allowlist, so stolen data has nowhere to go.",
    guideline:
      "Execution Sandboxes and Egress Controls. Run tool or code execution in isolated sandboxes. Enforce outbound allowlists and deny all non-approved network destinations.",
    steps: [
      {
        text: "Move tool and code execution into an isolated sandbox with no standing access to the corporate network.",
        example:
          "The Dev Assistant's run_shell tool should execute in a throwaway container holding only the checkout it needs. Run it on the build host instead and one injected command reaches the CI credentials, the artefact store and everything else that host can see.",
      },
      {
        text: "Deny all outbound traffic by default and allowlist the specific destinations each tool genuinely needs.",
        example:
          "The Supplier Screener needs the sanctions API and Companies House. Everything else — including any address an injected instruction supplies — should fail at the network, not be caught by a filter that has to recognise it first.",
      },
      {
        text: "Cover the quiet egress paths, not just HTTP.",
        example:
          "DNS lookups, webhook callbacks and email are all ways out. An agent allowed to resolve arbitrary hostnames can spell out a customer list one subdomain at a time, and nothing in the HTTP allowlist will notice.",
      },
      {
        text: "Discard the sandbox after each run so nothing persists between tasks.",
        example:
          "A fresh container per run means a file written during a poisoned task cannot be read by the next one. Long-lived sandboxes accumulate credentials, caches and half-finished work that the following task inherits.",
      },
    ],
    effort: "Weeks",
    team: "Platform engineering",
    verification:
      "From inside the sandbox, attempt an HTTP call and a DNS lookup to an unlisted domain and confirm both fail.",
  },
  {
    n: 4,
    name: "Put a policy gate in front of every tool call",
    short: "Intent gate before execution",
    description:
      "What the model proposes is treated as a request, not an instruction: a policy checkpoint validates the intent and the arguments before anything runs.",
    guideline:
      "Policy Enforcement Middleware (“Intent Gate”). Treat LLM or planner outputs as untrusted. A pre-execution Policy Enforcement Point (PEP/PDP) validates intent and arguments, enforces schemas and rate limits, issues short-lived credentials, and revokes or audits on drift.",
    steps: [
      {
        text: "Route every tool call through one enforcement point instead of letting the agent call tools directly.",
        example:
          "One gate in front of all thirteen agents gives you a single place to change a rule and a single log to read. Per-agent checks in prompt text drift apart within weeks and cannot be audited together.",
      },
      {
        text: "Validate the arguments against a schema and reject anything that does not fit, rather than coercing it.",
        example:
          "issue_refund takes an order reference and an amount bounded by that order's value. A refund of £4,000 against an £80 order is a schema failure, not a judgement call the model should be making.",
      },
      {
        text: "Check the call against the task the agent was actually given, not just against the schema.",
        example:
          "A Contract Reviewer asked to summarise renewal terms has no business calling draft_clause on a different contract. The arguments may be perfectly well-formed; the intent is the part that does not match.",
      },
      {
        text: "Have the gate issue short-lived credentials per call and revoke on drift.",
        example:
          "The gate mints a token scoped to that one call and valid for seconds. When the agent starts calling tools in an order it never has before, revoke and raise it rather than waiting for the run to end.",
      },
    ],
    effort: "Weeks",
    team: "Platform engineering",
    verification:
      "Send a well-formed tool call that is outside the current task's scope and confirm the gate blocks and logs it.",
  },
  {
    n: 5,
    name: "Cap what each agent may spend and throttle when it runs over",
    short: "Tool budgets & throttling",
    description:
      "Every agent has a ceiling on cost, call rate and tokens, and crossing it throttles or cuts access automatically instead of generating a bill.",
    guideline:
      "Adaptive Tool Budgeting. Apply usage ceilings (cost, rate, or token budgets) with automatic revocation or throttling when exceeded.",
    steps: [
      {
        text: "Set a per-agent ceiling on cost, calls and tokens for a normal day's work.",
        example:
          "The Customer Support Bot handles perhaps two hundred tickets a day and issues a handful of refunds. Eleven refunds in four minutes is far outside that shape, and a ceiling catches it before a person reads the alert.",
      },
      {
        text: "Enforce the ceiling in the platform so breaching it throttles or revokes access automatically.",
        example:
          "A budget that only sends an email is a report. The Reporting Analyst looping on an expensive warehouse query at two in the morning needs the tool to stop answering, not a note about it at nine.",
      },
      {
        text: "Cap the loop as well as the day — bound the calls a single run may make.",
        example:
          "Give each run a maximum of, say, forty tool calls. A planner that retries a failing API forever stays inside a daily budget for hours while doing nothing but burning it.",
      },
      {
        text: "Alert on the approach to the ceiling, not only on the breach.",
        example:
          "Warning at seventy per cent gives the owner time to look. An agent that hits its ceiling at eleven in the morning is either compromised or under-provisioned, and both need a person.",
      },
    ],
    effort: "Days",
    team: "Platform engineering",
    verification:
      "Drive an agent past its ceiling in a test and confirm the tool stops answering rather than merely alerting.",
  },
  {
    n: 6,
    name: "Issue credentials that expire the moment the job is done",
    short: "Just-in-time credentials",
    description:
      "Tokens are minted for a single task, tied to the session that requested them, and are worthless a minute later.",
    guideline:
      "Just-in-Time and Ephemeral Access. Grant temporary credentials or API tokens that expire immediately after use. Bind keys to specific user sessions to prevent lateral abuse.",
    steps: [
      {
        text: "Replace standing API keys with credentials minted at the point of use.",
        example:
          "The Invoice Processor should request a ledger token when it has an invoice to post, not hold one in an environment variable. A long-lived key in a config file is readable by anything that can read the process, including a tool the agent was tricked into running.",
      },
      {
        text: "Set the lifetime to the length of the action, measured in seconds or minutes.",
        example:
          "A posting takes a second or two; a ten-minute token is generous. An hour-long token means an attacker who captures it in a log gets fifty-nine minutes of free use.",
      },
      {
        text: "Bind each credential to the session and user that triggered the work.",
        example:
          "A token minted for one buyer's purchase request should be refused when replayed under another session. Without that binding, a compromised low-value task becomes a way to act as somebody else.",
      },
      {
        text: "Sweep for the standing keys the change was meant to remove.",
        example:
          "Search configuration, secret stores and CI variables for the old credentials and revoke them. Just-in-time access proves nothing while the previous key still works alongside it.",
      },
    ],
    effort: "Days",
    team: "Security engineering",
    verification:
      "Capture a credential from a completed run, replay it from another session, and confirm it is rejected.",
  },
  {
    n: 7,
    name: "Resolve tools by full name and version, and check what the call means",
    short: "Semantic & identity validation",
    description:
      "Tools are addressed by a fully qualified, version-pinned name so a look-alike cannot be picked up, and the meaning of a call is checked rather than just its shape.",
    guideline:
      "Semantic and Identity Validation (‘Semantic Firewalls)”. Enforce fully qualified tool names and version pins to avoid tool alias collisions or typo squatted tools; validate the intended semantics of tool calls (e.g., query type or category) rather than relying on syntax alone. Fail closed on ambiguous resolution and prompt for user disambiguation.",
    steps: [
      {
        text: "Address every tool by a fully qualified name pinned to a version, never by a short alias.",
        example:
          "Register finance.internal/report_finance@2.3.1 rather than “report”. A tool called “report” that resolves ahead of “report_finance” sends the quarterly figures somewhere nobody chose, and the logs show a perfectly ordinary call.",
      },
      {
        text: "Fail closed when resolution is ambiguous and ask, rather than picking the first match.",
        example:
          "If two registries both offer a tool matching the name, stop and put the choice to a person. Silent first-match resolution is exactly the behaviour a typosquatted tool is registered to exploit.",
      },
      {
        text: "Validate what the call is trying to do, not just that its arguments parse.",
        example:
          "The Reporting Analyst's run_query should accept SELECT against the reporting schema and refuse anything that writes, drops or reaches across into the HR schema. Both are valid SQL; only one is what the tool is for.",
      },
      {
        text: "Keep the tool registry itself under change control and alert when its entries move.",
        example:
          "Hash each registered descriptor and compare it at start-up. A tool whose description changed overnight has either been updated by someone or poisoned by someone, and you want to know which before the next run.",
      },
    ],
    effort: "Weeks",
    team: "Architecture",
    verification:
      "Register a look-alike tool name in a test registry and confirm resolution stops and asks instead of choosing.",
  },
  {
    n: 8,
    name: "Log every tool call and watch for unusual chains",
    short: "Immutable logs & drift detection",
    description:
      "Every invocation and parameter change is recorded where it cannot be edited, and unusual sequences — an internal read followed by an external send — raise an alarm.",
    guideline:
      "Logging, Monitoring, and Drift Detection. Maintain immutable logs of all tool invocations and parameter changes. Continuously monitor for anomalous execution rates, unusual tool-chaining patterns (e.g., DB read followed by external transfer), and policy violations.",
    steps: [
      {
        text: "Record every invocation with its arguments to storage the agent's own credentials cannot alter.",
        example:
          "Write to an append-only store the agent has no write path to. A log the agent can reach is a log an injected instruction can tidy up, and the calls you most want to see are the ones that get removed.",
      },
      {
        text: "Alert on tool chains that cross a trust boundary, not just on individual calls.",
        example:
          "Each call may be authorised on its own. A CRM read followed within seconds by an external email send is the pattern worth paging on — every step passes, and the customer list still leaves the building.",
      },
      {
        text: "Baseline the normal rate and sequence for each agent so drift is measurable.",
        example:
          "The HR Intake Agent reads perhaps thirty CVs and books a dozen interviews a day, in that order. A day where it sends four hundred emails and reads nothing is a different agent in all but name.",
      },
      {
        text: "Route the alerts to a queue somebody works, and record what was done about each.",
        example:
          "Send them to the same on-call queue as other security alerts, with the agent, the chain and the arguments attached. An alert in an unread dashboard is documentation, not detection.",
      },
    ],
    effort: "Weeks",
    team: "Security operations",
    verification:
      "Run an internal read followed by an external send in a test and confirm an alert reaches the on-call queue.",
  },
];

const SCENARIOS: readonly AttackScenario[] = [
  {
    title: "Tool poisoning at the interface",
    description:
      "An attacker tampers with the tool layer itself — descriptors, schemas, metadata or routing — so the agent calls a legitimate tool believing it does something it does not. The tool is genuine; the description the agent reads has been rewritten underneath it.",
    brokenBy: [7, 4, 1, 8],
  },
  {
    title: "Indirect injection pivoting into a shell tool",
    description:
      "Instructions hidden in a PDF tell the agent to run a cleanup script and send the logs to an outside address. The agent obeys and invokes its local shell tool, entirely within the permissions it already holds.",
    brokenBy: [4, 1, 3, 2],
  },
  {
    title: "Over-privileged customer service API",
    description:
      "A support bot meant only to look up order history is wired to a financial API with full access, so it can also issue refunds. Nothing is compromised; the tool was simply given more reach than the job needs.",
    brokenBy: [1, 2, 4],
  },
  {
    title: "Internal query chained to external send",
    description:
      "The agent is talked into chaining an internal-only CRM tool with an external email tool, moving a sensitive customer list out to an attacker. Both tools are approved and both calls are authorised; it is the combination that does the damage.",
    brokenBy: [1, 3, 4, 8],
  },
  {
    title: "Tool name impersonation by typosquatting",
    description:
      "A tool registered as “report” resolves ahead of the genuine “report_finance”, so calls are misrouted to it. The agent discloses financial data to a tool it was never meant to reach.",
    brokenBy: [7, 4, 8],
  },
  {
    title: "Detection bypass by chaining trusted tools",
    description:
      "A security automation agent is given an injected instruction and strings together ordinary administrative tools — a shell, a transfer utility and internal APIs — to move sensitive logs out. Every command runs as a trusted binary under valid credentials, so endpoint monitoring sees nothing unusual.",
    brokenBy: [8, 3, 4, 2],
  },
  {
    title: "Data exfiltration through an auto-approved tool",
    description:
      "A coding agent has a set of tools approved to run without confirmation because they are considered harmless, including a network ping. An attacker drives repeated pings and carries data out inside the hostname lookups.",
    brokenBy: [3, 5, 8, 1],
  },
];

/** What the standard publishes, used for the coverage summary. */
export const ASI02_PUBLISHED = { controls: 8, scenarios: 7 } as const;

export const ASI02: RiskDetail | undefined =
  CONTROLS.length > 0 ? { id: "ASI02", scenarios: SCENARIOS, controls: CONTROLS } : undefined;
