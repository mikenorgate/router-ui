import { useId, useState } from 'react';
import type { ConsoleEvent, Series } from '../types';
import { axisScale, clock, number, timestamp } from '../lib/format';
import { Empty } from './UI';

type LanePoint = { time: string; value?: number | null };
type Lane = Series & { points: LanePoint[] };
const PLOT = { left: 60, width: 700, top: 28, bottom: 140, height: 105, viewWidth: 800, viewHeight: 185 };

export function Chart({ series, events = [], onSelect, from, to }: { series: Series[]; events?: ConsoleEvent[]; onSelect?: (from: string, to: string) => void; from?: string | null; to?: string | null }) {
  const lanes: Lane[] = series.slice(0, 12).map(lane => ({ ...lane, points: (lane.points || []).slice(-500).filter(p => Number.isFinite(Date.parse(p.time))) }));
  const times = lanes.flatMap(lane => lane.points.map(p => Date.parse(p.time)));
  if (!times.length) return <Empty title="No timeline samples" detail="Missing measurements are not zero traffic. Check the source coverage below." />;
  const start = Math.min(...times), end = Math.max(...times), duration = Math.max(end - start, 1);
  return <div className="chart-lanes" data-od-id="aligned-timeline">
    {lanes.map((lane, laneIndex) => <ChartLane key={lane.id} lane={lane} laneIndex={laneIndex} start={start} end={end} duration={duration} events={events} onSelect={onSelect} from={from} to={to} />)}
  </div>;
}

