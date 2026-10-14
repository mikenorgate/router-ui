// Phase 3 investigation contracts for the Router Console.
// These types are additive over web/src/types.ts. They describe proposed API
// payloads for: /api/v1/traffic/summary, /api/v1/observations/{opaque_ref},
// /api/v1/investigations/{opaque_ref}, /api/v1/exposure, and extensions to the
// existing /flows, /dns and /events collections.
//
// Rules encoded here (from docs/PRODUCT_PLAN.md and the phase 3 brief):
// - References carry source/boot/kind/record identity, never only a bare ID.
// - Live interval accounting is distinct from completed-flow totals.
// - Source sampling (collection) is distinct from storage sampling (retention).
// - An observed decision is separate from application connectivity; conntrack
//   alone never proves success. Outcomes are never simulated.
// - Configured exposure is separate from externally verified reachability.
import type { ConsoleEvent, Flow, Series, Source } from '../types';

/** Identity of the single producing observation. More than a bare ID. */
export interface RecordIdentity {
  /** Opaque URL-safe reference accepted by /api/v1/observations/{ref}. */
  ref: string;
  /** Observation kind, e.g. flow, dns, event, counter. */
  kind: 'flow' | 'dns' | 'event' | 'counter' | string;
  /** Producing source, matching Source.id. */
  source_id: string;
  /** Human-facing source kind, e.g. "Flow metadata". */
  source_kind?: string;
  /** Router boot that produced the record; distinguishes reused IDs across reboots. */
  boot_id?: string;
  /** Producer-local record identity (sequence or handle) within source + boot. */
  record_id?: string;
  /** When the record was captured by the producer. */
  recorded_at?: string;
}

export interface ObservationLink {
  rel: 'device' | 'rule' | 'source' | 'investigation' | 'events' | string;
  href: string;
  label: string;
}

/** Envelope returned by GET /api/v1/observations/{opaque_ref}. Resolving a
 * record by reference must not depend on any list page or cursor position. */
export interface Observation {
  identity: RecordIdentity;
  /** Kind-specific payload; flows keep the existing Flow shape. */
  record?: Flow | DnsObservation | ConsoleEvent | Record<string, unknown>;
  /** Verbatim evidence qualifier supplied by the producer. */
  evidence?: string;
  links?: ObservationLink[];
  /** Permission or retention notes, e.g. "DNS detail requires Operator". */
  restrictions?: string[];
  sources?: Source[];
}

/** One DNS answer record with its TTL, as sent by the backend. */
export interface DnsAnswerRecord {
  name?: string;
  type?: string;
  value?: string;
  /** Seconds the answer may be cached; null when the producer did not record it. */
  ttl?: number | null;
}

/** Address binding the backend associated with this query at observation time. */
export interface DnsBinding {
  device_id?: string;
  address?: string;
  valid_from?: string;
  valid_until?: string | null;
  source?: string;
}

/** DNS observation, aligned with the backend record (internal/model DNS:
 * query / type / result / answers as a string list). Legacy fixture fields
 * (query_name / query_type / rcode / numeric answers) stay accepted so older
 * fixtures keep typechecking; renderers must read the backend names first.
 * Names come from resolver/protocol metadata; the console never identifies an
 * application from a port or domain alone. */
export interface DnsObservation {
  answer_count?: number | null;
  answers_omitted?: boolean;
  query_at?: string;
  transaction_id?: string;
  id: string;
  device_id?: string;
  /** Backend names. */
  query?: string;
  type?: string;
  result?: string;
  /** Backend sends the answer values; older fixtures may carry only a count. */
  answers?: string[] | number | null;
  /** Full answer records with TTLs when the producer retained them. */
  answer_records?: DnsAnswerRecord[] | null;
  /** Client address that asked, when recorded. */
  client_ip?: string;
  /** Binding valid at observation time, with provenance. */
  binding?: DnsBinding | null;
  /** Legacy fixture aliases — superseded by query / type / result. */
  query_name?: string;
  query_type?: string;
  rcode?: string;
  resolver?: string;
  /** Nullable: an unmeasured latency stays unknown, never zero. */
  latency_ms?: number | null;
  observed_at?: string;
  source_id?: string;
  sampling_rate?: number | null;
  evidence?: string;
  observation_ref?: string;
}

/** Existing Flow payload extended with its resolvable observation reference. */
export type FlowWithRef = Flow & { observation_ref?: string };

/** Existing ConsoleEvent payload extended with its observation reference. */
export type EventWithRef = ConsoleEvent & { observation_ref?: string };

/** How ranked traffic totals were accounted. Never mix the two in one number. */
export type AccountingKind = 'live-interval' | 'completed-flows';

export interface DeviceTrafficRank {
  device_id: string;
  label?: string;
  bytes_sent?: number | null;
  bytes_received?: number | null;
  /** Share of *attributed* traffic only, never of the interface total. */
  share_of_attributed?: number | null;
  /** The measurement point this total was accounted at (e.g. an interface or
   * segment boundary). The same device may rank at several accounting points;
   * rows at different points are separate observations and are never summed. */
  accounting_point?: string;
  /** Producing source/namespace/zone/observation point qualifiers. */
  source_id?: string;
  namespace?: string;
  zone?: string;
  observation_point?: string;
  evidence?: 'observed' | 'partial' | 'unknown' | string;
  observation_ref?: string;
}

