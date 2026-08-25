import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import {
  BRIGHT,
  DISPLAY,
  FRAME,
  HEIGHT,
  INK,
  LEFT,
  MONO,
  MUTED,
  RIGHT,
  WIDTH,
  chromeBackground,
  chromeDefs,
  chromeHeader,
  escapeXml,
  wordmarkDef
} from './card-chrome.mjs';

const execFileAsync = promisify(execFile);

const TOP_N = 9;
const CACHE_REVISION = 2;
const BLOCK_START = '<!-- languages:start -->';
const BLOCK_END = '<!-- languages:end -->';

function trimFixed(value, digits) {
  return value.toFixed(digits).replace(/\.0+$|(\.\d*[1-9])0+$/, '$1');
}

export function formatBytes(value) {
  const units = [
    [1e9, 'GB'],
    [1e6, 'MB'],
    [1e3, 'KB']
  ];
  for (const [size, suffix] of units) {
    if (value >= size) {
      const scaled = value / size;
      return `${trimFixed(scaled, scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2)} ${suffix}`;
    }
  }
  return `${Math.round(value)} B`;
}

// Collapse per-repository language edges into one ranked table. Anything past
// TOP_N becomes a single "Other" slice so the proportions still sum to 100%.
export function summarise(repositories, topN = TOP_N) {
  const totals = new Map();
  for (const repo of repositories ?? []) {
    for (const edge of repo?.languages?.edges ?? []) {
      const name = edge?.node?.name;
      const size = Number(edge?.size ?? 0);
      if (!name || !Number.isFinite(size) || size <= 0) continue;
      const previous = totals.get(name);
      if (previous) previous.bytes += size;
      else totals.set(name, { name, bytes: size, color: edge.node.color || '#8b9cb3' });
    }
  }

  const ranked = [...totals.values()].sort((a, b) => b.bytes - a.bytes);
  const total = ranked.reduce((sum, entry) => sum + entry.bytes, 0);
  if (total === 0) throw new Error('No language bytes found across repositories');

  const head = ranked.slice(0, topN);
  const tail = ranked.slice(topN);
  if (tail.length) {
    head.push({
      name: 'Other',
      bytes: tail.reduce((sum, entry) => sum + entry.bytes, 0),
      color: '#3d4f5c'
    });
  }
  return {
    total,
    distinctCount: ranked.length,
    languages: head.map((entry) => ({ ...entry, share: entry.bytes / total }))
  };
}

export function renderCard(summary, asOfDate) {
  const span = RIGHT - LEFT;
  const bar = { y: 148, height: 22 };

  // Proportional bar. Tiny slices still get a visible sliver, and the rounded
  // ends come from a clip so segments stay exactly proportional.
  const MIN = 3;
  const raw = summary.languages.map((l) => l.share * span);
  const lifted = raw.map((w) => Math.max(w, MIN));
  const overflow = lifted.reduce((a, b) => a + b, 0) - span;
  const slack = lifted.reduce((sum, w, i) => sum + (raw[i] > MIN ? w - MIN : 0), 0);
  let cursor = LEFT;
  const placed = summary.languages.map((lang, index) => {
    let w = lifted[index];
    if (overflow > 0 && slack > 0 && raw[index] > MIN) {
      w -= overflow * ((w - MIN) / slack);
    }
    const x = cursor;
    cursor += w;
    return { lang, x, width: Math.max(w, 0.6) };
  });
  const segments = placed.map(
    ({ lang, x, width }) =>
      `<rect x="${x.toFixed(2)}" y="${bar.y}" width="${width.toFixed(2)}" height="${bar.height}" fill="${lang.color}"/>`
  );

  // Hairline gaps make the wide slices read as separate measures rather than one
  // gradient. Skipped in the tail, where a 1px rule would eat a third of a slice.
  const SEPARABLE = 8;
  const separators = placed
    .slice(1)
    .filter((seg, i) => seg.width >= SEPARABLE && placed[i].width >= SEPARABLE)
    .map(
      (seg) =>
        `<rect x="${(seg.x - 0.5).toFixed(2)}" y="${bar.y}" width="1" height="${bar.height}" fill="${INK}" fill-opacity=".5"/>`
    );

  // A quarter scale under the bar, in the same idiom as the token graph's axis.
  // It is what turns the bar from a decoration into something you can read a
  // number off: you can see where Rust stops against the halfway mark.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => {
    const x = LEFT + fraction * span;
    const anchor = fraction === 0 ? 'start' : fraction === 1 ? 'end' : 'middle';
    const label = fraction === 1 ? '100%' : `${fraction * 100}`;
    return `<path d="M${x.toFixed(2)} ${bar.y + bar.height + 2}v6" stroke="${FRAME}" stroke-width="1"/><text x="${x.toFixed(2)}" y="189" text-anchor="${anchor}">${label}</text>`;
  });

  // Legend: five columns, two rows. Name, share, then absolute size.
  // Justify the columns edge to edge. Pitching at span/columns leaves the last
  // cell's unused tail inside the block, which makes the legend read as
  // left-shifted against the full-width bar above it.
  const columns = 5;
  const cellWidth = 104;
  const pitch = (span - cellWidth) / (columns - 1);
  const legend = summary.languages.slice(0, columns * 2).map((lang, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = LEFT + col * pitch;
    const y = 224 + row * 72;
    const pct = lang.share * 100;
    const pctLabel = pct >= 10 ? `${pct.toFixed(1)}%` : `${pct.toFixed(2)}%`;
    return `  <g>
    <rect x="${x.toFixed(1)}" y="${y - 10}" width="10" height="10" rx="2.5" fill="${lang.color}"/>
    <text x="${(x + 18).toFixed(1)}" y="${y}" fill="${BRIGHT}" font-family="${MONO}" font-size="12.5" letter-spacing="0.4">${escapeXml(lang.name)}</text>
    <text x="${x.toFixed(1)}" y="${y + 29}" fill="${lang.color}" font-family="${DISPLAY}" font-size="26" font-weight="700" letter-spacing="-0.8">${pctLabel}</text>
    <text x="${x.toFixed(1)}" y="${y + 46}" fill="${MUTED}" font-family="${MONO}" font-size="10" letter-spacing="1.4">${escapeXml(formatBytes(lang.bytes).toUpperCase())}</text>
  </g>`;
  });

  const totalLabel = formatBytes(summary.total).toUpperCase();
  const languageCount = summary.distinctCount ?? summary.languages.length;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="title description">
  <title id="title">Language mix across all repositories</title>
  <desc id="description">${escapeXml(
    summary.languages
      .slice(0, 5)
      .map((l) => `${l.name} ${trimFixed(l.share * 100, 1)}%`)
      .join(', ')
  )}, totalling ${escapeXml(totalLabel)} of source.</desc>
  <defs>
    <linearGradient id="barSheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".13"/>
      <stop offset=".45" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity=".14"/>
    </linearGradient>
    <filter id="barGlow" x="-4%" y="-300%" width="108%" height="700%">
      <feGaussianBlur stdDeviation="6"/>
    </filter>
