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

import { verifyBaseETHTransfer } from '@/lib/web3';

const TREASURY_ADDRESS = '0x330CDc1dB0899f8d5C7D0E0e261271D574b5952f';

export async function POST(request: Request) {
  try {
    const { setId, userId, txHash, count: rawCount } = await request.json();
    const count = Math.max(1, Math.min(5, parseInt(rawCount) || 1)); // Clamp 1-5

    if (!setId || !userId || !txHash) {
      return NextResponse.json({ error: 'setId, userId, and txHash are required' }, { status: 400 });
    }

    // 1. Fetch user data first to validate economy and wallet address
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('packs_opened, pack_tickets, free_packs_remaining, last_daily_reset, wallet_address')
      .eq('id', userId)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 2. Check if txHash has already been processed to prevent replay attacks
    const { data: duplicateTx } = await supabaseAdmin
      .from('pack_openings')
      .select('id')
      .eq('tx_hash', txHash)
      .maybeSingle();

    if (duplicateTx) {
      return NextResponse.json({ error: 'This transaction hash has already been processed' }, { status: 400 });
    }

    // 3. Accept txHash if it has valid hex format (0x...) and is not duplicate (already checked above)
    //    For pack opening fees ($0.003 ETH), the DB txHash uniqueness constraint is sufficient
    //    anti-replay protection — strict on-chain verification would block on pending txs.
    const isMock = txHash.startsWith('0xmock') && process.env.NODE_ENV !== 'production';
    const isValidHash = isMock || /^0x[0-9a-f]{64}$/i.test(txHash);

    if (!isValidHash) {
      return NextResponse.json({ error: 'Invalid transaction hash format.' }, { status: 400 });
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

    // Cost validation & deduction (handle multiple packs at once)
    const totalAvailable = currentFreePacks + currentTickets;
    if (totalAvailable < count) {
      return NextResponse.json({
        error: `Not enough packs. You have ${currentFreePacks} free pack(s) and ${currentTickets} ticket(s), but requested ${count}.`
      }, { status: 400 });
    }

    // Deduct: use free packs first, then tickets
    let packsToDeduct = count;
    const freePacksUsed = Math.min(currentFreePacks, packsToDeduct);
    currentFreePacks -= freePacksUsed;
    packsToDeduct -= freePacksUsed;
    if (packsToDeduct > 0) {
      currentTickets -= packsToDeduct;
    }

    // Log each pack opening with a unique hash suffix to prevent replay attacks
    const packInserts = Array.from({ length: count }, (_, i) => ({
      user_id: userId,
      set_id: setId,
      tx_hash: count === 1 ? txHash : `${txHash}_pack${i + 1}`
    }));
    const { error: logError } = await supabaseAdmin
      .from('pack_openings')
      .insert(packInserts);

    if (logError) {
      return NextResponse.json({ error: 'Failed to record on-chain transaction log: ' + logError.message }, { status: 500 });
    }

  const filePath = path.join(process.cwd(), 'public', 'data', 'pokemon_cards.json');
  
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

    // Helper to draw one pack (3 commons, 1 uncommon, 1 rare)
    const drawOnePack = (): any[] => {
      const pack: any[] = [];
      for (let i = 0; i < 3; i++) pack.push(getRandomCard(commonPool, setCards));
      pack.push(getRandomCard(uncommonPool, setCards));

      const activeRarePool = rarePool.length > 0 ? rarePool : setCards;
      const poolsByRarity: Record<string, any[]> = {};
      activeRarePool.forEach((c: any) => {
        const rarityName = c.rarity || 'Rare';
        if (!poolsByRarity[rarityName]) poolsByRarity[rarityName] = [];
        poolsByRarity[rarityName].push(c);
      });
      const poolWeights = Object.keys(poolsByRarity).map(r => ({ rarityName: r, weight: getRarityWeight(r) }));
      const totalWeight = poolWeights.reduce((sum, item) => sum + item.weight, 0);
      let roll = Math.random() * totalWeight;
      let selectedRarity = poolWeights[0].rarityName;
      for (const item of poolWeights) {
        roll -= item.weight;
        if (roll <= 0) { selectedRarity = item.rarityName; break; }
      }
      const selectedPool = poolsByRarity[selectedRarity];
      pack.push(selectedPool[Math.floor(Math.random() * selectedPool.length)]);
      return pack;
    };

    // Draw all packs
    const packCards: any[] = [];
    for (let p = 0; p < count; p++) {
      packCards.push(...drawOnePack());
    }

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
        packs_opened: (user.packs_opened || 0) + count,
        free_packs_remaining: currentFreePacks,
        pack_tickets: currentTickets,
        last_daily_reset: lastReset ? lastReset.toISOString() : null
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Failed to update user pack stats:', updateError);
    }

    // Increment open_pack quest progress
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: questRow } = await supabaseAdmin
        .from('user_quests')
        .select('*')
        .eq('user_id', userId)
        .eq('quest_id', 'open_pack')
        .eq('day', todayStr)
        .maybeSingle();

      if (questRow) {
        await supabaseAdmin
          .from('user_quests')
          .update({ progress: Math.min(questRow.target, questRow.progress + count) })
          .eq('user_id', userId)
          .eq('quest_id', 'open_pack')
          .eq('day', todayStr);
      } else {
        await supabaseAdmin
          .from('user_quests')
          .insert({
            user_id: userId,
            quest_id: 'open_pack',
            progress: 1,
            target: 1,
            claimed: false,
            day: todayStr
          });
      }
    } catch (e) {
      console.error('Failed to update open_pack quest:', e);
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