/** GET /api/v1/traffic/summary response. */
export interface TrafficSummary {
  interval: { from?: string; to?: string; /** true while the window is still accumulating */ live?: boolean };
  generated_at?: string;
  accounting: AccountingKind;
  rankings?: DeviceTrafficRank[];
  /** True when the server bounded the ranking before returning it. */
  rankings_truncated?: boolean;
  /** Defined bucket for traffic that could not be attributed to a device. */
  unattributed?: { bytes_sent?: number | null; bytes_received?: number | null; note?: string };
  series?: Series[];
  /** Explicit measurement gaps; a gap is never zero traffic. */
  gaps?: { from?: string; to?: string; reason?: string }[];
  sampling?: {
    /** Collection-side sampling rate at the observation source. */
    source_rate?: number | null;
    /** Retention-side sampling applied by storage. */
    storage_rate?: number | null;
    note?: string;
  };
  /** Present only when interface bytes were actually measured in this window;
   * when unmeasured the backend omits it and the UI must stay unknown. */
  reconciliation?: { interface_bytes?: number | null; attributed_bytes?: number | null; note?: string };
  sources?: Source[];
  capabilities?: { id: string; supported?: boolean; reason?: string }[];
}

/** One historically retained rule in the recorded policy context. The
 * backend may retain only a single rule for a subject; hook/order values are
 * recorded rule attributes, not a reconstructed evaluation path, and the
 * console never simulates evaluation. */
export interface PolicyPathStep {
  entry_hooks?: string[];
  step: string;
  rule_id?: string;
  action?: string;
  scope?: string;
  hook?: string;
  order?: number | null;
  installed?: boolean | null;
  applicable?: boolean | null;
  observed_match?: boolean | null;
  counters_scope?: 'shared' | 'device' | 'unknown';
  origin?: { producer?: string; policy_id?: string; revision?: string; source_ref?: string; group_id?: string };
  observed_at?: string | null;
}

/** GET /api/v1/investigations/{opaque_ref} — a passive access explanation.
 * Actual envelope: {identity, subject, observed_decision, policy_path,
 * binding, translation, events, limits, unresolved_questions, sources}. The
 * opaque resolution reference lives inside identity.ref; the response carries
 * no top-level ref. */
export interface AccessInvestigation {
  /** Record identity of the investigation itself: producing source, router
   * boot, producer-local record id and capture time, plus the opaque ref. */
  identity: RecordIdentity;
  /** Legacy fixture alias superseded by identity.ref; actual responses omit it. */
  ref?: string;
  subject: {
    device_id?: string;
    source?: string;
    destination?: string;
    protocol?: string;
    destination_port?: number | null;
    queried_at?: string;
  };
  /** What the router recorded happening. Null when unobserved. */
  observed_decision?: {
    verdict?: 'allowed' | 'blocked' | 'unknown' | string;
    evidence?: string;
    observed_at?: string | null;
    observation_ref?: string;
  } | null;
  policy_path?: PolicyPathStep[];
  /** Address binding valid at the time of the observation, with provenance. */
  binding?: { device_id?: string; address?: string; valid_from?: string; valid_until?: string | null; source?: string; confidence?: string };
  translation?: {
    recorded: boolean;
    original?: { source_ip?: string; source_port?: number | null; destination_ip?: string; destination_port?: number | null };
    translated?: { source_ip?: string; source_port?: number | null; destination_ip?: string; destination_port?: number | null } | null;
    note?: string;
  };
  route?: { interface?: string; next_hop?: string; evidence?: string } | null;
  /** Questions the available evidence cannot answer. Always visible. */
  unresolved_questions?: string[];
  /** Honest limits of this explanation (sampling, unsupported semantics, …). */
  limits?: string[];
  /** Events correlated with this subject by the backend, each carrying its
   * observation reference when the underlying record is retained. */
  events?: (ConsoleEvent & { observation_ref?: string })[];
  sources?: Source[];
}

export interface ExposureListener {
  id: string;
  address?: string;
  port?: number | null;
  protocol?: string;
  /** Configured label from the image/manifest; never an inferred service name. */
  configured_label?: string;
  /** Configured source restriction, e.g. a management segment. */
  source_restriction?: string;
  state?: 'configured' | 'observed' | 'stale' | 'unknown' | string;
  source_ref?: string;
  observation_ref?: string;
  evidence?: string;
}

export interface ExposureForward {
  id: string;
  listen?: string;
  target?: string;
  protocol?: string;
  source_restriction?: string;
  state?: 'configured' | 'observed' | 'stale' | 'unknown' | string;
  source_ref?: string;
  evidence?: string;
}

export interface ExposureInboundRule {
  rule_id?: string;
  /** Policy name and conditions, preserved verbatim from the Policy record —
   * conditions are part of the evidence and are never dropped or paraphrased. */
  name?: string;
  conditions?: string | Record<string, unknown>;
  action?: string;
  scope?: string;
  source_restriction?: string;
  installed?: boolean | null;
  applicable?: boolean | null;
  observed_match?: boolean | null;
  origin?: { producer?: string; policy_id?: string; revision?: string; source_ref?: string };
  /** When the policy was last observed installed. */
  observed_at?: string | null;
  evidence?: string;
}

/** GET /api/v1/exposure response. Configured exposure only; the router never
 * scans, pings or probes, so external reachability is always unverified. */
export interface Exposure {
  generated_at?: string;
  verified_externally: 'never';
  listeners?: ExposureListener[];
  forwards?: ExposureForward[];
  inbound?: ExposureInboundRule[];
  notes?: string[];
  sources?: Source[];
  capabilities?: { id: string; supported?: boolean; reason?: string }[];
}

/** Server-side filter parameters accepted by the phase 3 collections. */
export interface WindowParams {
  range?: string | null;
  from?: string | null;
  to?: string | null;
}
