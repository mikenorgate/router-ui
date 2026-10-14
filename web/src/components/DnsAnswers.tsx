// Recorded DNS answer values with their TTLs. Full answer records render
// value · type · TTL; a bare value list renders values only; a count-only
// legacy fixture shows the labelled count. The answers_omitted warning shows
// in both shapes. Unrecorded answers stay "unavailable" — a missing answer
// is never rendered as zero or empty.
import type { DnsObservation } from '../lib/contracts';
import { dnsAnswerCount, dnsAnswerValues } from '../lib/dns';
import { number } from '../lib/format';

/** The producer kept only part of the observed answer set; the recorded
 * answer_count still describes the full observation. */
function OmittedNote({ record }: { record: DnsObservation }) {
  return <span className="sub">{record.answer_count == null ? 'Some answer values omitted' : `${record.answer_count} answers observed; some values omitted`}</span>;
}

export function DnsAnswers({ record, verbose = false, className = 'sub mono' }: { record: DnsObservation; verbose?: boolean; className?: string }) {
  if ((record.result ?? record.rcode) === 'UNOBSERVED_RESPONSE') return <span className={className}>Response metadata unobserved; answers unknown</span>;
  const records = record.answer_records;
  if (records?.length) {
    const shown = verbose ? records : records.slice(0, 3);
    return <span className="dns-answers">
      {shown.map((answer, index) => <span key={index} className={`${className} dns-answer`}>
        {answer.value || 'Value unrecorded'}{answer.type ? ` · ${answer.type}` : ''}{answer.ttl != null ? ` · TTL ${number(answer.ttl)} s` : ' · TTL unrecorded'}
      </span>)}
      {record.answers_omitted && <OmittedNote record={record} />}
      {!verbose && records.length > shown.length && <span className="sub">+{records.length - shown.length} more recorded answer{records.length - shown.length === 1 ? '' : 's'}</span>}
    </span>;
  }
  const values = dnsAnswerValues(record);
  if (values?.length) {
    const shown = verbose ? values : values.slice(0, 3);
    return <span className="dns-answers">
      <span className={className}>{shown.join(', ')}{!verbose && values.length > shown.length ? ` +${values.length - shown.length} more` : ''}</span>
      <span className="sub">TTLs not retained for these answers</span>
      {record.answers_omitted && <OmittedNote record={record} />}
    </span>;
  }
  const count = dnsAnswerCount(record);
  if (count != null) return <span className={className}>{number(count)} answer{count === 1 ? '' : 's'} · values not retained</span>;
  return <span className={className}>Answers unavailable</span>;
}
