import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '@/lib/supabase';

// Local utility to get card score from store logic
const RARITY_SCORES: Record<string, number> = {
  'Common': 1,
  'Uncommon': 2,
  'Rare': 5,
  'Rare Holo': 10,
  'Rare Ultra': 25,
  'Rare Secret': 50,
  'Illustration Rare': 75,
  'Special Illustration Rare': 100,
  'Double Rare': 20,
  'Hyper Rare': 100,
};

const getCardScore = (rarity: string | null | undefined) => {
  if (!rarity) return 1;
  return RARITY_SCORES[rarity] || 5;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // 1. Fetch user data (specifically packs_opened)
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('packs_opened')
      .eq('id', userId)
      .maybeSingle();

    if (userError) {
      console.error('Database query user error:', userError);
      return NextResponse.json({ error: 'Database query error' }, { status: 500 });
    }

    // 2. Fetch all cards owned by the user
    const { data: userCards, error: cardsError } = await supabaseAdmin
      .from('user_cards')
      .select('card_id')
      .eq('user_id', userId);

    if (cardsError) {
      console.error('Database query cards error:', cardsError);
      return NextResponse.json({ error: 'Database query error' }, { status: 500 });
    }

    // 3. Load card database to map card IDs to their rarities
    const cardsFilePath = path.join(process.cwd(), 'public', 'data', 'pokemon_cards.json');
    const fileContents = fs.readFileSync(cardsFilePath, 'utf8');
    const allCards = JSON.parse(fileContents);
    const cardRarities = new Map<string, string | null>(allCards.map((c: any) => [c.id, c.rarity]));

    // 4. Calculate quantities, uniques, and collection score
    const ownedCards: Record<string, number> = {};
    let collectionScore = 0;
    let uniqueCards = 0;

    userCards.forEach((row: any) => {
      const cardId = row.card_id;
      if (!ownedCards[cardId]) {
        ownedCards[cardId] = 1;
        uniqueCards += 1;
        
        // Add score for first copy
        const rarity = cardRarities.get(cardId);
        collectionScore += getCardScore(rarity);
      } else {
        ownedCards[cardId] += 1;
      }
    });

    return NextResponse.json({
      ownedCards,
      uniqueCards,
      collectionScore,
      packsOpened: user?.packs_opened || 0
    });
  } catch (error) {
    console.error('Collection query error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
