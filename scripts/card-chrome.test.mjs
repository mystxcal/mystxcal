import assert from 'node:assert/strict';
import test from 'node:test';

import { chromeBackground, chromeDefs } from './card-chrome.mjs';
import { renderCard, summarise } from './render-languages.mjs';
import { renderSnapshot } from './render-token-graph.mjs';

const tokenCard = renderSnapshot({
  asOfDate: '2026-07-30',
  daily: [
    { date: '2026-07-01', total: 10 },
    { date: '2026-07-30', total: 30 }
  ]
});

const languageCard = renderCard(
  summarise([
    {
      name: 'a',
      languages: {
        edges: [
          { size: 700, node: { name: 'Rust', color: '#dea584' } },
          { size: 300, node: { name: 'Go', color: '#00ADD8' } }
        ]
      }
    }
  ]),
  '2026-07-30'
);

const cards = { 'token use': tokenCard, 'code mix': languageCard };

// The bug this file exists for: the code mix card was hand-built with a flat
// square background, its own grain and no atmosphere, so it sat under the token
// graph looking like a duller cousin. Both cards must draw the same ground.
for (const [name, card] of Object.entries(cards)) {
  test(`${name} draws the shared ground`, () => {
    assert.ok(card.includes(chromeBackground()));
    assert.ok(card.includes(chromeDefs()));
  });

  test(`${name} is cut to the rounded card clip`, () => {
    assert.match(card, /<clipPath id="card">\s*<rect width="1200" height="360" rx="20"\/>/);
    assert.match(card, /<g clip-path="url\(#card\)">/);
  });

  test(`${name} shares the header furniture`, () => {
    assert.match(card, /<rect x="64" y="37" width="24" height="2" rx="1" fill="#9bffdc"\/>/);
    assert.match(card, /<text x="100" y="43" fill="#9bffdc" [^>]*letter-spacing="3\.2">PERSONAL INSTRUMENT \//);
    assert.match(card, /<text x="1136" y="43" [^>]*>UPDATED 2026-07-30<\/text>/);
    assert.match(card, /<text x="252" y="93"/);
  });
}

test('the wordmark gradient is scoped to the accent word, not the whole card', () => {
  for (const [name, card] of Object.entries(cards)) {
    const [, x1, x2] = card.match(/id="wordmark"[^>]*x1="(\d+)"[^>]*x2="(\d+)"/) ?? [];
    assert.ok(x1 && x2, `${name} has no wordmark gradient`);
    assert.ok(Number(x2) - Number(x1) < 120, `${name} ramps its wordmark across too wide a span`);
  }
});
