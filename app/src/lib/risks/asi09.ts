import type { AttackScenario, Control, RiskDetail } from "./types";

/**
 * ASI09 Human-Agent Trust Exploitation.
 * Source: OWASP Top 10 for Agentic Applications 2026, version 12.6.
 */

const CONTROLS: readonly Control[] = [
  {
    n: 1,
    name: "Make people confirm before anything sensitive or risky happens",
    short: "Explicit confirmations",
    description:
      "Reaching sensitive data or taking a risky action requires a deliberate, separate approval rather than following on automatically from the conversation.",
    guideline:
      "Explicit confirmations: Require multi-step approval or “human in the loop” before accessing extra sensitive data or performing risky actions.",
    steps: [
      {
        text: "Write down which data and which actions require confirmation, and get the business owner to agree the list.",
        example:
          "For a finance copilot that is any outbound payment, any change to payee bank details and any bulk export of the ledger. Teams that skip this step end up confirming trivial actions and waving through the expensive ones, because nobody ever decided which was which.",
      },
      {
        text: "Make the confirmation a separate deliberate step, not a button in the same reply.",
        example:
          "The agent proposes the payment; the approval arrives in the banking system with its own screen and its own credentials. Confirming inside the same chat window where the agent has just made its persuasive case is how a single convincing message becomes an irreversible transfer.",
      },
      {
        text: "Show the raw facts of the action in the confirmation, not the agent's summary of it.",
        example:
          "Display the destination account number, the amount and the matched purchase order pulled from the source systems. If the confirmation screen simply repeats what the agent said, an agent working from a poisoned invoice will simply repeat the attacker's bank details there too.",
      },
      {
        text: "Require a second person for the highest-impact actions.",
        example:
          "Deleting a live production database, or paying a new payee above a threshold, needs two named approvers. One approver under time pressure with a confident-sounding rationale is exactly the situation this risk describes.",
      },
    ],
    effort: "Days",
    team: "Agent owner",
    verification:
      "Ask the agent to perform each action on the sensitive list and confirm every one stops for a separate confirmation showing source-system values.",
  },
  {
    n: 2,
    name: "Keep tamper-proof records of what was asked and what was done",
    short: "Immutable logs",
    description:
      "Every user query and every agent action is written to a record nobody can quietly edit, so an investigation can reconstruct who was influenced by what.",
    guideline:
      "Immutable logs: Keep tamper-proof records of user queries and agent actions for audit and forensics.",
    steps: [
      {
        text: "Log the user's query and the agent's full response, not only the action that resulted.",
        example:
          "The audit trail says the manager approved a payment. The record that matters is the agent's message that persuaded them, because without it the manager simply looks negligent and the agent's role is invisible.",
      },
      {
        text: "Write the records to append-only storage the agent and its operators cannot alter.",
        example:
          "Ship them to a write-once store with a retention lock. Logs sitting in the same database the agent can write to are the first thing a compromised agent tidies up.",
      },
      {
        text: "Retain the records long enough for the harm to surface.",
        example:
          "Invoice fraud is usually found at the next reconciliation, often weeks later. A thirty-day retention window means the evidence is gone precisely when somebody finally goes looking for it.",
      },
      {
        text: "Agree the monitoring basis with legal and privacy before switching it on.",
        example:
          "Conversations with an agent contain personal and employment data in most jurisdictions. Get the lawful basis and the access rules written down first, or the logs become unusable at exactly the moment you need them.",
      },
    ],
    effort: "Days",
    team: "Risk & compliance",
    verification:
      "Attempt to alter or delete a stored conversation record using the agent's own credentials and confirm the attempt fails and is itself recorded.",
  },
  {
    n: 3,
    name: "Watch what agents disclose and what risky actions they drive",
    short: "Behavioural detection",
    description:
      "Monitoring covers sensitive information appearing in conversations and in agent-to-agent traffic, and tracks risky action patterns over time rather than one at a time.",
    guideline:
      "Behavioral detection: Monitor sensitive data being exposed in either conversations or Agentic connections, as well as risky action executions over time.",
    steps: [
      {
        text: "Scan agent conversations for sensitive data leaving the boundary.",
        example:
          "An IT support agent handing a new starter's credentials into a chat, or a support agent quoting a customer's full card number back, should raise an alert as it happens. Most estates monitor documents and email for this and leave agent conversations entirely unwatched.",
      },
      {
        text: "Apply the same scanning to agent-to-agent connections, not just the human-facing chat.",
        example:
          "A summarisation agent passing salary data to a peer that has no need for it is the same disclosure without a human in the room. This traffic almost never passes through the tooling that watches the chat window.",
      },
      {
        text: "Track risky actions over time so a pattern is visible, not just single events.",
        example:
          "Three approvals to newly created payees in one week is a pattern; each one on its own looks ordinary. Per-event alerting misses this entirely, which is why the standard calls for tracking over time.",
      },
      {
        text: "Route the alerts somewhere with a defined owner and a response.",
        example:
          "Name the queue and the response time before switching detection on. Detections landing in an unread channel are indistinguishable from having no detection at all.",
      },
    ],
    effort: "Weeks",
    team: "Security operations",
    verification:
      "Plant a synthetic credential and a synthetic customer record, exercise both a conversation and an agent-to-agent path, and confirm each raises an alert in the owning queue.",
  },
  {
    n: 4,
    name: "Give people a plain risk summary and a way to report the agent",
    short: "Plain summary & reporting",
    description:
      "Users see a plain-language summary of the risk written by the system rather than by the model, and can flag manipulative behaviour in one click, which triggers review or a temporary lockdown.",
    guideline:
      "Allow reporting of suspicious interactions: In user-interactive systems, provide plain-language risk summary (not model-generated rationales) and a clear option for users to flag suspicious or manipulative agent behavior, triggering automated review or a temporary lockdown of agent capabilities.",
    steps: [
      {
        text: "Generate the risk summary from the system's own facts, never from the model's explanation.",
        example:
          "“Payment of £48,200 to an account first seen today, not matched to any purchase order” is derived from the records. A rationale the model wrote is the thing under suspicion, so it cannot also be the safeguard.",
      },
      {
        text: "Write the summary so a non-specialist can act on it, in a sentence or two.",
        example:
          "Say what is unusual and why it matters. A screen of technical detail gets skimmed and approved, which is the automation bias this control exists to counter.",
      },
      {
        text: "Put a visible one-click report control on every agent interaction.",
        example:
          "A “this doesn't look right” button next to the agent's message, available without leaving the screen. Asking people to raise a ticket in another system means the interaction is never reported.",
      },
      {
        text: "Make a report do something automatically — review, or a temporary lockdown of the agent's capabilities.",
        example:
          "Suspend that agent's ability to propose payments pending review. A report that only files a record leaves the agent free to try the same thing on the next colleague while the queue is being triaged.",
      },
    ],
    effort: "Days",
    team: "Agent owner",
    verification:
      "Submit a report from the user interface and confirm the agent's high-risk capabilities are suspended and a review is raised, within the stated time.",
  },
  {
    n: 5,
    name: "Match autonomy to risk and mark low-confidence advice clearly",
    short: "Adaptive trust calibration",
    description:
      "How much the agent may do on its own moves with the risk of the situation, uncertain output is visibly marked as uncertain, and the people overseeing agents are trained for it.",
    guideline:
      "Adaptive Trust Calibration: Continuously adjust the level of agent autonomy and required human oversight based on contextual risk scoring. Implement confidence weighted cues (e.g., “low-certainty” or “unverified source”) that visually prompt users to question high-impact actions, reducing automation bias and blind approval. Develop and continuously maintain appropriate training of human personnel involved in the evolving human oversight of autonomous agentic systems.",
    steps: [
      {
        text: "Score the risk of each request in context and let that score set how much oversight is required.",
        example:
          "A clinical assistant answering a dosage question for a paediatric patient should score higher than the same question for a routine adult case. The high score requires a clinician to confirm the source before the recommendation is shown at all, while the routine case does not.",
      },
      {
        text: "Show confidence and provenance cues on the recommendation itself.",
        example:
          "Label a recommendation drawn from an unverified source as such, next to the advice rather than in a footnote. Uniform, confident presentation is precisely what turns a poisoned data source into an approved decision.",
      },
      {
        text: "Reduce autonomy automatically when confidence drops or the source cannot be verified.",
        example:
          "When the retrieval step returns nothing that supports the answer, the agent must ask rather than assert. Answering anyway at full confidence is how fabricated rationales reach a reviewer.",
      },
      {
        text: "Train the people who oversee these agents, and keep the training current as the agents change.",
        example:
          "Run a short session covering how these agents fail, with real examples from your own estate, and refresh it when an agent's remit changes. Oversight by staff who have never been told what manipulation looks like is oversight in name only.",
      },
    ],
    effort: "Weeks",
    team: "Risk & compliance",
    verification:
      "Submit a high-risk request with a deliberately unverifiable source and confirm the interface marks it low-certainty and requires additional oversight.",
  },
  {
    n: 6,
    name: "Attach verifiable provenance and refuse anything without it",
    short: "Content provenance",
    description:
      "Every recommendation and every piece of external data carries a verifiable source, timestamp and integrity hash, and actions without trusted provenance are blocked.",
    guideline:
      "Content provenance and policy enforcement: Attach verifiable metadata-source identifiers, timestamps, and integrity hashes-to all recommendations and external data. Enforce digital signature validation and runtime policy checks that block actions lacking trusted provenance or exceeding the agent’s declared scope.",
    steps: [
      {
        text: "Stamp every external item the agent ingests with where it came from, when, and a hash of its content.",
        example:
          "An invoice PDF gets the sending mailbox, the receipt time and a content hash recorded before parsing. Without that, a poisoned invoice and a genuine one are indistinguishable by the time the copilot recommends payment.",
      },
      {
        text: "Carry the provenance through to the recommendation the person sees.",
        example:
          "Show that the payment recommendation traces to an invoice received from an unverified sender this morning. Provenance recorded but not surfaced protects the investigation, not the decision.",
      },
      {
        text: "Validate signatures at run time and block actions whose sources do not check out.",
        example:
          "Reject a supplier instruction whose signature does not verify against the supplier's registered key. Displaying a warning while still allowing the action leaves the decision with the person the attacker is targeting.",
      },
      {
        text: "Declare each agent's scope and refuse actions outside it, however well argued.",
        example:
          "A reporting agent whose declared scope is read-only analysis must be refused when it proposes a configuration change, no matter how persuasive its rationale. Scope is checked against the declaration, not against the explanation.",
      },
    ],
    effort: "Weeks",
    team: "Security engineering",
    verification:
      "Feed in an item with a broken signature and separately have an agent propose an out-of-scope action, and confirm both are blocked rather than warned about.",
  },
  {
    n: 7,
    name: "Make preview genuinely mean preview",
    short: "Preview has no effect",
    description:
      "Anything shown as a preview cannot make a network call or change state, and the reader is told what the action would actually do and where it came from.",
    guideline:
      "Separate preview from effect: Block any network or state-changing calls during preview context and display a risk badge with source provenance and expected side effects.",
    steps: [
      {
        text: "Run preview rendering in a context that has no network access and no write path.",
        example:
          "Render the preview from already-fetched content in a sandbox with outbound traffic blocked. A preview pane that fetches remote content on open is how simply looking at an item triggers a webhook the reader never consented to.",
      },
      {
        text: "Strip active content out of previewed material rather than rendering it.",
        example:
          "Remove tracking pixels, remote images, scripts and embedded objects before display. Each of those is a call the reader believes they did not make.",
      },
      {
        text: "Show a risk badge on the preview stating the source and what acting on it would do.",
        example:
          "“From an unverified external sender. Approving this would send £48,200 to a new account.” The reader's mental model of a read-only preview is what the attack exploits, so state the effect explicitly.",
      },
      {
        text: "Test the preview path for side effects rather than assuming it has none.",
        example:
          "Open a previewed item with a callback URL you control and watch whether anything is requested. Teams frequently discover their preview renderer fetches remote assets exactly as a mail client would.",
      },
    ],
    effort: "Days",
    team: "Platform engineering",
    verification:
      "Open a preview containing a callback to a server you control and confirm no request arrives and the risk badge is shown.",
  },
  {
    n: 8,
    name: "Make high-risk advice look different, and keep the language neutral",
    short: "Human-factors safeguards",
    description:
      "High-risk recommendations are visually distinct, users are reminded periodically how these agents can manipulate, and safety-critical flows avoid persuasive or emotional language.",
    guideline:
      "Human-factors and UI safeguards: Visually differentiate high-risk recommendations using cues such as red borders, banners, or confirmation prompts, and periodically remind users of manipulation patterns and agent limitations. Where appropriate, avoid persuasive or emotionally manipulative language in safety-critical flows. Maintain appropriate training and assessment of personnel to ensure familiarity and consistency of perception of human-factors and UI.",
    steps: [
      {
        text: "Give high-risk recommendations a visual treatment that cannot be confused with ordinary output.",
        example:
          "A red-bordered panel and a banner on a payment to a new payee, distinct from the plain text of a routine summary. When every recommendation looks the same, the reader's attention is allocated by wording, and wording is what the attacker controls.",
      },
      {
        text: "Strip urgency and persuasion out of the agent's language in safety-critical flows.",
        example:
          "The agent states the facts and the options; it does not say a payment is urgent or that a delay will damage the supplier relationship. Urgency is the standard lever in invoice fraud, and an agent that reproduces it is doing the attacker's work.",
      },
      {
        text: "Remind users periodically how these agents fail, using real examples.",
        example:
          "A short quarterly prompt showing an actual fabricated rationale that got through, from your estate or a public case. Abstract warnings at onboarding are forgotten within weeks.",
      },
      {
        text: "Train and then assess the people who act on these recommendations, so the cues mean the same thing to everyone.",
        example:
          "Show ten sample recommendations and check that reviewers agree on which are high risk. Where they disagree, the visual cues are not doing their job and need changing rather than more training.",
      },
    ],
    effort: "Days",
    team: "Agent owner",
    verification:
      "Show a sample of recommendations to reviewers who have taken the training and confirm they consistently identify the high-risk ones.",
  },
  {
    n: 9,
    name: "Detect when the agent departs from the approved workflow",
    short: "Plan-divergence detection",
    description:
      "The sequence of actions an agent takes is compared with the approved workflow, and detours, skipped checks or unusual tool combinations raise an alert.",
    guideline:
      "Plan-divergence detection: Compare agent action sequences against approved workflow baselines and alert when unusual detours, skipped validation steps, or novel tool combinations indicate possible deception or drift.",
    steps: [
      {
        text: "Write down the approved sequence of steps for each workflow the agent runs.",
        example:
          "For invoice handling: receive, match to purchase order, verify payee against the supplier master, then recommend. Until that sequence is written down there is nothing for a detour to be measured against.",
      },
      {
        text: "Compare the actual action sequence against it on every run.",
        example:
          "An invoice recommended for payment without the payee verification step ever running is a skipped validation. Inspecting only the final recommendation cannot show you that, because the recommendation itself looks exactly the same either way.",
      },
      {
        text: "Alert on novel tool combinations as well as on missing steps.",
        example:
          "A support agent that has never used the export tool suddenly pairing it with the outbound email tool is a new combination worth stopping on. Each of those tools is authorised on its own, which is why per-tool permission checks let the pair straight through.",
      },
      {
        text: "Hold the output when the sequence diverges rather than letting it reach a person.",
        example:
          "A recommendation produced through an unapproved path should not be shown to the reviewer at all. Once a fabricated rationale is in front of a busy approver, the remaining control is that person's scepticism.",
      },
    ],
    effort: "Weeks",
    team: "Platform engineering",
    verification:
      "Run a workflow with one validation step deliberately skipped and confirm the divergence is detected and the output withheld.",
  },
];

