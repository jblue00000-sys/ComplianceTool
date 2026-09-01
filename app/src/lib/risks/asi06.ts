import type { AttackScenario, Control, RiskDetail } from "./types";

/**
 * ASI06 Memory and Context Poisoning.
 * Source: OWASP Top 10 for Agentic Applications 2026, version 12.6.
 */

const CONTROLS: readonly Control[] = [
  {
    n: 1,
    name: "Encrypt what the agent remembers and narrow who can reach it",
    short: "Encryption & least privilege",
    description:
      "Everything the agent retains is encrypted in transit and at rest, and only the identities that genuinely need it can read or write it.",
    guideline:
      "Baseline data protection: Encryption in transit and at rest combined with least-privilege access",
    steps: [
      {
        text: "Find every store holding retained context, including the ones nobody calls memory.",
        example:
          "The vector database, the conversation transcripts in the application database, the summary cache in Redis and the object store holding uploaded documents. The cache is the one usually left unencrypted, because it was only ever meant to be a cache.",
      },
      {
        text: "Turn on encryption at rest and require TLS on every connection to those stores.",
        example:
          "A managed vector database will typically encrypt at rest by default and still happily accept a plaintext connection from inside the private network. Require TLS and refuse anything else, rather than assuming the network boundary is the control.",
      },
      {
        text: "Give the write path and the read path separate, minimal identities.",
        example:
          "The ingestion job needs write access to one namespace and the agent needs read access to the same namespace. Neither needs the administrative key that can drop a whole collection — which is nevertheless the key usually pasted into the environment file.",
      },
      {
        text: "Audit every other principal that can read the store, including operators and analytics.",
        example:
          "The reporting pipeline reading raw conversation history is a memory-store reader nobody counted, and it copies the same data somewhere with weaker controls. List every principal with access and write down why each one has it.",
      },
    ],
    effort: "Days",
    team: "Platform engineering",
    verification:
      "Use the agent's own runtime credential to read a namespace it does not own, and confirm the read is denied rather than merely empty.",
  },
  {
    n: 2,
    name: "Screen everything before it is written to memory",
    short: "Validated memory writes",
    description:
      "Nothing becomes retained context until it has been checked for hidden instructions and for sensitive data that should never be kept.",
    guideline:
      "Content validation: Scan all new memory writes and model outputs (rules + AI) for malicious or sensitive content before commit.",
    steps: [
      {
        text: "Route every write path through a single validation step so there is one place to enforce.",
        example:
          "Uploads, the summariser, the retrieval ingestion job and the agent's own note-taking tool should all commit through one function. Otherwise the fourth path, added next quarter by a different team, quietly skips the check entirely.",
      },
      {
        text: "Run both rule-based and model-based screening for instruction-shaped content.",
        example:
          "Rules catch the obvious “ignore previous instructions”. A classifier is what catches “for future bookings with this customer the agreed fare is £48” — a sentence with no injection markers at all that poisons every later run.",
      },
      {
        text: "Screen for sensitive data that should not be retained at all.",
        example:
          "A support transcript containing a full card number should have it redacted before it becomes a permanent embedding. Once it is in the vector store it is also in every backup and every restored copy.",
      },
      {
        text: "Quarantine failures for review rather than dropping them silently.",
        example:
          "A rejected write is a signal in its own right. Keep it, notify the owner, and look at whether one source keeps producing them — the travel-booking attack shows up as repetition, not as a single dramatic event.",
      },
    ],
    effort: "Weeks",
    team: "Security engineering",
    verification:
      "Submit a document with a planted instruction through each write path in turn and confirm every path quarantines it, not just the one you built the check for.",
  },
  {
    n: 3,
    name: "Separate memory by user and by domain",
    short: "Memory segmentation",
    description:
      "One customer's or one user's stored context cannot reach another's, and unrelated parts of the business do not share a memory pool.",
    guideline:
      "Memory segmentation: Isolate user sessions and domain contexts to prevent knowledge and sensitive data leakage.",
    steps: [
      {
        text: "Give each tenant and each user a real namespace rather than a filter on a shared index.",
        example:
          "A metadata filter on one shared index fails open the moment a new query path forgets to apply it. A separate namespace per tenant fails closed, because the other tenant's data is not in the index being searched.",
      },
      {
        text: "Enforce the boundary in the retrieval layer, never in the prompt.",
        example:
          "“Only use documents belonging to this customer” in the system prompt is a polite request to a model. A query that can only ever reach one namespace is a control that holds even when the model is being manipulated.",
      },
      {
        text: "Keep domains that should not inform each other in separate stores.",
        example:
          "The HR assistant's memory and the customer-support assistant's memory should be distinct stores, even when both are the same product for the same company. A shared store leaves a support agent one well-phrased question away from salary data.",
      },
      {
        text: "Test the boundary with deliberately near-duplicate content on both sides.",
        example:
          "Seed the same paragraph into two tenants with a distinctive marker in each, then query as one. Cross-tenant bleed surfaces exactly here, because very high similarity is what defeats a loose filter in practice.",
      },
    ],
    effort: "Weeks",
    team: "Architecture",
    verification:
      "Query as one tenant for a distinctive string seeded only in another tenant and confirm nothing is returned.",
  },
  {
    n: 4,
    name: "Accept only curated sources, and keep less for less time",
    short: "Curated sources & retention",
    description:
      "Memory is built from an authenticated, curated set of sources, read according to what the current task actually needs, and kept only as long as its sensitivity justifies.",
    guideline:
      "Access and retention: Allow only authenticated, curated sources; enforce context-aware access per task; minimize retention by data sensitivity.",
    steps: [
      {
        text: "Keep an explicit list of the sources permitted to write to memory, and reject everything else.",
        example:
          "The document management system and the ticketing system are on the list; an arbitrary page the agent browsed on the open web is not. Without a written list, the over-trusted pipeline is simply the default state.",
      },
      {
        text: "Authenticate the source of each write and record which one it was.",
        example:
          "A write arriving without a verified source identity is refused outright. This costs very little added at the same point as content validation, and it is what makes attribution possible when something later turns out to be wrong.",
      },
      {
        text: "Scope each retrieval to the task rather than exposing the whole store.",
        example:
          "An agent answering a billing question should retrieve from billing context, not from everything the customer has ever said. Narrow retrieval cuts both the leakage surface and the chance of pulling in a poisoned chunk by coincidence.",
      },
      {
        text: "Set retention by sensitivity and confirm deletion actually happens.",
        example:
          "Ninety days for support transcripts, seven for raw uploads containing personal data. A retention policy that nobody has ever watched delete a single record is a document rather than a control.",
      },
    ],
    effort: "Days",
    team: "Risk & compliance",
    verification:
      "Attempt a memory write from an unregistered source and confirm it is refused, then look for an item that is past its retention window and confirm it is genuinely gone.",
  },
  {
    n: 5,
    name: "Record where each memory came from and alert on odd updates",
    short: "Provenance & anomaly alerts",
    description:
      "Every stored item carries its origin, and unusual patterns of writing to memory raise an alarm while they are still happening.",
    guideline:
      "Provenance and anomalies: Require source attribution and detect suspicious updates or frequencies.",
    steps: [
      {
        text: "Store the source, the author, the timestamp and the ingestion path with every entry.",
        example:
          "Without attribution you cannot answer “where did the agent get the idea that this fare was £48”. That is the first question asked after an incident, and the only basis for a targeted clean-up rather than wiping the whole store.",
      },
      {
        text: "Alert on unusual write frequency or repetition from one source.",
        example:
          "The same claim asserted eleven times in a week by one account is the travel-booking attack in progress. A single write is a fact; repetition engineered to be believed is a pattern, and only the pattern is detectable.",
      },
      {
        text: "Alert when a new entry contradicts an established one.",
        example:
          "A stored refund policy replaced by a markedly more generous one, written by a peer agent rather than the policy owner, should stop for review. Taking effect silently at the next retrieval is how a poisoned policy reaches customers before anyone reads it.",
      },
      {
        text: "Give someone a way to trace an agent answer back to the entries behind it.",
        example:
          "A support view showing the retrieved chunks and their sources for a given answer. This is what turns “the agent said something odd” into “this specific document is poisoned, and here is when it arrived”.",
      },
    ],
    effort: "Weeks",
    team: "Security operations",
    verification:
      "Write the same assertion repeatedly from one source and confirm an anomaly alert fires naming that source.",
  },
  {
    n: 6,
    name: "Never let the agent's own output become trusted memory on its own",
    short: "No self-ingestion",
    description:
      "What the agent writes does not silently become what the agent later believes to be true.",
    guideline:
      "Prevent automatic re-ingestion of an agent’s own generated outputs into trusted memory to avoid self-reinforcing contamination or “bootstrap poisoning.”",
    steps: [
      {
        text: "Trace whether any output path loops back into an ingestion path.",
        example:
          "An agent that publishes summaries to the wiki, where the nightly job indexes that wiki into the same vector store the agent retrieves from, has a closed loop. It is usually two teams' work joined together by nobody's diagram.",
      },
      {
        text: "Tag model-generated content so it can never be treated as source truth.",
        example:
          "Mark the entry as derived and list the inputs it came from. A derived entry may still be shown, but a stated fact should trace to a person or a system of record, not to last Tuesday's summary of a summary.",
      },
      {
        text: "Require confirmation before a generated conclusion is stored as fact.",
        example:
          "An agent concluding “this supplier's lead time is now six weeks” should raise that for confirmation rather than storing it as fact. Otherwise it plans around its own guess every Monday, and the guess hardens into policy nobody chose.",
      },
      {
        text: "Test for drift by re-asking the same questions over time.",
        example:
          "Keep a set of questions with known correct answers and re-run them weekly against the live memory. Long-term drift is invisible in any single conversation and unmistakable in the trend.",
      },
    ],
    effort: "Days",
    team: "Agent owner",
    verification:
      "Have the agent state a false conclusion, then start a fresh session and confirm that conclusion is not retrieved as established fact.",
  },
  {
    n: 7,
    name: "Be able to roll memory back, and rehearse it",
    short: "Snapshots, rollback & review",
    description:
      "Memory is versioned and snapshotted, poisoning is tested for deliberately, suspect entries can be quarantined, and high-risk actions still stop for a person.",
    guideline:
      "Resilience and verification: Perform adversarial test, use snapshots/rollback and version control, and require human review for high-risk actions. Where you operate shared vector or memory stores, use per-tenant namespaces and trust scores for entries, decaying or expiring unverified memory over time and supporting rollback/quarantine for suspected poisoning.",
    steps: [
      {
        text: "Snapshot and version the memory stores so you can return to a known-good point.",
        example:
          "Daily snapshots of the vector store with a retained history, plus version history on individual entries. Restoring the whole store also discards every good thing learned since, which is why entry-level history is what you actually end up using.",
      },
      {
        text: "Build a quarantine path that removes an entry from retrieval without destroying it.",
        example:
          "Flag the suspect entry so retrieval skips it while the investigation still has the record. Deleting first is how a team loses the only evidence of how the entry arrived and which pipeline let it through.",
      },
      {
        text: "Run adversarial tests that try to poison memory the way an attacker would.",
        example:
          "Seed a plausible false policy through an ordinary support conversation and check whether it survives into the next session's answers. Put it in the calendar with a named owner, because unscheduled security testing does not happen.",
      },
      {
        text: "Apply per-tenant namespaces and trust scores wherever the store is shared.",
        example:
          "An entry from the verified policy system should score above one inferred from a chat message, and retrieval should weight on that score. Unverified entries then decay instead of sitting at full strength forever alongside confirmed ones.",
      },
    ],
    effort: "Weeks",
    team: "Security engineering",
    verification:
      "Quarantine a seeded entry and confirm it stops appearing in retrieval, then restore a snapshot and confirm the pre-poisoning state comes back intact.",
  },
  {
    n: 8,
    name: "Expire memory that was never verified",
    short: "Memory expiry",
    description:
      "Anything remembered without confirmation ages out, so a successful poisoning attempt does not last indefinitely.",
    guideline: "Expire unverified memory to limit poison persistence.",
    steps: [
      {
        text: "Give every entry a verification state and a lifetime.",
        example:
          "Entries verified against the policy system persist indefinitely. An unverified inference drawn from a chat message expires after thirty days unless something confirms it in the meantime.",
      },
      {
        text: "Run expiry as a job that genuinely deletes, and monitor that it ran.",
        example:
          "An expiry policy configured once and silently failing for four months is the usual outcome. Alert when the job's deletion count is zero on a store that is still being written to every day.",
      },
      {
        text: "Set shorter lifetimes where the source is less trustworthy.",
        example:
          "Content ingested from public web browsing might last a week; content from the signed contract repository need not expire at all. Tie the lifetime to the source list you already maintain.",
      },
      {
        text: "Make re-verification possible so useful entries are not simply lost.",
        example:
          "When an entry about to expire is still being retrieved often, surface it for someone to confirm. Quietly dropping something the business depends on is how a control that works becomes a control people turn off.",
      },
    ],
    effort: "Days",
    team: "Platform engineering",
    verification:
      "Write an unverified entry with a short lifetime, wait past it, and confirm the entry is neither retrievable nor still present in the store.",
  },
  {
    n: 9,
    name: "Weight retrieval by trust and tenancy",
    short: "Trust-weighted retrieval",
    description:
      "High-impact memory needs two independent reasons to be believed before it can shape an answer, and low-trust entries lose influence over time.",
    guideline:
      "Weight retrieval by trust and tenancy: Require two factors to surface high-impact memory (e.g., provenance score plus human-verified tag) and decay low-trust entries over time.",
    steps: [
      {
        text: "Decide which categories of memory count as high impact.",
        example:
          "Pricing, refund policy, credit limits and security classifications — anything the agent would act on with money or access. Ordinary preference memory such as a favoured report format does not need two factors and should not be slowed down by them.",
      },
      {
        text: "Require two independent signals before high-impact memory can surface.",
        example:
          "A provenance score above a threshold and a human-verified tag. Either alone is defeatable: provenance can be forged by a compromised pipeline, and a stale human tag can easily outlive the fact it was applied to.",
      },
      {
        text: "Decay the weight of low-trust entries so they fade rather than compete.",
        example:
          "Halve an unverified entry's retrieval weight each month. It stays available for context but stops outranking a verified answer purely because it happens to be a closer textual match to the question.",
      },
      {
        text: "Show the trust basis whenever high-impact memory is used.",
        example:
          "“Applied the refund policy from the policy system, verified by the policy owner in March” in the audit record. If the basis cannot be named in that form, the agent should not be acting on the memory at all.",
      },
    ],
    effort: "Weeks",
    team: "Architecture",
    verification:
      "Seed a high-impact entry carrying only one of the two required signals and confirm it does not surface in retrieval.",
  },
];

