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
// - An observed decision is separate from a predicted outcome and from
//   application connectivity; conntrack alone never proves success.
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

/** DNS observation. Names come from resolver/protocol metadata; the console
 * never identifies an application from a port or domain alone. */
export interface DnsObservation {
  id: string;
  device_id?: string;
  query_name?: string;
  query_type?: string;
  rcode?: string;
  answers?: number | null;
  resolver?: string;
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
  evidence?: 'observed' | 'partial' | 'unknown' | string;
  observation_ref?: string;
}

/** GET /api/v1/traffic/summary response. */
export interface TrafficSummary {
  interval: { from?: string; to?: string; /** true while the window is still accumulating */ live?: boolean };
  generated_at?: string;
  accounting: AccountingKind;
  rankings?: DeviceTrafficRank[];
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
  reconciliation?: { interface_bytes?: number | null; attributed_bytes?: number | null; note?: string };
  sources?: Source[];
  capabilities?: { id: string; supported?: boolean; reason?: string }[];
}

/** One evaluated step of the policy path. Ordering and hook context are
 * preserved; the path is never flattened into a single first-match list. */
export interface PolicyPathStep {
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

/** GET /api/v1/investigations/{opaque_ref} — a passive access explanation. */
export interface AccessInvestigation {
  ref: string;
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
  /** Labelled simulation only; separate from any observed verdict. */
  predicted_outcome?: { result?: string; basis?: string; simulated: true } | null;
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
  action?: string;
  scope?: string;
  source_restriction?: string;
  installed?: boolean | null;
  applicable?: boolean | null;
  observed_match?: boolean | null;
  origin?: { producer?: string; policy_id?: string; revision?: string; source_ref?: string };
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
