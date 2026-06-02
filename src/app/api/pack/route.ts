import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '@/lib/supabase';

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

    // Fetch user details to increment packs_opened count
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('packs_opened')
      .eq('id', userId)
      .single();
    
    if (!userError && user) {
      await supabaseAdmin
        .from('users')
        .update({ packs_opened: (user.packs_opened || 0) + 1 })
        .eq('id', userId);
    }

    return NextResponse.json({
      cards: packCards
    });
  } catch (error) {
    console.error('Failed to generate/save pack:', error);
    return NextResponse.json({ error: 'Failed to open pack' }, { status: 500 });
  }
}
