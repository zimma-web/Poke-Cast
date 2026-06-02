import { supabaseAdmin } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

// Core server-side achievements evaluation helper
export async function evaluateAchievements(userId: string) {
  try {
    // 1. Fetch user data (packs_opened, pack_tickets)
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('packs_opened, pack_tickets')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('Failed to query user for achievements:', userError);
      return [];
    }

    // 2. Fetch all cards owned by the user
    const { data: userCards, error: cardsError } = await supabaseAdmin
      .from('user_cards')
      .select('card_id')
      .eq('user_id', userId);

    if (cardsError) {
      console.error('Failed to query user cards for achievements:', cardsError);
      return [];
    }

    const totalCopies = userCards.length;
    const uniqueCardIds = Array.from(new Set(userCards.map(c => c.card_id)));

    // Load card database to map card IDs to their rarities
    const cardsFilePath = path.join(process.cwd(), 'public', 'data', 'pokemon_cards.json');
    const fileContents = fs.readFileSync(cardsFilePath, 'utf8');
    const allCards = JSON.parse(fileContents);
    const cardRarities = new Map<string, string | null>(allCards.map((c: any) => [c.id, c.rarity]));
    const cardSets = new Map<string, string>(allCards.map((c: any) => [c.id, c.setId]));

    // Check card rarity counts
    let hasRare = false;
    let hasUltraRare = false;
    const uniqueCardsBySet: Record<string, Set<string>> = {};

    uniqueCardIds.forEach(id => {
      const rarity = cardRarities.get(id);
      if (rarity) {
        const r = rarity.toLowerCase();
        if (r.includes('rare') || r.includes('holo')) {
          hasRare = true;
        }
        if (r.includes('ultra') || r.includes('secret') || r.includes('hyper') || r.includes('special illustration') || r.includes('rainbow') || r.includes('gold')) {
          hasUltraRare = true;
        }
      }

      const setId = cardSets.get(id);
      if (setId) {
        if (!uniqueCardsBySet[setId]) {
          uniqueCardsBySet[setId] = new Set();
        }
        uniqueCardsBySet[setId].add(id);
      }
    });

    // Check set completions
    const setsFilePath = path.join(process.cwd(), 'public', 'data', 'pokemon_sets.json');
    const setsFileContents = fs.readFileSync(setsFilePath, 'utf8');
    const allSets = JSON.parse(setsFileContents);

    let hasCompletedAnySet = false;
    for (const set of allSets) {
      const ownedInSet = uniqueCardsBySet[set.id]?.size || 0;
      if (ownedInSet > 0 && ownedInSet >= set.totalCards) {
        hasCompletedAnySet = true;
        break;
      }
    }

    // 3. Fetch currently unlocked achievements
    const { data: unlockedData, error: unlockedError } = await supabaseAdmin
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', userId);

    if (unlockedError) {
      console.error('Failed to query unlocked achievements:', unlockedError);
      return [];
    }

    const unlockedIds = new Set(unlockedData.map(ua => ua.achievement_id));

    // 4. Fetch achievements definitions
    const { data: allAchievements, error: achError } = await supabaseAdmin
      .from('achievements')
      .select('*');

    if (achError || !allAchievements) {
      console.error('Failed to query achievements definitions:', achError);
      return [];
    }

    const newlyUnlocked: any[] = [];
    let ticketsToAward = 0;

    for (const ach of allAchievements) {
      if (unlockedIds.has(ach.id)) continue;

      let meetsCriteria = false;
      switch (ach.id) {
        case 'first_pack':
          meetsCriteria = user.packs_opened >= 1;
          break;
        case 'first_rare':
          meetsCriteria = hasRare;
          break;
        case 'first_ultra_rare':
          meetsCriteria = hasUltraRare;
          break;
        case 'collected_100':
          meetsCriteria = totalCopies >= 100;
          break;
        case 'collected_500':
          meetsCriteria = totalCopies >= 500;
          break;
        case 'collected_1000':
          meetsCriteria = totalCopies >= 1000;
          break;
        case 'complete_set_1':
          meetsCriteria = hasCompletedAnySet;
          break;
        case 'opened_50':
          meetsCriteria = user.packs_opened >= 50;
          break;
        case 'opened_100':
          meetsCriteria = user.packs_opened >= 100;
          break;
      }

      if (meetsCriteria) {
        newlyUnlocked.push(ach);
        if (ach.reward_type === 'tickets') {
          ticketsToAward += ach.reward_value;
        }
      }
    }

    // 5. Save newly unlocked achievements & award tickets
    if (newlyUnlocked.length > 0) {
      const inserts = newlyUnlocked.map(ach => ({
        user_id: userId,
        achievement_id: ach.id,
        unlocked_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabaseAdmin
        .from('user_achievements')
        .insert(inserts);

      if (insertError) {
        console.error('Failed to save unlocked achievements:', insertError);
      }

      if (ticketsToAward > 0) {
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({ pack_tickets: (user.pack_tickets || 0) + ticketsToAward })
          .eq('id', userId);

        if (updateError) {
          console.error('Failed to award achievement tickets:', updateError);
        }
      }
    }

    return newlyUnlocked;
  } catch (error) {
    console.error('Error evaluating achievements:', error);
    return [];
  }
}
