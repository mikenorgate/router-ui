import fs from 'fs';

function hexToRgb(hex) {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;
    
    // Linearize
    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

    return [r, g, b];
}

function rgbToOklch(r, g, b) {
    const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

    const l_ = Math.cbrt(l);
    const m_ = Math.cbrt(m);
    const s_ = Math.cbrt(s);

    const L = 0.2104542553*l_ + 0.7936177850*m_ - 0.0040720468*s_;
    const a = 1.9779984951*l_ - 2.4285922050*m_ + 0.4505937099*s_;
    const b_ = 0.0259040371*l_ + 0.7827717662*m_ - 0.8086757660*s_;

    const C = Math.sqrt(a * a + b_ * b_);
    let h = Math.atan2(b_, a) * 180 / Math.PI;
    if (h < 0) h += 360;

    return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${h.toFixed(1)})`;
}

const hexes = {
  bg: '#F5F2EA',
  surface: '#FFFFFF',
  surfaceRaised: '#F5F2EA',
  fg: '#162D2B',
  muted: '#495B56',
  border: '#B0BBB5',
  controlBorder: '#687D76',
  accent: '#08685F',
  accentSoft: '#B5DED1',
  onAccent: '#FFFFFF', // was #F5F2EA, use white for better contrast
  success: '#236247',
  successSoft: '#DDE5DF',
  warn: '#86531D',
  warnSoft: '#F5EBDD',
  danger: '#A43738',
  dangerSoft: '#F2DEDE',
  unknown: '#495B56',
  unknownSoft: '#DDE5DF',
  chartPrimary: '#08685F',
  chartSecondary: '#495B56',
  chartFill: '#DDE5DF',

  // Dark
  darkBg: '#162D2B',
  darkSurface: '#1E3B36',
  darkSurfaceRaised: '#2E504A', // Need a raised surface, derived from ink
  darkFg: '#F5F2EA',
  darkMuted: '#BDD0C8',
  darkBorder: '#4C7066',
  darkControlBorder: '#71998C',
  darkAccent: '#B5DED1',
  darkAccentSoft: '#1E3B36',
  darkOnAccent: '#162D2B',
  darkSuccess: '#9CD9B9',
  darkSuccessSoft: '#236247',
  darkWarn: '#F0C685',
  darkWarnSoft: '#86531D',
  darkDanger: '#F0B4B3',
  darkDangerSoft: '#A43738',
  darkUnknown: '#BDD0C8',
  darkUnknownSoft: '#495B56',
  darkChartPrimary: '#B5DED1',
  darkChartSecondary: '#BDD0C8',
  darkChartFill: '#4C7066'
};

for (const [k, v] of Object.entries(hexes)) {
    const rgb = hexToRgb(v);
    console.log(`${k}: ${rgbToOklch(...rgb)} /* ${v} */`);
}
