import { useId } from 'react';
import type { ConsoleEvent, Series } from '../types';
import { clock, number, timestamp } from '../lib/format';
import { Empty } from './UI';

export function Chart({ series, events = [], onSelect, from, to }: { series: Series[]; events?: ConsoleEvent[]; onSelect?: (from: string, to: string) => void; from?: string | null; to?: string | null }) {
  const id = useId().replaceAll(':', '');
  const lanes = series.slice(0, 12).map(lane => ({ ...lane, points: (lane.points || []).slice(-500).filter(p => Number.isFinite(Date.parse(p.time))) }));
  const times = lanes.flatMap(lane => lane.points.map(p => Date.parse(p.time)));
  if (!times.length) return <Empty title="No timeline samples" detail="Missing measurements are not zero traffic. Check the source coverage below." />;
  const start = Math.min(...times), end = Math.max(...times), duration = Math.max(end - start, 1);
  const x = (time: string) => 60 + (Date.parse(time) - start) / duration * 700;
  return <div className="chart-lanes" data-od-id="aligned-timeline">
    {lanes.map((lane, laneIndex) => {
      const points = [...lane.points].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
      const max = Math.max(1, ...points.map(p => p.value == null || !Number.isFinite(p.value) ? 0 : p.value));
      const y = (value: number) => 140 - Math.max(0, value) / max * 105;
      const groups: { time: string; value: number }[][] = [];
      let group: { time: string; value: number }[] = [];
      for (const point of points) {
        if (point.value == null || !Number.isFinite(point.value)) { if (group.length) groups.push(group); group = []; }
        else group.push({ time: point.time, value: point.value });
      }
      if (group.length) groups.push(group);
      const path = groups.map(g => g.map((p, i) => `${i ? 'L' : 'M'}${x(p.time)} ${y(p.value)}`).join(' ')).join(' ');
      const area = groups.map(g => `M${x(g[0]!.time)} 140 ${g.map(p => `L${x(p.time)} ${y(p.value)}`).join(' ')} L${x(g.at(-1)!.time)} 140 Z`).join(' ');
      const missing = points.filter(p => p.value == null || !Number.isFinite(p.value));
      const selected = from && to && Number.isFinite(Date.parse(from)) && Number.isFinite(Date.parse(to));
      return <section key={lane.id} data-od-id={`chart-${lane.id}`}><div className="chart-heading"><h3>{lane.label || lane.id}</h3><span className="mono muted small">{lane.unit || 'Unit unavailable'} · scale 0–{number(max)}</span></div>
        <div className="chart-wrap"><svg viewBox="0 0 800 185" role="img" data-selectable={!!onSelect} onClick={onSelect ? event => { const rect = event.currentTarget.getBoundingClientRect(); const ratio = Math.max(0, Math.min(1, ((event.clientX - rect.left) / rect.width * 800 - 60) / 700)); const i = Math.min(points.length - 1, Math.floor(ratio * points.length)); const point = points[i]; if (point) onSelect(point.time, points[i + 1]?.time || point.time); } : undefined} aria-labelledby={`${id}-${laneIndex}-title ${id}-${laneIndex}-desc`}><title id={`${id}-${laneIndex}-title`}>{lane.label || lane.id}, {lane.unit || 'unknown units'}</title><desc id={`${id}-${laneIndex}-desc`}>From {timestamp(new Date(start).toISOString())} to {timestamp(new Date(end).toISOString())}. {missing.length} missing samples. Exact values and interval selection follow.</desc>
          <defs><pattern id={`${id}-${laneIndex}-gap`} width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="var(--unknown-soft)" /><path d="M0 6L6 0" stroke="var(--control-border)" /></pattern></defs>
          {[35, 87, 140].map((v, i) => <g key={v}><line x1="60" x2="760" y1={v} y2={v} className="chart-grid" /><text x="2" y={v + 4} className="chart-label">{number(max * (1 - i / 2))}</text></g>)}
          <path d={area} className="chart-fill" />
          {missing.map((point, i) => <rect key={point.time} x={Math.max(60, x(point.time) - 5)} y="28" width={Math.max(8, 700 / Math.max(points.length, 1))} height="112" fill={`url(#${id}-${laneIndex}-gap)`}><title>Missing sample {point.time} · {i + 1}</title></rect>)}
          {selected && <rect x={Math.min(760, Math.max(60, x(from)))} y="28" width={Math.max(0, Math.min(760, x(to)) - Math.max(60, x(from)))} height="112" fill="var(--unknown-soft)" stroke="var(--control-border)" />}
          <path d={path} className={laneIndex % 2 ? 'chart-secondary' : 'chart-line'} />
          {events.filter(e => e.time && Date.parse(e.time) >= start && Date.parse(e.time) <= end).slice(0, 12).map(event => <line key={event.id} x1={x(event.time!)} x2={x(event.time!)} y1="28" y2="140" className="chart-event"><title>{event.title} · {timestamp(event.time)}</title></line>)}
          {[0, 1, 2, 3].map(i => <text key={i} x={60 + i * 700 / 3} y="173" textAnchor={i === 3 ? 'end' : 'start'} className="chart-label">{clock(new Date(start + duration * i / 3).toISOString())}</text>)}
        </svg></div><div className="chart-mobile-axis mono" aria-hidden="true"><span>{clock(new Date(start).toISOString())} UTC</span><span>{clock(new Date(end).toISOString())} UTC</span></div>
        <div className="chart-note"><span>UTC · gaps break the measured path</span><span>{missing.length ? `${missing.length} missing samples` : 'No explicitly missing samples in this response'}</span></div>
        <details className="data-summary"><summary>View {lane.label || lane.id} values and select an interval</summary><table className="table responsive"><caption>{lane.unit || 'Unit unavailable'} · Source coverage qualifies these observations.</caption><thead><tr><th>Time (UTC)</th><th>Value</th><th>Evidence</th>{onSelect && <th>Investigate</th>}</tr></thead><tbody>{points.map((p, i) => <tr key={`${p.time}-${i}`}><td data-label="Time" className="mono">{timestamp(p.time)}</td><td data-label="Value" className="mono">{number(p.value)}</td><td data-label="Evidence">{p.value == null ? 'Missing sample' : 'Recorded sample; see source coverage'}</td>{onSelect && <td data-label="Investigate"><button className="btn text" onClick={() => onSelect(p.time, points[i + 1]?.time || p.time)}>Select interval</button></td>}</tr>)}</tbody></table></details>
      </section>;
    })}
  </div>;
}
