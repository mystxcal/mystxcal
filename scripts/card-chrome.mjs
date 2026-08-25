// Chrome shared by both profile cards.
//
// The two cards are meant to read as one instrument set, so everything that is
// not the measurement itself lives here: the palette, the ground, the frame and
// the header. Each renderer supplies its own plot and nothing else. The code mix
// card drifted once — square corners, a different grain, no atmosphere — because
// the chrome was duplicated by hand in two places. It only has to exist once.

export const WIDTH = 1200;
export const HEIGHT = 360;

export const INK = '#05080b';
export const FRAME = '#16262b';
export const GRID = '#101d21';
export const MUTED = '#5f7173';
export const BRIGHT = '#f2f7f6';
export const MINT = '#9bffdc';
export const CYAN = '#6ee7ff';
export const VIOLET = '#b5a3ff';
export const READOUT = '#c7fff0';

export const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
export const DISPLAY = "'Helvetica Neue', Helvetica, Arial, sans-serif";

// Content margins. Both cards hang their furniture off these.
export const LEFT = 62;
export const RIGHT = 1138;

export function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

// The accent half of the wordmark is filled with a gradient that runs across
// that word alone, leading in slightly before the first letter. Passing the span
// keeps it honest for words of different widths.
export function wordmarkDef([x1, y1, x2, y2]) {
  return `    <linearGradient id="wordmark" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
      <stop offset="0" stop-color="${MINT}"/>
      <stop offset="1" stop-color="${CYAN}"/>
    </linearGradient>`;
}

// Ground, atmosphere and the rounded clip every card is cut to. `sky` lifts the
// top left where the wordmark sits, `drift` blooms up from the bottom right, and
// `seam` is the lit top edge. Without them a card reads as a flat black box.
export function chromeDefs() {
  return `    <linearGradient id="seam" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${MINT}" stop-opacity="0"/>
      <stop offset=".18" stop-color="${MINT}" stop-opacity=".85"/>
      <stop offset=".52" stop-color="${CYAN}" stop-opacity=".5"/>
      <stop offset="1" stop-color="${VIOLET}" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="sky" cx=".28" cy="0" r=".85">
      <stop offset="0" stop-color="${CYAN}" stop-opacity=".12"/>
      <stop offset=".5" stop-color="${MINT}" stop-opacity=".04"/>
      <stop offset="1" stop-color="${MINT}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="drift" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="${VIOLET}" stop-opacity=".13"/>
      <stop offset="1" stop-color="${VIOLET}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grain" width="22" height="22" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r=".6" fill="#dff6f1" fill-opacity=".05"/>
    </pattern>
    <filter id="signalGlow" x="-20%" y="-40%" width="140%" height="180%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="card">
      <rect width="${WIDTH}" height="${HEIGHT}" rx="20"/>
    </clipPath>`;
}

export function chromeBackground() {
  return `  <g clip-path="url(#card)">
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${INK}"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grain)"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#sky)"/>
    <ellipse cx="1080" cy="370" rx="360" ry="160" fill="url(#drift)"/>
    <rect width="${WIDTH}" height="1.5" fill="url(#seam)"/>
  </g>
  <rect x=".5" y=".5" width="${WIDTH - 1}" height="${HEIGHT - 1}" rx="19.5" fill="none" stroke="${FRAME}"/>`;
}

// Eyebrow, dated stamp, wordmark, subtitle and the headline readout. `note` is
// the optional small line beneath the readout.
export function chromeHeader({ eyebrow, word, accent, subtitle, readout, note, asOfDate }) {
  const noteLine = note
    ? `\n  <text x="1136" y="112" text-anchor="end" fill="${MUTED}" font-family="${MONO}" font-size="10" letter-spacing="1.6">${escapeXml(note)}</text>`
    : '';
  return `  <rect x="64" y="37" width="24" height="2" rx="1" fill="${MINT}"/>
  <text x="100" y="43" fill="${MINT}" font-family="${MONO}" font-size="11" letter-spacing="3.2">${escapeXml(eyebrow)}</text>
  <text x="1136" y="43" text-anchor="end" fill="${MUTED}" font-family="${MONO}" font-size="11" letter-spacing="2">UPDATED ${escapeXml(asOfDate)}</text>

  <text x="${LEFT}" y="95" font-family="${DISPLAY}" font-size="40" font-weight="700" letter-spacing="-1.4">
    <tspan fill="${BRIGHT}">${escapeXml(word)}</tspan><tspan fill="url(#wordmark)"> ${escapeXml(accent)}</tspan>
  </text>
  <text x="252" y="93" fill="${MUTED}" font-family="${MONO}" font-size="11" letter-spacing="2.2">${escapeXml(subtitle)}</text>
  <text x="1136" y="94" text-anchor="end" fill="${READOUT}" font-family="${MONO}" font-size="17" font-weight="700" letter-spacing="1.2">${escapeXml(readout)}</text>${noteLine}`;
}
