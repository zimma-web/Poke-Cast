import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '@/lib/supabase';
import { evaluateAchievements } from '@/lib/achievements';

function getRarityWeight(rarity: string): number {
  const r = rarity.toLowerCase();
  
  if (r.includes('secret') || r.includes('hyper') || r.includes('rainbow') || r.includes('special illustration') || r.includes('gold')) {
    return 2; // Super rare / secret
  }
  if (r.includes('illustration') || r.includes('shining') || r.includes('shiny ultra') || r.includes('radiant')) {
    return 8; // Art rare / special cards
  }
  if (r.includes('ultra') || r.includes('double') || r.includes('vmax') || r.includes('vstar') || r.includes('ex') || r.includes('gx') || r.includes('v') || r.includes('break') || r.includes('prism')) {
    return 25; // Ultra rares / double rares
  }
  if (r.includes('holo') || r.includes('shiny') || r.includes('promo')) {
    return 65; // Holo rares
  }
  return 100; // Standard Rare
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const setId = searchParams.get('set');
  const userId = searchParams.get('userId');

  if (!setId) {
    return NextResponse.json({ error: 'Set ID is required' }, { status: 400 });
  }

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  // 1. Fetch user data first to validate economy
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('packs_opened, pack_tickets, free_packs_remaining, last_daily_reset')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Daily reset check
  const now = new Date();
  let lastReset = user.last_daily_reset ? new Date(user.last_daily_reset) : null;
  let currentTickets = user.pack_tickets !== null && user.pack_tickets !== undefined ? user.pack_tickets : 10;
  let currentFreePacks = user.free_packs_remaining !== null && user.free_packs_remaining !== undefined ? user.free_packs_remaining : 2;
  let resetApplied = false;

  const timeSinceReset = lastReset ? now.getTime() - lastReset.getTime() : null;
  const isDueForReset = lastReset === null || (timeSinceReset !== null && timeSinceReset >= 24 * 60 * 60 * 1000);

  if (isDueForReset) {
    currentFreePacks = 2;
    currentTickets = (currentTickets || 0) + 2;
    lastReset = now;
    resetApplied = true;
  }

  // Future-ready pack cost configuration
  interface PackCost {
    cost: number;
    currency: 'free_or_ticket' | 'ticket' | 'event_ticket';
  }

  const PACK_COSTS: Record<string, PackCost> = {
    // Define set-specific costs if they differ from the default in the future.
  };

  const getPackCost = (id: string): PackCost => {
    return PACK_COSTS[id] || { cost: 1, currency: 'free_or_ticket' };
  };

  const packCost = getPackCost(setId);

  // Validate and deduct currency
  if (packCost.currency === 'free_or_ticket') {
    if (currentFreePacks > 0) {
      currentFreePacks -= 1;
    } else if (currentTickets >= packCost.cost) {
      currentTickets -= packCost.cost;
    } else {
      // Not enough balance
      if (resetApplied) {
        // Persist daily reset state even if opening fails
        await supabaseAdmin
          .from('users')
          .update({
            free_packs_remaining: currentFreePacks,
            pack_tickets: currentTickets,
            last_daily_reset: lastReset ? lastReset.toISOString() : new Date().toISOString()
          })
          .eq('id', userId);
      }
      return NextResponse.json({ error: 'Not enough Pack Tickets' }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: 'Unsupported pack currency type' }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), 'public', 'data', 'pokemon_cards.json');
  
  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const cards = JSON.parse(fileContents);

    // Filter cards by selected set
    const setCards = cards.filter((c: any) => c.setId === setId);
    if (setCards.length === 0) {
      return NextResponse.json({ error: 'No cards found for this set' }, { status: 404 });
    }

    // Build pools
    const commonPool = setCards.filter((c: any) => c.rarity === 'Common' || !c.rarity);
    const uncommonPool = setCards.filter((c: any) => c.rarity === 'Uncommon');
    const rarePool = setCards.filter((c: any) => c.rarity !== 'Common' && c.rarity !== 'Uncommon' && c.rarity);

    const getRandomCard = (pool: any[], fallbackPool: any[]) => {
      const activePool = pool.length > 0 ? pool : fallbackPool;
      const randomIndex = Math.floor(Math.random() * activePool.length);
      return activePool[randomIndex];
    };

    // Pick 5 cards: 3 Commons, 1 Uncommon, 1 Rare
    const packCards = [];

    // 1. 3 Common slots
    for (let i = 0; i < 3; i++) {
      packCards.push(getRandomCard(commonPool, setCards));
    }

    // 2. 1 Uncommon slot
    packCards.push(getRandomCard(uncommonPool, setCards));

    // 3. 1 Rare slot with weighted rarity probabilities
    const activeRarePool = rarePool.length > 0 ? rarePool : setCards;
    
    // Group rare cards by their exact rarity string
    const poolsByRarity: Record<string, any[]> = {};
    activeRarePool.forEach((c: any) => {
      const rarityName = c.rarity || 'Rare';
      if (!poolsByRarity[rarityName]) {
        poolsByRarity[rarityName] = [];
      }
      poolsByRarity[rarityName].push(c);
    });

    const poolWeights = Object.keys(poolsByRarity).map(rarityName => ({
      rarityName,
      weight: getRarityWeight(rarityName)
    }));

    const totalWeight = poolWeights.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * totalWeight;
    let selectedRarity = poolWeights[0].rarityName;
    for (const item of poolWeights) {
      roll -= item.weight;
      if (roll <= 0) {
        selectedRarity = item.rarityName;
        break;
      }
    }

    const selectedPool = poolsByRarity[selectedRarity];
    const rareCard = selectedPool[Math.floor(Math.random() * selectedPool.length)];
    packCards.push(rareCard);

    // Save pulled cards to user_cards in Supabase
    const inserts = packCards.map((c: any) => ({
      user_id: userId,
      card_id: c.id,
      source_set_id: setId,
      obtained_at: new Date().toISOString()
    }));

    const { error: insertError } = await supabaseAdmin.from('user_cards').insert(inserts);
    if (insertError) {
      console.error('Failed to save pulled cards to database:', insertError);
      return NextResponse.json({ error: 'Database save error' }, { status: 500 });
    }

    // Update user stats and pack economy details
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        packs_opened: (user.packs_opened || 0) + 1,
        free_packs_remaining: currentFreePacks,
        pack_tickets: currentTickets,
        last_daily_reset: lastReset ? lastReset.toISOString() : null
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Failed to update user pack stats:', updateError);
    }

    // Evaluate achievements dynamically (may award additional tickets)
    await evaluateAchievements(userId);

    // Fetch final updated pack_tickets from database to keep frontend sync perfect
    const { data: finalUser } = await supabaseAdmin
      .from('users')
      .select('pack_tickets')
      .eq('id', userId)
      .single();

    const finalTickets = finalUser && finalUser.pack_tickets !== undefined ? finalUser.pack_tickets : currentTickets;

    return NextResponse.json({
      cards: packCards,
      packTickets: finalTickets,
      freePacksRemaining: currentFreePacks,
      lastDailyReset: lastReset ? lastReset.toISOString() : null
    });
  } catch (error) {
    console.error('Failed to generate/save pack:', error);
    return NextResponse.json({ error: 'Failed to open pack' }, { status: 500 });
  }
}
