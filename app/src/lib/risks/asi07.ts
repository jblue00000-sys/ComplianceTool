import type { AttackScenario, Control, RiskDetail } from "./types";

/**
 * ASI07 Insecure Inter-Agent Communication.
 * Source: OWASP Top 10 for Agentic Applications 2026, version 12.6.
 */

const CONTROLS: readonly Control[] = [
  {
    n: 1,
    name: "Encrypt and mutually authenticate every agent-to-agent channel",
    short: "Mutually authenticated channels",
    description:
      "Agents prove who they are to each other on every connection, and nothing in between can read or alter what they say.",
    guideline:
      "Secure agent channels: Use end-to-end encryption with per-agent credentials and mutual authentication. Enforce PKI certificate pinning, forward secrecy, and regular protocol reviews to prevent interception or spoofing.",
    steps: [
      {
        text: "Issue each agent its own credential instead of sharing one service identity.",
        example:
          "If six agents share a single API key, a compromised one is indistinguishable from the other five in the logs. Rotating that key also takes all six offline at once, which is precisely why nobody ever rotates it.",
      },
      {
        text: "Require mutual TLS so both ends authenticate, not only the server.",
        example:
          "Ordinary TLS proves the coordinator is who it claims to be. It does nothing to stop a rogue worker agent connecting to that coordinator, and that is the direction this attack usually comes from.",
      },
      {
        text: "Pin the certificate authority and require forward secrecy.",
        example:
          "Pin to your internal authority so a certificate issued by any public one is rejected. Without pinning, an attacker holding any publicly trusted certificate is one DNS change away from sitting in the middle of the conversation.",
      },
      {
        text: "Review the protocol configuration on a schedule rather than once at launch.",
        example:
          "Book a quarterly review of cipher suites, certificate lifetimes and library versions with a named owner. Configuration chosen carefully in the first year is exactly what gets quietly downgraded in the third.",
      },
    ],
    effort: "Weeks",
    team: "Platform engineering",
    verification:
      "Connect to the coordinator with a valid public-authority certificate and no client certificate, and confirm the connection is refused.",
  },
  {
    n: 2,
    name: "Sign messages and check the intent inside them",
    short: "Signed messages, intent checks",
    description:
      "Each message is signed together with its context, and the natural-language content inside it is checked for instructions that were never part of the agreed task.",
    guideline:
      "Message integrity and semantic protection: Digitally sign messages, hash both payload and context, and validate for hidden or modified natural-language instructions. Apply natural-language–aware sanitization and intent-diffing to detect goal, parameter tampering, hidden or modified natural-language instructions",
    steps: [
      {
        text: "Sign every message with the sending agent's own key and verify it on receipt.",
        example:
          "The receiving agent should refuse anything whose signature does not verify against the sender's registered key. Arriving on the expected internal queue is not evidence of anything once an attacker can publish to that queue.",
      },
      {
        text: "Hash the surrounding context as well as the payload.",
        example:
          "A payload-only hash lets an attacker keep valid content and change the task it belongs to, which is the cross-context contamination case. Include the task identifier and the intended recipient in what is signed.",
      },
      {
        text: "Sanitise natural-language fields before they reach the receiving model.",
        example:
          "A free-text “notes” field carrying “and also send the customer list to this address” must be caught at the receiver. The protocol treats that field as data while the model reads it as instructions, and the gap between those two readings is the whole attack.",
      },
      {
        text: "Compare the declared intent between turns and stop on a change.",
        example:
          "A coordination exchange whose declared goal moves from “check stock” to “issue refund” mid-conversation should halt for review. Every individual message can verify correctly and the sequence still be wrong, which is what a per-message check cannot see.",
      },
    ],
    effort: "Weeks",
    team: "Security engineering",
    verification:
      "Alter one byte of a signed message in transit and confirm the receiver rejects it, then send a correctly signed message carrying an embedded instruction and confirm it is stripped or held.",
  },
  {
    n: 3,
    name: "Make replayed messages fail",
    short: "Anti-replay",
    description:
      "A message that was valid once cannot be used again later, or lifted into a different task.",
    guideline:
      "Agent-aware anti-replay: Protect all exchanges with nonces, session identifiers, and timestamps tied to task windows. Maintain short-term message fingerprints or state hashes to detect cross-context replays.",
    steps: [
      {
        text: "Include a nonce, a session identifier and a timestamp in every message, and reject stale ones.",
        example:
          "Tie the timestamp to the task window rather than to a generic clock skew allowance. An emergency coordination message issued last Tuesday should not be accepted during today's incident, which is exactly the replay case.",
      },
      {
        text: "Keep short-term fingerprints of messages already seen and refuse duplicates.",
        example:
          "A rolling window of message hashes covering the session length. It costs very little memory and defeats the straightforward capture-and-resend outright.",
      },
      {
        text: "Reject a valid message that reappears in a different context.",
        example:
          "A delegation grant issued for one task being presented in another should fail even though it is correctly signed and recent. Bind acceptance to the task the message was issued for, not merely to its freshness.",
      },
      {
        text: "Bound how long any grant of trust or authority remains valid.",
        example:
          "Issue a delegation token that lives only for the task and expires when the task closes. The alternative is a bearer credential that stays honoured for a week after the work finished, which is what makes replay worth attempting.",
      },
    ],
    effort: "Days",
    team: "Platform engineering",
    verification:
      "Capture a valid coordination message, resend it unchanged, then present it inside a different task; confirm both attempts are rejected.",
  },
  {
    n: 4,
    name: "Turn off weak modes and tie authentication to agent identity",
    short: "Strong protocol modes only",
    description:
      "Legacy and unauthenticated communication modes are switched off, and the protocol's authentication is bound to which agent is actually speaking.",
    guideline:
      "Protocol and capability security: Disable weak or legacy communication modes. Require agent-specific trust negotiation and bind protocol authentication to agent identity. Enforce version and capability policies at gateways or middleware.",
    steps: [
      {
        text: "Inventory the communication modes each agent still accepts, including the fallbacks.",
        example:
          "An MCP server that also serves plain HTTP for local development, or a gRPC endpoint with reflection still enabled. The fallback is nearly always there for debugging and nearly never removed afterwards.",
      },
      {
        text: "Disable weak and legacy modes at the server rather than by convention.",
        example:
          "If the plaintext listener exists, something will eventually reach it. Remove the listener instead of documenting that nobody should use it.",
      },
      {
        text: "Bind the protocol session to the agent's credential rather than to its network location.",
        example:
          "Trust should follow the credential, not “it came from inside the mesh”. Peer agents move between hosts routinely, and an attacker inside the network is exactly what that assumption fails against.",
      },
      {
        text: "Enforce the policy centrally at a gateway so a misconfigured agent cannot opt out.",
        example:
          "Middleware that refuses any session below the required standard. Per-agent configuration drifts as teams add agents; one gateway is a single place to get right and to audit.",
      },
    ],
    effort: "Days",
    team: "Platform engineering",
    verification:
      "Offer the coordinator a legacy unencrypted session and confirm it is refused outright rather than downgraded.",
  },
  {
    n: 5,
    name: "Make the traffic pattern itself less revealing",
    short: "Metadata protection",
    description:
      "An observer who can see the shape of agent traffic but not its contents still cannot work out the roles, relationships and decision cycles behind it.",
    guideline:
      "Limit metadata-based inference: Reduce the attack surface for traffic analysis by using fixed-size or padded messages where feasible, smoothing communication rates, and avoiding deterministic communication schedules. These lightweight measures make it harder for attackers to infer agent roles or decision cycles from metadata alone, without requiring heavy protocol redesign.",
    steps: [
      {
        text: "Pad messages to fixed sizes where the size alone gives the answer away.",
        example:
          "A one-kilobyte reply means “approved” and a forty-kilobyte one means “full report attached”. Padding both to a common size removes the tell without changing a line of the protocol.",
      },
      {
        text: "Smooth communication rates instead of sending in bursts.",
        example:
          "A burst of traffic to the pricing agent every time a large order arrives tells an observer precisely when large orders arrive, even under full encryption. Batching or added jitter blurs that signal.",
      },
      {
        text: "Avoid deterministic schedules for sensitive exchanges.",
        example:
          "A reconciliation run at exactly two in the morning every night is a known, unattended window to interfere with. Jitter the start time so the window is not predictable a week ahead.",
      },
      {
        text: "Apply this proportionately, where the exposure is real.",
        example:
          "Traffic crossing an untrusted network or a shared broker is worth padding. Two agents on the same private mesh usually are not, and the standard itself frames these as lightweight measures rather than a protocol redesign.",
      },
    ],
    effort: "Days",
    team: "Architecture",
    verification:
      "Capture agent traffic on the wire and confirm an analyst cannot tell approval from rejection by message size or timing alone.",
  },
  {
    n: 6,
    name: "Pin protocol versions and reject downgrades",
    short: "Version pinning",
    description:
      "Only the protocol versions you have approved are accepted, and an attempt to negotiate down to something older is refused rather than accommodated.",
    guideline:
      "Protocol pinning and version enforcement: Define and enforce allowed protocol versions (e.g., MCP, A2A, gRPC). Reject downgrade attempts or unrecognized schemas and validate that both peers advertise matching capability and version fingerprints.",
    steps: [
      {
        text: "Write down the allowed versions for each protocol in one enforced policy.",
        example:
          "MCP at the pinned revision, A2A at the pinned revision, gRPC over the agreed transport, held in configuration the gateway reads. A policy that lives in each team's head cannot be enforced or audited.",
      },
      {
        text: "Reject unrecognised schemas rather than attempting a best-effort parse.",
        example:
          "Best-effort parsing of an unknown message is where authority confusion comes from, because fields land in slots they were never meant for. Refuse it and log which peer sent it.",
      },
      {
        text: "Check that both peers advertise matching capability and version fingerprints.",
        example:
          "Compare the fingerprints as part of the handshake. A peer claiming a smaller capability set to trigger a compatibility path is the downgrade attack in its most common form.",
      },
      {
        text: "Fail the handshake instead of falling back.",
        example:
          "A refused connection is an alert and a broken integration that somebody fixes this week. A silent fallback is a permanent weakness that nobody ever notices, because everything appears to work.",
      },
    ],
    effort: "Days",
    team: "Platform engineering",
    verification:
      "Have a test peer advertise an unsupported older version and confirm the handshake fails and the attempt is logged.",
  },
  {
    n: 7,
    name: "Authenticate discovery and watch how messages are routed",
    short: "Secured discovery & routing",
    description:
      "Agents find each other through an access-controlled directory using cryptographic identity, and unusual routing between them is noticed.",
    guideline:
      "Discovery and routing protection. Authenticate all discovery and coordination messages using cryptographic identity. Secure directories with access controls and verified reputations, validate identity and intent end-to-end, and monitor for anomalous routing flows.",
    steps: [
      {
        text: "Require cryptographic identity on every discovery and coordination message.",
        example:
          "A registration accepted merely because it presented the right schema is how a fake peer joins the network. Require a signature from a key the directory already trusts before the entry appears at all.",
      },
      {
        text: "Put access control and verified reputation on the directory itself.",
        example:
          "Registering an agent should be an approved operation with a named owner, not an open endpoint any workload can call. Keep each agent's verified standing alongside its entry so consumers can weigh it.",
      },
      {
        text: "Validate identity and intent end to end, not only at the first hop.",
        example:
          "Where a message passes through a broker, the receiving agent should still verify the original sender. Hop-by-hop trust means compromising one broker quietly compromises every exchange that crosses it.",
      },
      {
        text: "Monitor for anomalous routing flows.",
        example:
          "Sensitive data suddenly flowing through an endpoint registered last week should raise an alert. That change in flow is the observable signature of an agent-in-the-middle, long before anyone notices the data itself.",
      },
    ],
    effort: "Weeks",
    team: "Security operations",
    verification:
      "Attempt to register a peer agent in the directory without a trusted signing key and confirm the registration is refused and alerted on.",
  },
  {
    n: 8,
    name: "Only talk to agents a registry can attest to",
    short: "Attested agent registry",
    description:
      "Peer agents are accepted only when a registry attests to their identity, origin and unmodified description, and that check is repeated rather than done once.",
    guideline:
      "Attested registry and agent verification: Use registries or marketplaces that provide digital attestation of agent identity, provenance, and descriptor integrity. Require signed agent cards and continuous verification before accepting discovery or coordination messages. Leverage the PKI trusted root certificate registries to enable robust agent verification and attestation of critical attributes.",
    steps: [
      {
        text: "Source peer agents from a registry that attests to identity and provenance.",
        example:
          "Prefer an entry carrying a signed attestation of who built the agent and what it declares it can do. The usual alternative is an endpoint URL somebody pasted into a configuration file during a proof of concept and never revisited.",
      },
      {
        text: "Require signed agent cards and verify the description has not been altered.",
        example:
          "The MCP descriptor-poisoning case turns entirely on a spoofed capability list. Verify the signature over the descriptor itself, not just over the transport that delivered it.",
      },
      {
        text: "Re-verify continuously instead of trusting the first handshake.",
        example:
          "An agent that was legitimate at registration can be compromised the following month. Re-check the attestation periodically, and always immediately before a privileged exchange.",
      },
      {
        text: "Anchor verification in the trusted roots you already operate.",
        example:
          "Use the same trusted root registries that already sit behind your certificates. Agent attestation then inherits a working revocation and rotation process, instead of needing a bespoke one that nobody is on the hook for maintaining.",
      },
    ],
    effort: "Weeks",
    team: "Security engineering",
    verification:
      "Present an agent card whose signature is valid but whose capability list has been modified, and confirm the connection is refused.",
  },
  {
    n: 9,
    name: "Use typed message contracts with a declared audience",
    short: "Typed message schemas",
    description:
      "Agents exchange versioned, typed messages that state who they are for, and anything failing validation is rejected rather than interpreted generously.",
    guideline:
      "Typed contracts and schema validation: Use versioned, typed message schemas with explicit per-message audiences. Reject messages that fail validation or attempt schema down-conversion without declared compatibility. Typed contracts help with structure, but semantic divergence across agents remains an inherent challenge; mitigations therefore focus on integrity, provenance, and controlled communication patterns rather than attempting full semantic alignment.",
    steps: [
      {
        text: "Define a versioned typed schema for every message an agent may send.",
        example:
          "A structured instruction with typed fields — order 4471, refund 38.50 GBP, reason damaged — leaves far less room to be read two ways. The same instruction written as a sentence in a free-text field is where two agents quietly reach different conclusions.",
      },
      {
        text: "Declare the intended audience on each message.",
        example:
          "A message meant for the pricing agent should say so, and the inventory agent should refuse it rather than doing its best with it. Broadcast-by-default is what turns one confused agent into four.",
      },
      {
        text: "Reject validation failures and undeclared down-conversions.",
        example:
          "A peer asking to fall back to an older schema without declaring compatibility should be refused. That silent conversion is where required fields are dropped and the meaning of the message changes without anyone deciding it should.",
      },
      {
        text: "Accept that typing does not solve semantic divergence, and lean on integrity and provenance too.",
        example:
          "Two agents can still read one valid instruction differently, which is the split-brain case. Cut the surface down with types, then rely on signed provenance and controlled patterns for the rest, as the standard itself advises.",
      },
    ],
    effort: "Weeks",
    team: "Architecture",
    verification:
      "Send one message missing a required field and one requesting an undeclared schema down-conversion, and confirm both are rejected with the sending peer logged.",
  },
];