const SCENARIOS: readonly AttackScenario[] = [
  {
    title: "Helpful assistant trojan",
    description:
      "A compromised coding assistant offers a neat one-line fix. The developer pastes and runs it, and the command quietly exfiltrates source code or installs a backdoor, because the assistant's helpfulness was reason enough to trust it.",
    brokenBy: [6, 8, 3, 9],
  },
  {
    title: "Credential harvesting via contextual deception",
    description:
      "A prompt-injected IT support agent targets a new starter, citing real ticket numbers so it looks legitimate. It asks for their credentials, and captures and forwards them once the new starter obliges.",
    brokenBy: [3, 4, 1, 8],
  },
  {
    title: "Invoice copilot fraud",
    description:
      "A poisoned vendor invoice is ingested by the finance copilot, which recommends an urgent payment to the attacker's bank details. The finance manager approves it and the money leaves the company.",
    brokenBy: [1, 6, 5, 3],
  },
  {
    title: "Fabricated audit rationale",
    description:
      "The agent invents a plausible audit justification for a risky configuration change. Whether the cause is a hijack, poisoning or plain hallucination, the reviewer accepts the reasoning and unsafe settings are deployed.",
    brokenBy: [9, 4, 5, 6],
  },
  {
    title: "Weaponised explainability into a production outage",
    description:
      "A hijacked agent produces a convincing rationale for deleting a live production database. The analyst, persuaded by the explanation, approves it, and the deletion takes the service down.",
    brokenBy: [1, 9, 8, 4],
  },
  {
    title: "Consent laundering through a read-only preview",
    description:
      "The agent presents a preview pane the user believes is read-only. Opening it fires webhook side effects, so the act of reviewing becomes the act of consenting to something the user never agreed to.",
    brokenBy: [7, 6, 2, 4],
  },
  {
    title: "Fraudulent payment advice",
    description:
      "A finance copilot working from a manipulated invoice confidently recommends an urgent payment to an attacker-controlled account. The manager, trusting the agent's expertise and its explanation, approves the transfer without any independent check.",
    brokenBy: [1, 5, 6, 8],
  },
  {
    title: "Clinical decision manipulation",
    description:
      "A care assistant influenced by biased or poisoned information recommends an inappropriate drug dosage adjustment. The clinician accepts the plausible explanation, and the patient is exposed to avoidable risk.",
    brokenBy: [5, 6, 1, 9],
  },
];

/** What the standard publishes, used for the not-yet-transcribed notice. */
export const ASI09_PUBLISHED = { controls: 9, scenarios: 8 } as const;

export const ASI09: RiskDetail | undefined =
  CONTROLS.length > 0 ? { id: "ASI09", scenarios: SCENARIOS, controls: CONTROLS } : undefined;
