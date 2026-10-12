# Observation contract v1

Send one JSON batch to `POST /ingest/v1/batches` over the configured Unix socket. TCP is not an ingestion transport. The server uses the connecting process's kernel UID; a header cannot substitute for it. Each configured source authorizes a set of `device`, `flow`, `policy`, `dns`, `event` or `network` records.

```json
{
  "version": 1,
  "source_id": "journal-adapter",
  "boot_id": "boot-identity",
  "sequence": 1,
  "cursor": "opaque-source-cursor",
  "coverage": "Local service events; flow verdicts unavailable",
  "sampling_rate": 1,
  "lost_records": 0,
  "records": [{
    "id": "service-event-1",
    "kind": "event",
    "observed_at": "2026-10-12T12:00:00Z",
    "data": {
      "id": "service-event-1",
      "time": "2026-10-12T12:00:00Z",
      "kind": "service",
      "severity": "warning",
      "title": "Resolver restarted",
      "detail": "Published by the local service adapter",
      "source_id": "journal-adapter"
    }
  }]
}
```

Batch limits are 1 MiB, 256 records, 16 KiB per record, 128-byte identifiers and a 2048-byte cursor. Observation times must fall within the retained 90-day interval and five minutes of future clock tolerance. A zero/invalid sampling rate, unsupported version, unauthorized record kind or invalid typed observation rejects the entire batch. No payloads, credentials, provider tokens or packet contents belong in observations.

The source owns strictly increasing sequences within each boot identity. Replay the exact same sequence and content after an uncertain acknowledgement. A repeated latest sequence returns its previously committed cursor without rewriting records. A backwards sequence or reused prior boot returns 409. Other storage failures return an unacknowledged 503; the producer keeps its cursor and retries with bounded backoff. Restart/reconnect is independent of web browser sessions.

An acknowledgement contains `accepted`, `sampled`, `duplicate`, `sequence` and `cursor`. Accepted storage sampling still acknowledges the source cursor: hourly summaries were recorded before local sampling. Producer sampling/loss is a separate limit on coverage. Producers must document whether their counters are cumulative per boot. A sequence gap indicates missing batches, not a known count of lost records.

The Go structs in `internal/model/model.go` define typed observations. `schemas/ingestion-v1.json` is shipped in the artifact for non-Go producers; regenerate it with `python3 scripts/generate-schema.py` after a contract change. Devices have stable producer-owned IDs and evidence-bearing address bindings, including valid-from/until times. Use namespaced IDs when several sources share an object kind. The console does not automatically merge devices by hostname, reused IP address or randomized MAC. A device snapshot includes its retained binding history. A flow's `device_id` must be resolved by the producer against a valid binding at event time; leave it empty if uncertain.

Publish completed flow records once, using immutable source/boot/flow IDs. Live conntrack updates need a router-owned lifecycle adapter that computes deltas or emits final records; repeated changing snapshots are not byte deltas. The console deduplicates completed flow IDs, including locally sampled flows, before hourly accounting. Report original and translated tuples when known, `unknown` when no verdict was observed, and the source's sampling rate. Each flow supplies its own observed source sampling rate; it can differ from the batch-wide coverage rate. Local sampling multiplies the flow rate and is exposed separately on stored observations. Summaries count received records and bytes, not estimated unsampled traffic or successful application connectivity.

Policy observations include stable IDs, producer/policy/revision/source/group references, processing location and order, lifecycle timestamps, `installed`, `applicable`, `observed_match`, and `counters_scope`. A shared counter does not prove a device match. The contract rejects that claim on a device-specific shared-counter record. Producers can publish device-specific applicability or a global rule with no device ID; they must not publish a group rule as universally applicable. Unknown origin remains blank and visible. Expiry alone does not establish removal; publish a subsequent installed snapshot confirming removal. Preserve related binding and policy history at least as long as retained flows.

The application currently renders producer-supplied policy evidence. It does not execute a general nftables interpreter, predict access through unsupported hooks, or infer the cause of a failure from a counter alone. Router adapters must qualify their semantics and make unsupported coverage explicit.

Browser endpoints use `/api/v1`, JSON collection envelopes `{ "items": [] }`, bounded `limit`/`cursor`, `device_id`, literal text `q`, and optional RFC3339 `from`/`to` for history. Offset cursors are bounded to 10,000 and may move while new observations arrive; use an explicit end time for a stable investigation. Exports contain at most 500 records and require Operator. Traffic verdict, protocol, address-family and recorded-translation filters apply before pagination. No arbitrary SQL or PromQL reaches the stores.