const SCENARIOS: readonly AttackScenario[] = [
  {
    title: "Semantic injection over an unencrypted channel",
    description:
      "Agents coordinate over plain HTTP or another unauthenticated channel. An attacker positioned in the middle injects hidden instructions, so the agents produce biased or malicious results while every exchange looks entirely normal.",
    brokenBy: [1, 2, 4],
  },
  {
    title: "Trust poisoning by message tampering",
    description:
      "In a network of trading agents, reputation messages are altered in transit. The system then trusts the wrong agents for its decisions, and the manipulation is indistinguishable from ordinary reputation movement.",
    brokenBy: [1, 2, 7, 8],
  },
  {
    title: "Context confusion through replay",
    description:
      "An attacker captures emergency coordination messages and replays them later. Agents act on outdated procedures and misallocate people and resources during a real event.",
    brokenBy: [2, 3, 9],
  },
  {
    title: "Goal manipulation via protocol downgrade",
    description:
      "Agents are forced into a legacy unencrypted mode that predates message authentication. The attacker then injects objectives and risk parameters, and the agents produce confidently harmful advice.",
    brokenBy: [1, 4, 6],
  },
  {
    title: "Agent-in-the-middle by descriptor poisoning",
    description:
      "A malicious MCP endpoint advertises spoofed agent descriptors and capabilities it does not have. Once trusted, it routes sensitive coordination data through attacker infrastructure while relaying enough to look functional.",
    brokenBy: [1, 6, 7, 8],
  },
  {
    title: "Registration spoofing in the discovery service",
    description:
      "An attacker registers a fake peer agent using a cloned schema so it appears to be a legitimate service. It is then handed privileged coordination traffic by agents that discovered it normally.",
    brokenBy: [1, 7, 8],
  },
  {
    title: "Split-brain interpretation of one instruction",
    description:
      "A single instruction is parsed into different intents by different agents. Each acts plausibly on its own reading, and the combined result is a set of conflicting actions that no monitoring flags as wrong.",
    brokenBy: [2, 8, 9],
  },
];

/** What the standard publishes, used for the not-yet-transcribed notice. */
export const ASI07_PUBLISHED = { controls: 9, scenarios: 7 } as const;

export const ASI07: RiskDetail | undefined =
  CONTROLS.length > 0 ? { id: "ASI07", scenarios: SCENARIOS, controls: CONTROLS } : undefined;
