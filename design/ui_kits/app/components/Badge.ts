export type EvidenceTone = 'plain' | 'good' | 'warn' | 'bad' | 'unknown';
export function escape(value: string): string { return value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)); }
export function Badge(label: string, tone: EvidenceTone = 'plain', id = ''): string {
 const symbol = {plain:'○',good:'✓',warn:'△',bad:'×',unknown:'?'}[tone];
 return `<span class="badge ${tone}" ${id ? `data-od-id="${escape(id)}"` : ''}><span aria-hidden="true">${symbol}</span>${escape(label)}</span>`;
}
export function Icon(name: string): string {
 const p:Record<string,string>={overview:'M3 3h6v6H3zm12 0h6v6h-6zM3 15h6v6H3zm12 0h6v6h-6z',devices:'M4 4h16v12H4zM8 20h8m-4-4v4',traffic:'M3 8h18m-5-4 5 4-5 4M21 16H3m5-4-5 4 5 4',network:'M12 3v6m0 6v6M3 12h6m6 0h6M9 9h6v6H9z',firewall:'M12 3 4 6v6c0 4 4 7 8 9 4-2 8-5 8-9V6z',events:'M5 4h14v17H5zM8 9h8M8 13h8M8 17h5',system:'M4 6h16M4 12h16M4 18h16M9 3v6m7 0v6M8 15v6'};
 return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${p[name] || p.devices}"/></svg>`;
}