function ChartLane({ lane, laneIndex, start, end, duration, events, onSelect, from, to }: { lane: Lane; laneIndex: number; start: number; end: number; duration: number; events: ConsoleEvent[]; onSelect?: (from: string, to: string) => void; from?: string | null; to?: string | null }) {
  const id = useId().replaceAll(':', '');
  const points = [...lane.points].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  const scale = axisScale(Math.max(0, ...points.map(p => p.value == null || !Number.isFinite(p.value) ? 0 : p.value)), lane.unit);
  const x = (time: string) => PLOT.left + (Date.parse(time) - start) / duration * PLOT.width;
  const y = (value: number) => PLOT.bottom - Math.max(0, value * scale.factor) / scale.max * PLOT.height;
  const [hover, setHover] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ a: number; b: number } | null>(null);

  const groups: LanePoint[][] = [];
  let group: LanePoint[] = [];
  for (const point of points) {
    if (point.value == null || !Number.isFinite(point.value)) { if (group.length) groups.push(group); group = []; }
    else group.push(point);
  }
  if (group.length) groups.push(group);
  const path = groups.map(g => g.map((p, i) => `${i ? 'L' : 'M'}${x(p.time)} ${y(p.value as number)}`).join(' ')).join(' ');
  const area = groups.map(g => `M${x(g[0]!.time)} ${PLOT.bottom} ${g.map(p => `L${x(p.time)} ${y(p.value as number)}`).join(' ')} L${x(g.at(-1)!.time)} ${PLOT.bottom} Z`).join(' ');
  const missing = points.filter(p => p.value == null || !Number.isFinite(p.value));
  const selected = from && to && Number.isFinite(Date.parse(from)) && Number.isFinite(Date.parse(to));
  const laneEvents = events.filter(e => e.time && Date.parse(e.time) >= start && Date.parse(e.time) <= end).slice(0, 12);

  const svgX = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = rect.width ? (event.clientX - rect.left) / rect.width * PLOT.viewWidth : PLOT.left;
    return Math.max(PLOT.left, Math.min(PLOT.left + PLOT.width, px));
  };
  const timeAt = (px: number) => start + (px - PLOT.left) / PLOT.width * duration;
  const nearest = (px: number) => {
    const target = timeAt(px);
    let best = 0, distance = Infinity;
    points.forEach((point, i) => { const d = Math.abs(Date.parse(point.time) - target); if (d < distance) { distance = d; best = i; } });
    return best;
  };
  const inspect = (index: number) => { const point = points[index]; if (point && onSelect) onSelect(point.time, points[index + 1]?.time || point.time); };

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!onSelect || event.button !== 0 || !points.length) return;
    const px = svgX(event);
    setDrag({ a: px, b: px });
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* pointer capture unsupported */ }
  };
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!points.length) return;
    const px = svgX(event);
    setHover(nearest(px));
    setDrag(current => current ? { ...current, b: px } : current);
  };
  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const a = Math.min(drag.a, drag.b), b = Math.max(drag.a, drag.b);
    setDrag(null);
    if (!onSelect || !points.length) return;
    if (b - a < 6) { inspect(nearest(svgX(event))); return; }
    const first = points[nearest(a)], last = points[nearest(b)];
    if (first && last) {
      if (first.time === last.time) inspect(nearest(b));
      else onSelect(first.time, last.time);
    }
  };
  const onKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    if (!points.length) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      setHover(current => current == null ? (delta > 0 ? 0 : points.length - 1) : Math.max(0, Math.min(points.length - 1, current + delta)));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setHover(event.key === 'Home' ? 0 : points.length - 1);
    } else if (event.key === 'Enter' && hover != null && onSelect) {
      event.preventDefault();
      inspect(hover);
    } else if (event.key === 'Escape') setHover(null);
  };

  const hoverPoint = hover != null ? points[hover] : undefined;
  const hoverMissing = !!hoverPoint && (hoverPoint.value == null || !Number.isFinite(hoverPoint.value));
  const hoverX = hoverPoint ? x(hoverPoint.time) : 0;
  const hoverY = hoverPoint && !hoverMissing ? y(hoverPoint.value as number) : null;
  const sampleGap = points.length > 1 ? Math.abs(Date.parse(points[1]!.time) - Date.parse(points[0]!.time)) / 2 : duration / 120;
  const hoverEvents = hoverPoint ? laneEvents.filter(e => Math.abs(Date.parse(e.time!) - Date.parse(hoverPoint.time)) <= Math.max(sampleGap, 1)).slice(0, 2) : [];
  const tipY = hoverY ?? PLOT.top + (PLOT.bottom - PLOT.top) / 2;
  const tipAlign = hoverX < PLOT.left + 90 ? '0' : hoverX > PLOT.left + PLOT.width - 90 ? '-100%' : '-50%';
  const tipBelow = hoverY != null && hoverY < PLOT.top + 42;

  return <section data-od-id={`chart-${lane.id}`}><div className="chart-heading"><h3>{lane.label || lane.id}</h3><span className="mono muted small">{scale.unit || 'Unit unavailable'} · scale 0–{number(scale.max)}</span></div>
    <div className="chart-wrap"><svg viewBox={`0 0 ${PLOT.viewWidth} ${PLOT.viewHeight}`} role="img" tabIndex={0} data-selectable={!!onSelect} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={() => { if (!drag) setHover(null); }} onKeyDown={onKeyDown} aria-labelledby={`${id}-title ${id}-desc`}><title id={`${id}-title`}>{lane.label || lane.id}, {scale.unit || 'unknown units'}</title><desc id={`${id}-desc`}>From {timestamp(new Date(start).toISOString())} to {timestamp(new Date(end).toISOString())}. {missing.length} missing samples. Hover, or focus and use the arrow keys, to inspect samples{onSelect ? '; drag across the chart or press Enter to select an interval' : ''}. Exact values and interval selection follow in the table.</desc>
      <defs><pattern id={`${id}-gap`} width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="var(--unknown-soft)" /><path d="M0 6L6 0" stroke="var(--control-border)" /></pattern></defs>
      {[0, 1, 2, 3].map(i => { const gy = PLOT.bottom - i / 3 * PLOT.height; return <g key={i}><line x1={PLOT.left} x2={PLOT.left + PLOT.width} y1={gy} y2={gy} className="chart-grid" /><text x={PLOT.left - 8} y={gy + 4} textAnchor="end" className="chart-label">{number(i * scale.step)}</text></g>; })}
      <path d={area} className="chart-fill" />
      {missing.map(point => <rect key={point.time} x={Math.max(PLOT.left, x(point.time) - 5)} y={PLOT.top} width={Math.max(8, PLOT.width / Math.max(points.length, 1))} height={PLOT.bottom - PLOT.top} fill={`url(#${id}-gap)`} />)}
      {selected && <rect x={Math.min(PLOT.left + PLOT.width, Math.max(PLOT.left, x(from)))} y={PLOT.top} width={Math.max(0, Math.min(PLOT.left + PLOT.width, x(to)) - Math.max(PLOT.left, x(from)))} height={PLOT.bottom - PLOT.top} className="chart-selected" />}
      {drag && Math.abs(drag.b - drag.a) > 1 && <rect x={Math.min(drag.a, drag.b)} y={PLOT.top} width={Math.abs(drag.b - drag.a)} height={PLOT.bottom - PLOT.top} className="chart-selecting" />}
      <path d={path} className={laneIndex % 2 ? 'chart-secondary' : 'chart-line'} />
      {laneEvents.map(event => <line key={event.id} x1={x(event.time!)} x2={x(event.time!)} y1={PLOT.top} y2={PLOT.bottom} className="chart-event"><title>{event.title} · {timestamp(event.time)}</title></line>)}
      {hoverPoint && !drag && <line x1={hoverX} x2={hoverX} y1={PLOT.top} y2={PLOT.bottom} className="chart-hover-line" />}
      {hoverY != null && !drag && <circle cx={hoverX} cy={hoverY} r="3.5" className={`chart-dot${laneIndex % 2 ? ' secondary' : ''}`} />}
      {[0, 1, 2, 3].map(i => <text key={i} x={PLOT.left + i * PLOT.width / 3} y="173" textAnchor={i === 3 ? 'end' : 'start'} className="chart-label">{clock(new Date(start + duration * i / 3).toISOString())}</text>)}
    </svg>{hoverPoint && !drag && <div className="chart-tip" role="status" style={{ left: `${hoverX / PLOT.viewWidth * 100}%`, top: `${tipY / PLOT.viewHeight * 100}%`, transform: `translate(${tipAlign}, ${tipBelow ? '16px' : 'calc(-100% - 12px)'})` }}>
      <span className="muted">{clock(hoverPoint.time)} UTC</span>
      {hoverMissing ? <strong>Missing sample</strong> : <strong className="mono">{number((hoverPoint.value as number) * scale.factor)} {scale.unit}</strong>}
      {hoverMissing && <span className="muted">Not measured — not zero traffic.</span>}
      {hoverEvents.map(event => <span key={event.id} className="muted">{event.title}</span>)}
    </div>}</div>
    <div className="chart-mobile-axis mono" aria-hidden="true"><span>{clock(new Date(start).toISOString())} UTC</span><span>{clock(new Date(end).toISOString())} UTC</span></div>
    <div className="chart-note"><span>{drag ? `Selecting ${clock(new Date(timeAt(Math.min(drag.a, drag.b))).toISOString())} → ${clock(new Date(timeAt(Math.max(drag.a, drag.b))).toISOString())} UTC — release to investigate` : onSelect ? 'UTC · hover for values · drag to select an interval · gaps break the measured path' : 'UTC · gaps break the measured path'}</span><span>{missing.length ? `${missing.length} missing samples` : 'No explicitly missing samples in this response'}</span></div>
    <details className="data-summary"><summary>View {lane.label || lane.id} values and select an interval</summary><table className="table responsive"><caption>{scale.unit || 'Unit unavailable'} · Source coverage qualifies these observations.</caption><thead><tr><th>Time (UTC)</th><th>Value</th><th>Evidence</th>{onSelect && <th>Investigate</th>}</tr></thead><tbody>{points.map((p, i) => <tr key={`${p.time}-${i}`}><td data-label="Time" className="mono">{timestamp(p.time)}</td><td data-label="Value" className="mono">{number(p.value == null ? null : p.value * scale.factor)}</td><td data-label="Evidence">{p.value == null ? 'Missing sample' : 'Recorded sample; see source coverage'}</td>{onSelect && <td data-label="Investigate"><button className="btn text" onClick={() => onSelect(p.time, points[i + 1]?.time || p.time)}>Select interval</button></td>}</tr>)}</tbody></table></details>
  </section>;
}
