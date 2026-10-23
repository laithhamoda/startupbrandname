// The logo mark rebuilt as clean vector geometry from the owner's raster (traced, then regularised).
// Coordinates are in the units of the traced crop; the mark spans x 19.2 to 162 and y 17.5 to 146.5.

export const COLORS = {
  teal: '#1FA3C7', // brand teal: the top faces
  tealDeep: '#1B89A9', // the side faces, the one extra shade the owner's logo uses
  gold: '#D4A537', // brand gold: the square and, on dark, the arrowhead's top face
};

const P = {
  // upper piece: the frame that turns into the arrow
  T: [69.0, 17.5],
  GR: [115.3, 43.6],
  GB: [96.8, 60.0],
  HT: [69.0, 44.8],
  HL: [46.5, 57.9],
  HB: [85.0, 79.0],
  SN: [129.8, 39.2],
  BN: [121.0, 29.5],
  AT: [162.0, 23.6],
  AB: [156.2, 63.6],
  AN: [145.3, 55.2],
  S1: [107.5, 91.0],
  S2: [94.7, 100.0],
  BV: [79.0, 108.2],
  LB: [19.2, 76.6],
  LT: [19.2, 45.6],
  R2: [34.0, 67.8],
  R1: [84.6, 95.3],
  R4: [136.7, 47.1],
  // lower piece: the chevron under the arrow
  C1: [119.7, 89.4],
  C3: [119.7, 118.7],
  C4: [69.8, 146.5],
  C5: [19.2, 118.8],
  C6: [42.8, 105.3],
  V: [69.8, 119.8],
  E1: [100.8, 102.9],
  AP: [97.7, 106.8],
};

export const BBOX = { x0: 19.2, y0: 17.5, x1: 162.0, y1: 146.5 };
export const BOX_W = BBOX.x1 - BBOX.x0;
export const BOX_H = BBOX.y1 - BBOX.y0;
export const CENTER = [(BBOX.x0 + BBOX.x1) / 2, (BBOX.y0 + BBOX.y1) / 2];

const pts = (...names) => names.map((n) => P[n]);

function area(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    s += x0 * y1 - x1 * y0;
  }
  return s / 2;
}

function intersect(p, d, q, e) {
  const det = d[0] * e[1] - d[1] * e[0];
  if (Math.abs(det) < 1e-9) return null;
  const t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / det;
  return [p[0] + d[0] * t, p[1] + d[1] * t];
}

/** Moves each edge outward by its own distance (0 keeps it exact) and re-joins the corners. */
export function offset(poly, distances) {
  const sign = area(poly) > 0 ? 1 : -1;
  const n = poly.length;
  const lines = poly.map((a, i) => {
    const b = poly[(i + 1) % n];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    const nx = (sign * dy) / len;
    const ny = (-sign * dx) / len;
    const d = distances[i] ?? 0;
    return { p: [a[0] + nx * d, a[1] + ny * d], d: [dx, dy] };
  });
  return poly.map((_, i) => {
    const prev = lines[(i - 1 + n) % n];
    const next = lines[i];
    return intersect(prev.p, prev.d, next.p, next.d) ?? poly[i];
  });
}

const OUT = 3; // how far past an outer edge a face is drawn, so the silhouette clip alone shapes it

const SILHOUETTE_UPPER = pts(
  'T',
  'GR',
  'GB',
  'HT',
  'HL',
  'HB',
  'SN',
  'BN',
  'AT',
  'AB',
  'AN',
  'S1',
  'S2',
  'BV',
  'LB',
  'LT',
);
const SILHOUETTE_LOWER = pts('C1', 'C3', 'C4', 'C5', 'C6', 'V', 'E1');