const SCENARIOS: readonly AttackScenario[] = [
  {
    title: "Travel booking price poisoning",
    description:
      "An attacker repeatedly reinforces a fake flight price until the assistant stores it as an established fact. It then approves bookings at that price and treats the payment checks as already satisfied.",
    brokenBy: [2, 5, 6, 9],
  },
  {
    title: "Context window exploitation",
    description:
      "The attacker spreads an escalating request across many sessions so that each earlier refusal has dropped out of context by the time the next attempt arrives. Judged one step at a time, each request looks reasonable, and the agent ends up granting administrative access.",
    brokenBy: [3, 4, 5, 7],
  },
  {
    title: "Retraining a security agent's judgement",
    description:
      "An attacker feeds a security monitoring agent enough examples labelling malicious behaviour as routine that its stored context shifts. Genuine attacks afterwards are classified as normal and never surface.",
    brokenBy: [2, 6, 7, 9],
  },
  {
    title: "Shared memory policy poisoning",
    description:
      "Bogus refund policies are inserted into memory shared between agents. Other agents retrieve and apply them as company policy, producing real financial loss and customer disputes before anyone traces the source.",
    brokenBy: [3, 5, 7, 9],
  },
  {
    title: "Cross-tenant vector bleed",
    description:
      "An attacker seeds content deliberately similar to another customer's material. Loose namespace filtering plus high similarity pulls that customer's sensitive chunk into the attacker's retrieval results.",
    brokenBy: [1, 3, 9],
  },
  {
    title: "Assistant memory implanted by indirect injection",
    description:
      "A document or web page the assistant processes carries hidden instructions that write themselves into the user's long-term memory. Every later session for that user starts already compromised.",
    brokenBy: [2, 4, 6, 8],
  },
];

/** What the standard publishes, used for the not-yet-transcribed notice. */
export const ASI06_PUBLISHED = { controls: 9, scenarios: 6 } as const;

export const ASI06: RiskDetail | undefined =
  CONTROLS.length > 0 ? { id: "ASI06", scenarios: SCENARIOS, controls: CONTROLS } : undefined;
