export type Role = 'viewer' | 'operator' | 'admin';
export interface Session { user: { id: string; name: string; role: Role }; csrf_token: string; mode: 'fixture' | 'production' }
export interface AuthMethods { local: boolean; oidc?: { enabled: boolean; name?: string; login_url?: string } }
export interface Address { address: string; family?: string | number; valid_from?: string; valid_until?: string | null; source?: string; confidence?: string | number }
export interface Source { id: string; kind?: string; status?: 'current' | 'missing' | 'stale' | 'failed' | 'partial' | 'unsupported' | string; observed_at?: string | null; checked_at?: string | null; scope?: string; generation?: number | string | null; error_code?: string; lag_seconds?: number | null; coverage?: string; sampling_rate?: number | null; lost_records?: number | null; sequence_gaps?: number | null; last_sequence?: number | null }
export interface Device { id: string; name?: string; segment?: string; mac?: string; addresses?: Address[]; last_seen?: string | null; observed_at?: string | null; status?: string; sources?: Source[] }
export interface Flow { binding?: Address & { device_id?: string };
  id: string; device_id?: string; source_ip?: string; destination_ip?: string; destination_name?: string; source_port?: number | null; destination_port?: number | null; protocol?: string; bytes_sent?: number | null; bytes_received?: number | null; started_at?: string; last_seen?: string; verdict?: 'allowed' | 'blocked' | 'unknown'; rule_id?: string; translated_source_ip?: string; translated_destination_ip?: string; sampling_rate?: number | null; evidence?: string; source_id?: string;
  /** Record lifecycle: still open, completed, or a decision-only record without byte totals. Server-filterable via ?state=. */
  state?: 'active' | 'completed' | 'decision' | string;
  /** Producing namespace/zone/observation point. Rows from different points are never summed together.
   * The backend serializes the conntrack zone as uint16 (omitempty); older fixtures used string labels. */
  namespace?: string; zone?: string | number; observation_point?: string;
  /** Translated ports, recorded only when translation is observed. */
  translated_source_port?: number | null; translated_destination_port?: number | null;
  /** Policy revision and binding reference as recorded with the verdict. */
  policy_revision?: string; binding_ref?: string;
}
export interface Policy { id: string; rule_id?: string; application_id?: string; device_id?: string; binding_ref?: string; installation_generation?: string | number | null; lifecycle?: 'active' | 'expired_pending_removal' | 'confirmed_removed' | 'unknown' | string; lifecycle_at?: string | null; action?: string; scope?: string; name?: string; conditions?: string | Record<string, unknown>; installed?: boolean | null; applicable?: boolean | null; observed_match?: boolean | null; origin?: { producer?: string; policy_id?: string; revision?: string; source_ref?: string; group_id?: string }; table?: string; chain?: string; hook?: string; priority?: number | null; order?: number | null; observed_at?: string | null; expires_at?: string | null; counters_scope?: 'shared' | 'device' | 'unknown'; packets?: number | null; bytes?: number | null }
export interface ConsoleEvent { id: string; time?: string; kind?: string; severity?: string; title?: string; detail?: string; device_id?: string; rule_id?: string; source_id?: string }
export interface MetricRecord { id: string; label?: string; value?: number | null; unit?: string; observed_at?: string | null; status?: string; scope?: string }
export interface Series { id: string; label?: string; unit?: string; points?: { time: string; value?: number | null }[] }
export interface Overview { metrics?: MetricRecord[]; series?: Series[]; devices_total?: number | null; active_devices?: number | null; flows_total?: number | null; events?: ConsoleEvent[]; sources?: Source[]; capabilities?: { id: string; supported?: boolean; reason?: string }[] }
export interface DeviceDetail { device: Device; bindings?: Address[]; flows?: Flow[]; policies?: Policy[]; policies_next_cursor?: string | null; policy_sources?: Source[]; events?: ConsoleEvent[]; annotation?: { alias?: string; note?: string }; detail_restricted?: boolean;
  /** False when the device is no longer in the current inventory: the payload
   * is retained history, not evidence of current presence. */
  current_inventory?: boolean }
export interface Collection<T> { items?: T[]; next_cursor?: string | null; sources?: Source[]; capabilities?: { id: string; supported?: boolean; reason?: string }[] }
export interface Network { interfaces?: Record<string, unknown>[]; segments?: Record<string, unknown>[]; routes?: Record<string, unknown>[]; coverage_notes?: string[] }
export interface SystemInfo { version?: string; mode?: string; appliance?: { id: string; image_version?: string; boot_id?: string; observed_at?: string | null; clock_synchronized?: boolean | null; services?: { name: string; status: string }[]; storage?: { mount: string; available_bytes?: number | null; total_bytes?: number | null }[] } | null; capabilities?: { id: string; supported?: boolean; reason?: string }[]; sources?: Source[]; storage?: { used_bytes?: number | null; budget_bytes?: number | null; raw_days?: number | null; history_days?: number | null; sampling_rate?: number | null }; listeners?: { address?: string; status?: string }[]; auth?: { oidc_enabled?: boolean; local_recovery?: boolean }; certificates?: { names?: string[]; expires_at?: string; status?: string }[] }
