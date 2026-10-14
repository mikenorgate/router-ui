// Device shared time window: traffic, DNS, connection and history lanes drawn
// on ONE shared time axis with a single cursor, so a spike in one lane can be
// read against the others and against binding/event markers. Values stay in
// per-lane units (never rescaled into each other), missing samples break each
// path, and every lane has a labelled table alternative.
import { useId, useMemo, useState } from 'react';
import type { Series } from '../types';
import { clock, number, timestamp } from '../lib/format';
import { axisScale } from '../lib/phase3Scale';
import { Empty } from './UI';

export interface WindowMarker { time: string; label: string; kind?: string }

type LanePoint = { time: string; value?: number | null };
type Lane = Series & { points: LanePoint[] };

const LEFT = 8;
const WIDTH = 784;
const VIEW_W = 800;
const LANE_H = 56;
const LANE_GAP = 34;

export function TimeWindowLanes({ lanes: rawLanes, markers = [], from, to, onSelect }: {
  lanes: Series[];
  markers?: WindowMarker[];
  from?: string | null;
  to?: string | null;
  onSelect?: (from: string, to: string) => void;
}) {
  const id = useId().replaceAll(':', '');
  const lanes: Lane[] = useMemo(() => rawLanes.slice(0, 8).map(lane => ({
    ...lane,
    points: (lane.points || []).slice(-500).filter(p => Number.isFinite(Date.parse(p.time))),
  })), [rawLanes]);
  const times = lanes.flatMap(lane => lane.points.map(p => Date.parse(p.time)));
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  if (!times.length) return <Empty title="No timeline samples in this window" detail="Missing measurements are not zero traffic. Check source coverage for this device." />;

  const start = Math.min(...times);
  const end = Math.max(...times);
  const duration = Math.max(end - start, 1);
  const viewH = lanes.length * (LANE_H + LANE_GAP) + 26;
  const x = (ms: number) => LEFT + (ms - start) / duration * WIDTH;
  const laneTop = (index: number) => 20 + index * (LANE_H + LANE_GAP);

  const scales = lanes.map(lane => axisScale(Math.max(0, ...lane.points.map(p => p.value == null || !Number.isFinite(p.value) ? 0 : p.value)), lane.unit));
  const sortedTimes = [...new Set(times)].sort((a, b) => a - b);
  const markersInWindow = markers.filter(m => Number.isFinite(Date.parse(m.time)) && Date.parse(m.time) >= start && Date.parse(m.time) <= end).slice(0, 16);
  const selected = from && to && Number.isFinite(Date.parse(from)) && Number.isFinite(Date.parse(to));

  const nearestTime = (target: number) => {
    let best = sortedTimes[0]!, distance = Infinity;
    for (const t of sortedTimes) { const d = Math.abs(t - target); if (d < distance) { distance = d; best = t; } }
    return best;
  };
  const selectAt = (ms: number) => {
    if (!onSelect) return;
    const index = sortedTimes.indexOf(ms);
    const next = sortedTimes[index + 1];
    onSelect(new Date(ms).toISOString(), next !== undefined ? new Date(next).toISOString() : new Date(ms).toISOString());
  };
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const px = Math.max(LEFT, Math.min(LEFT + WIDTH, (event.clientX - rect.left) / rect.width * VIEW_W));
    setHoverTime(nearestTime(start + (px - LEFT) / WIDTH * duration));
  };
  const onKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      setHoverTime(current => {
        if (current == null) return delta > 0 ? sortedTimes[0]! : sortedTimes[sortedTimes.length - 1]!;
        const index = sortedTimes.indexOf(current);
        return sortedTimes[Math.max(0, Math.min(sortedTimes.length - 1, index + delta))]!;
      });
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setHoverTime(event.key === 'Home' ? sortedTimes[0]! : sortedTimes[sortedTimes.length - 1]!);
    } else if (event.key === 'Enter' && hoverTime != null) {
      event.preventDefault();
      selectAt(hoverTime);
    } else if (event.key === 'Escape') setHoverTime(null);
  };

  const hoverLabel = hoverTime != null ? clock(new Date(hoverTime).toISOString()) : null;
  const hoverMarkers = hoverTime != null ? markersInWindow.filter(m => Math.abs(Date.parse(m.time) - hoverTime) <= duration / 120).slice(0, 3) : [];

  return <section data-od-id="time-window-lanes">
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${VIEW_W} ${viewH}`} role="img" tabIndex={0} data-selectable={!!onSelect}
        onPointerMove={onPointerMove} onPointerLeave={() => setHoverTime(null)} onPointerUp={event => { if (hoverTime != null && event.button === 0) selectAt(hoverTime); }}
        onKeyDown={onKeyDown} aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>Aligned lanes: {lanes.map(l => l.label || l.id).join(', ')}</title>
        <desc id={`${id}-desc`}>One shared time axis from {timestamp(new Date(start).toISOString())} to {timestamp(new Date(end).toISOString())}. Lanes keep their own units. Use arrow keys to move the shared cursor; Enter selects the sample interval. Tables with exact values follow.</desc>
        <defs><pattern id={`${id}-gap`} width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="var(--unknown-soft)" /><path d="M0 6L6 0" stroke="var(--control-border)" /></pattern></defs>
        {selected && <rect x={Math.max(LEFT, Math.min(LEFT + WIDTH, x(Date.parse(from))))} y={16} width={Math.max(0, Math.min(LEFT + WIDTH, x(Date.parse(to))) - Math.max(LEFT, x(Date.parse(from))))} height={viewH - 42} className="chart-selected" />}
        {lanes.map((lane, laneIndex) => {
          const top = laneTop(laneIndex);
          const scale = scales[laneIndex]!;
          const y = (value: number) => top + LANE_H - Math.max(0, value * scale.factor) / scale.max * LANE_H;
          const points = [...lane.points].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
          const groups: LanePoint[][] = [];
          let group: LanePoint[] = [];
          for (const point of points) {
            if (point.value == null || !Number.isFinite(point.value)) { if (group.length) groups.push(group); group = []; }
            else group.push(point);
          }
          if (group.length) groups.push(group);
          const path = groups.map(g => g.map((p, i) => `${i ? 'L' : 'M'}${x(Date.parse(p.time))} ${y(p.value as number)}`).join(' ')).join(' ');
          const area = groups.map(g => `M${x(Date.parse(g[0]!.time))} ${top + LANE_H} ${g.map(p => `L${x(Date.parse(p.time))} ${y(p.value as number)}`).join(' ')} L${x(Date.parse(g.at(-1)!.time))} ${top + LANE_H} Z`).join(' ');
          const missing = points.filter(p => p.value == null || !Number.isFinite(p.value));
          const hoverPoint = hoverTime != null ? points.reduce<LanePoint | undefined>((best, p) => Math.abs(Date.parse(p.time) - hoverTime) < Math.abs(Date.parse(best?.time ?? p.time) - hoverTime) ? p : best, undefined) : undefined;
          const hoverMissing = hoverPoint != null && (hoverPoint.value == null || !Number.isFinite(hoverPoint.value));
          return <g key={lane.id}>
            <text x={LEFT} y={top - 6} className="chart-label">{lane.label || lane.id} · {scale.unit || 'unit unavailable'} · 0–{number(scale.max)}</text>
            <line x1={LEFT} x2={LEFT + WIDTH} y1={top + LANE_H} y2={top + LANE_H} className="chart-grid" />
            <path d={area} className="chart-fill" />
            {missing.map(point => <rect key={point.time} x={Math.max(LEFT, x(Date.parse(point.time)) - 4)} y={top} width={8} height={LANE_H} fill={`url(#${id}-gap)`} />)}
            <path d={path} className={laneIndex % 2 ? 'chart-secondary' : 'chart-line'} />
            {hoverPoint && !hoverMissing && <circle cx={x(Date.parse(hoverPoint.time))} cy={y(hoverPoint.value as number)} r="3.5" className={`chart-dot${laneIndex % 2 ? ' secondary' : ''}`} />}
          </g>;
        })}
        {markersInWindow.map((marker, index) => <line key={index} x1={x(Date.parse(marker.time))} x2={x(Date.parse(marker.time))} y1={16} y2={viewH - 26} className="chart-event"><title>{marker.label} · {timestamp(marker.time)}</title></line>)}
        {hoverTime != null && <line x1={x(hoverTime)} x2={x(hoverTime)} y1={16} y2={viewH - 26} className="chart-hover-line" />}
        {[0, 1, 2, 3].map(i => <text key={i} x={LEFT + i * WIDTH / 3} y={viewH - 8} textAnchor={i === 3 ? 'end' : 'start'} className="chart-label">{clock(new Date(start + duration * i / 3).toISOString())}</text>)}
      </svg>
      {hoverTime != null && <div className="chart-tip" role="status" style={{ left: `${x(hoverTime) / VIEW_W * 100}%`, top: '8px', transform: `translate(${x(hoverTime) < 150 ? '0' : x(hoverTime) > VIEW_W - 150 ? '-100%' : '-50%'}, 0)` }}>
        <span className="muted">{hoverLabel} UTC</span>
        {lanes.map((lane, laneIndex) => {
          const points = lane.points;
          const scale = scales[laneIndex]!;
          const point = points.reduce<LanePoint | undefined>((best, p) => Math.abs(Date.parse(p.time) - hoverTime) < Math.abs(Date.parse(best?.time ?? p.time) - hoverTime) ? p : best, undefined);
          const missing = point == null || point.value == null || !Number.isFinite(point.value);
          return <span key={lane.id} className="muted">{lane.label || lane.id}: {missing ? <strong>Missing sample</strong> : <strong className="mono">{number((point.value as number) * scale.factor)} {scale.unit}</strong>}</span>;
        })}
        {hoverMarkers.map((marker, index) => <span key={index} className="muted">{marker.label}</span>)}
      </div>}
    </div>
    <div className="chart-mobile-axis mono" aria-hidden="true"><span>{clock(new Date(start).toISOString())} UTC</span><span>{clock(new Date(end).toISOString())} UTC</span></div>
    <div className="chart-note"><span>UTC · one shared cursor across lanes · gaps break the measured path{onSelect ? ' · click or press Enter to select an interval' : ''}</span><span>{markersInWindow.length} markers in window</span></div>
    {lanes.map(lane => {
      const scale = scales[lanes.indexOf(lane)]!;
      const points = [...lane.points].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
      return <details key={lane.id} className="data-summary"><summary>View {lane.label || lane.id} values</summary>
        <table className="table responsive"><caption>{scale.unit || 'Unit unavailable'} · source coverage qualifies these observations.</caption><thead><tr><th>Time (UTC)</th><th>Value</th><th>Evidence</th></tr></thead>
          <tbody>{points.map((p, i) => <tr key={`${p.time}-${i}`}><td data-label="Time" className="mono">{timestamp(p.time)}</td><td data-label="Value" className="mono">{number(p.value == null ? null : p.value * scale.factor)}</td><td data-label="Evidence">{p.value == null ? 'Missing sample' : 'Recorded sample'}</td></tr>)}</tbody></table>
      </details>;
    })}
  </section>;
}