// Top faces. Edges are listed in order; 0 marks a seam inside the mark, OUT an edge on the outline.
const TOP_UPPER = offset(pts('T', 'LT', 'R2', 'R1', 'AT', 'BN', 'SN', 'HB', 'HL', 'HT'), [
  OUT,
  0,
  0,
  0,
  OUT,
  OUT,
  OUT,
  OUT,
  OUT,
  0,
]);
const TOP_LEFT = offset(pts('C6', 'V', 'C4', 'C5'), [OUT, 0, OUT, OUT]);
const TOP_END = offset(pts('AP', 'E1', 'C1', 'C3'), [0, OUT, OUT, 0]);
// The gold square slides half a unit under its neighbour so no hairline can open at their seam.
const GOLD = offset([[68.5, P.T[1]], P.GR, P.GB, [68.5, P.HT[1]]], [OUT, OUT, OUT, 0]);
// On a dark ground the top face of the arrowhead turns gold, as in the owner's dark version.
const BARB = offset(pts('BN', 'AT', 'R4', 'SN'), [OUT, 0, 0, OUT]);

const shift = (poly, dy) => poly.map(([x, y]) => [x, y + dy]);
const num = (v) => Math.round(v * 100) / 100;
const path = (poly) => `M${poly.map(([x, y]) => `${num(x)} ${num(y)}`).join('L')}Z`;

/** The mark as SVG elements in source units, to be placed inside any <svg> or <g>. */
export function markBody({
  id = 'm',
  barb = 'teal',
  colors = COLORS,
  mono = null,
  lowerShift = 0,
} = {}) {
  const lowerSil = shift(SILHOUETTE_LOWER, lowerShift);
  const tops = `${path(TOP_UPPER)}${path(shift(TOP_LEFT, lowerShift))}${path(shift(TOP_END, lowerShift))}`;
  const clip = `<clipPath id="${id}"><path d="${path(SILHOUETTE_UPPER)}${path(lowerSil)}"/></clipPath>`;
  const [x0, y0, x1, y1] = [BBOX.x0 - 6, BBOX.y0 - 6, BBOX.x1 + 6, BBOX.y1 + 6];
  if (mono) {
    return `${clip}<g clip-path="url(#${id})" fill="${mono}"><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill-opacity=".62"/><path d="${tops}"/><path d="${path(GOLD)}" fill-opacity=".38"/></g>`;
  }
  const adaptive = barb === 'adaptive';
  const barbShape =
    barb === 'gold'
      ? `<path d="${path(BARB)}" fill="${colors.gold}"/>`
      : adaptive
        ? `<style>.b${id}{fill:${colors.teal}}@media (prefers-color-scheme:dark){.b${id}{fill:${colors.gold}}}</style><path class="b${id}" d="${path(BARB)}"/>`
        : '';
  return `${clip}<g clip-path="url(#${id})"><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="${colors.tealDeep}"/><path d="${tops}" fill="${colors.teal}"/><path d="${path(GOLD)}" fill="${colors.gold}"/>${barbShape}</g>`;
}

/** A standalone SVG of the mark with a little clear space around it. */
export function markSvg(options = {}) {
  const pad = options.pad ?? 3;
  const vb = [BBOX.x0 - pad, BBOX.y0 - pad, BOX_W + 2 * pad, BOX_H + 2 * pad].map(num).join(' ');
  const label = options.title ? `<title>${options.title}</title>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${options.title ? ' role="img"' : ' aria-hidden="true"'}>${label}${markBody(options)}</svg>`;
}

/** The mark centred on an N by N canvas, `width` units of N wide, over an optional plate colour. */
export function iconSvg(size, widthShare, { plate = null, ...options } = {}) {
  const s = (widthShare * size) / BOX_W;
  const tx = size / 2 - CENTER[0] * s;
  const ty = size / 2 - (CENTER[1] + (options.lowerShift ?? 0) / 2) * s;
  const bg = plate ? `<rect width="${size}" height="${size}" fill="${plate}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg}<g transform="translate(${num(tx)} ${num(ty)}) scale(${num(s)})">${markBody(options)}</g></svg>`;
}
