import { NextResponse } from 'next/server';

const POKEMONTCG_API = 'https://api.pokemontcg.io/v2/cards';
const SCRYDEX_API = 'https://api.scrydex.com/pokemon/v1/cards';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cardId = searchParams.get('cardId');

  if (!cardId) {
    return NextResponse.json({ error: 'cardId is required' }, { status: 400 });
  }

  let price: number | null = null;
  let source: string | null = null;
  let rarity: string | null = null;

  // ── Step 1: Try pokemontcg.io (has prices for older/mainstream sets) ──────────
  try {
    const res = await fetch(`${POKEMONTCG_API}/${cardId}`, {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 3600 } // cache 1 hour
    });
    if (res.ok) {
      const data = await res.json();
      const card = data?.data;
      rarity = card?.rarity || null;
      const tcgplayer = card?.tcgplayer;
      const cardmarket = card?.cardmarket;

      // Scan ALL tcgplayer price variants
      if (tcgplayer?.prices && typeof tcgplayer.prices === 'object') {
        for (const variant of Object.values(tcgplayer.prices) as any[]) {
          const p = variant?.market ?? variant?.mid ?? variant?.low ?? null;
          if (p && p > 0) { price = p; source = 'tcgplayer'; break; }
        }
      }

      // Fall back to Cardmarket
      if (!price && cardmarket?.prices) {
        const p = cardmarket.prices.averageSellPrice
          ?? cardmarket.prices.trendPrice
          ?? cardmarket.prices.avg7
          ?? null;
        if (p && p > 0) { price = p; source = 'cardmarket'; }
      }
    }
  } catch (err) {
    console.warn('pokemontcg.io fetch failed:', err);
  }

  // ── Step 2: Try Scrydex (has prices for newer/Japanese sets) ─────────────────
  if (!price) {
    try {
      const res = await fetch(`${SCRYDEX_API}/${cardId}?include=prices`, {
        headers: {
          'Accept': 'application/json',
          'Origin': 'https://scrydex.com',
          'Referer': 'https://scrydex.com/',
        },
        next: { revalidate: 3600 }
      });
      if (res.ok) {
        const data = await res.json();
        const card = data?.data;
        if (!rarity && card?.rarity) rarity = card.rarity;

        // Structure: data.variants[] → each variant has prices[] with condition & market
        const variants: any[] = card?.variants || [];
        outer: for (const variant of variants) {
          const prices: any[] = variant?.prices || [];
          // Prefer NM condition first, then any condition
          const nm = prices.find((p: any) => p.condition === 'NM' && p.market > 0);
          const any = prices.find((p: any) => p.market > 0);
          const hit = nm || any;
          if (hit?.market > 0) {
            price = hit.market;
            source = 'scrydex';
            break outer;
          }
        }
      }
    } catch (err) {
      console.warn('scrydex fetch failed:', err);
    }
  }

  // ── Step 3: Rarity-based fallback if no API data at all ──────────────────────
  if (!price && rarity !== null) {
    const r = (rarity || '').toLowerCase();
    if (r.includes('secret') || r.includes('rainbow') || r.includes('special illustration')) price = 30.00;
    else if (r.includes('illustration rare')) price = 8.00;
    else if (r.includes('ultra rare') || r.includes('vstar') || r.includes('alt art')) price = 12.00;
    else if (r.includes('rare holo ex') || r.includes('rare holo gx') || r.includes('rare holo v')) price = 5.00;
    else if (r.includes('rare holo')) price = 2.00;
    else if (r.includes('rare')) price = 1.00;
    else if (r.includes('uncommon')) price = 0.50;
    else price = 0.25;
    source = 'rarity_estimate';
  }

  return NextResponse.json({ price, source, rarity, cardId });
}
