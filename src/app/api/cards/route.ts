import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { fetchAllUserCards } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const set = searchParams.get('set');
  const rarity = searchParams.get('rarity');
  const query = searchParams.get('q');
  const ids = searchParams.get('ids');
  const owner = searchParams.get('owner');

  const filePath = path.join(process.cwd(), 'public', 'data', 'pokemon_cards.json');
  
  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    let cards = JSON.parse(fileContents);

    // Filter
    if (owner) {
      try {
        const userCards = await fetchAllUserCards(owner);
        const ownedIds = new Set(userCards.map((c: any) => c.card_id));
        cards = cards.filter((c: any) => ownedIds.has(c.id));
      } catch (err) {
        console.error('Failed to filter cards by owner:', err);
      }
    }
    if (ids) {
      const idList = ids.split(',');
      cards = cards.filter((c: any) => idList.includes(c.id));
    }
    if (set) {
      cards = cards.filter((c: any) => c.setId === set);
    }
    if (rarity) {
      cards = cards.filter((c: any) => c.rarity === rarity);
    }
    if (query) {
      const lowerQ = query.toLowerCase();
      cards = cards.filter((c: any) => c.name.toLowerCase().includes(lowerQ));
    }

    // Paginate
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedCards = ids ? cards : cards.slice(startIndex, endIndex);

    return NextResponse.json({
      cards: paginatedCards,
      total: cards.length,
      page,
      limit,
      totalPages: Math.ceil(cards.length / limit)
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load cards' }, { status: 500 });
  }
}