${wordmarkDef([141, 70, 221, 100])}
${chromeDefs()}
    <clipPath id="barClip"><rect x="${LEFT}" y="${bar.y}" width="${span}" height="${bar.height}" rx="${bar.height / 2}"/></clipPath>
  </defs>

${chromeBackground()}

${chromeHeader({
    eyebrow: 'PERSONAL INSTRUMENT / LANGUAGES',
    word: 'code',
    accent: 'mix',
    subtitle: 'BY BYTES / ALL REPOSITORIES',
    readout: totalLabel,
    note: `${languageCount} LANGUAGES`,
    asOfDate
  })}

  <g filter="url(#barGlow)" opacity=".2">
${segments.map((segment) => `    ${segment}`).join('\n')}
  </g>
  <g clip-path="url(#barClip)">
${segments.map((segment) => `    ${segment}`).join('\n')}
${separators.map((separator) => `    ${separator}`).join('\n')}
    <rect x="${LEFT}" y="${bar.y}" width="${span}" height="${bar.height}" fill="url(#barSheen)"/>
  </g>
  <rect x="${LEFT}" y="${bar.y}" width="${span}" height="${bar.height}" rx="${bar.height / 2}" fill="none" stroke="${FRAME}" stroke-opacity=".8"/>

  <g fill="${MUTED}" font-family="${MONO}" font-size="10" letter-spacing="1.2">
    ${ticks.join('')}
  </g>

${legend.join('\n')}
</svg>
`;
}

export function renderBlock(asOfDate) {
  return `${BLOCK_START}
<p align="center">
  <img src="https://raw.githubusercontent.com/mystxcal/mystxcal/main/assets/languages.svg?v=${asOfDate}-${CACHE_REVISION}" alt="Language mix across all repositories" width="100%">
</p>
${BLOCK_END}`;
}

// Only the marked region is regenerated; the rest of the README is hand-written.
export function renderReadme(asOfDate, existing = '') {
  const block = renderBlock(asOfDate);
  const start = existing.indexOf(BLOCK_START);
  const end = existing.indexOf(BLOCK_END);
  if (start === -1 || end === -1 || end < start) return null;
  return existing.slice(0, start) + block + existing.slice(end + BLOCK_END.length);
}

const QUERY = `
query($cursor: String) {
  viewer {
    repositories(first: 100, after: $cursor, ownerAffiliations: OWNER, isFork: false) {
      pageInfo { hasNextPage endCursor }
      nodes {
        name
        languages(first: 25, orderBy: {field: SIZE, direction: DESC}) {
          edges { size node { name color } }
        }
      }
    }
  }
}`;

async function resolveToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  const { stdout } = await execFileAsync('gh', ['auth', 'token']);
  return stdout.trim();
}

async function loadRepositories() {
  if (process.env.LANGUAGES_FILE) {
    return JSON.parse(await readFile(resolve(process.env.LANGUAGES_FILE), 'utf8'));
  }
  const token = await resolveToken();
  if (!token) throw new Error('GITHUB_TOKEN is required, or `gh auth login`');

  const repositories = [];
  let cursor = null;
  for (;;) {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ query: QUERY, variables: { cursor } }),
      signal: AbortSignal.timeout(30_000)
    });
    if (!response.ok) throw new Error(`GitHub GraphQL request failed with HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.errors?.length) throw new Error(payload.errors[0].message);
    const page = payload.data.viewer.repositories;
    repositories.push(...page.nodes);
    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.endCursor;
  }
  return repositories;
}

export async function main() {
  const repositories = await loadRepositories();
  const summary = summarise(repositories);
  const asOfDate = new Date().toISOString().slice(0, 10);

  const output = resolve(process.env.LANGUAGES_OUTPUT || 'assets/languages.svg');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, renderCard(summary, asOfDate), 'utf8');

  const readmeOutput = resolve(process.env.README_OUTPUT || 'README.md');
  const existing = await readFile(readmeOutput, 'utf8').catch(() => '');
  const next = renderReadme(asOfDate, existing);
  if (next === null) {
    process.stdout.write(`rendered ${output} (README has no ${BLOCK_START} marker; left untouched)\n`);
    return;
  }
  await writeFile(readmeOutput, next, 'utf8');
  process.stdout.write(`rendered ${output} across ${repositories.length} repositories\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
