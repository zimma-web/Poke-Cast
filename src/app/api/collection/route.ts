import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '@/lib/supabase';
import { evaluateAchievements } from '@/lib/achievements';

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

    // 1. Fetch user data
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('packs_opened, pack_tickets, free_packs_remaining, last_daily_reset')
      .eq('id', userId)
      .maybeSingle();

    if (userError) {
      console.error('Database query user error:', userError);
      return NextResponse.json({ error: 'Database query error' }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const now = new Date();
    let lastReset = user.last_daily_reset ? new Date(user.last_daily_reset) : null;
    let currentTickets = user.pack_tickets !== null && user.pack_tickets !== undefined ? user.pack_tickets : 10;
    let currentFreePacks = user.free_packs_remaining !== null && user.free_packs_remaining !== undefined ? user.free_packs_remaining : 2;
    let updatedUser = user;

    const timeSinceReset = lastReset ? now.getTime() - lastReset.getTime() : null;
    const isDueForReset = lastReset === null || (timeSinceReset !== null && timeSinceReset >= 24 * 60 * 60 * 1000);

    if (isDueForReset) {
      currentFreePacks = 2;
      currentTickets = (currentTickets || 0) + 2;
      lastReset = now;

      const { data: refreshedUser, error: updateResetError } = await supabaseAdmin
        .from('users')
        .update({
          free_packs_remaining: currentFreePacks,
          pack_tickets: currentTickets,
          last_daily_reset: lastReset.toISOString()
        })
        .eq('id', userId)
        .select('packs_opened, pack_tickets, free_packs_remaining, last_daily_reset')
        .single();

      if (!updateResetError && refreshedUser) {
        updatedUser = refreshedUser;
      }
    }

    // Evaluate achievements dynamically (may award additional tickets)
    await evaluateAchievements(userId);

    // Fetch final user record to capture any achievement ticket rewards
    const { data: finalUser } = await supabaseAdmin
      .from('users')
      .select('packs_opened, pack_tickets, free_packs_remaining, last_daily_reset')
      .eq('id', userId)
      .single();

    if (finalUser) {
      updatedUser = finalUser;
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

    // 2b. Fetch user wishlist
    const { data: wishlistData, error: wishlistError } = await supabaseAdmin
      .from('user_wishlist')
      .select('card_id')
      .eq('user_id', userId);

    if (wishlistError) {
      console.error('Database query wishlist error:', wishlistError);
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
      packsOpened: updatedUser?.packs_opened || 0,
      packTickets: updatedUser?.pack_tickets !== undefined ? updatedUser.pack_tickets : 10,
      freePacksRemaining: updatedUser?.free_packs_remaining !== undefined ? updatedUser.free_packs_remaining : 2,
      lastDailyReset: updatedUser?.last_daily_reset || null,
      wishlist: wishlistData ? wishlistData.map((row: any) => row.card_id) : []
    });
  } catch (error) {
    console.error('Collection query error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
