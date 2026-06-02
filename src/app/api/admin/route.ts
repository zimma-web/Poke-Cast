import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '@/lib/supabase';

// Absolute file paths to card databases
const CARDS_FILE_PATH = path.join(process.cwd(), 'public', 'data', 'pokemon_cards.json');
const SETS_FILE_PATH = path.join(process.cwd(), 'public', 'data', 'pokemon_sets.json');

// Read JSON files helper
function readJsonFile(filePath: string) {
  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (err) {
    console.error(`Failed to read file ${filePath}:`, err);
    return [];
  }
}

// Write JSON files helper
function writeJsonFile(filePath: string, data: any) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Failed to write file ${filePath}:`, err);
    return false;
  }
}

// Keep a simple in-memory audit log
const auditLogs: any[] = [];
function addAuditLog(action: string, details: string) {
  auditLogs.unshift({
    timestamp: new Date().toISOString(),
    action,
    details
  });
  if (auditLogs.length > 100) auditLogs.pop(); // Keep last 100 logs
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, payload } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const expectedPassword = process.env.ADMIN_PASSWORD || 'ZeemmyAdmin07';

    // Handle Login Action
    if (action === 'login') {
      const { password } = payload || {};
      if (password === expectedPassword) {
        addAuditLog('ADMIN_LOGIN', 'Administrator logged in successfully.');
        return NextResponse.json({ success: true });
      } else {
        return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
      }
    }

    // Protect all other admin actions
    const adminPasswordHeader = request.headers.get('x-admin-password');
    if (adminPasswordHeader !== expectedPassword) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startTime = Date.now();

    // 1. STATS ACTION
    if (action === 'stats') {
      // Measure database latency
      const dbStart = Date.now();
      const { count: userCount, error: userCountError } = await supabaseAdmin
        .from('users')
        .select('*', { count: 'exact', head: true });
      const dbLatency = Date.now() - dbStart;

      const { count: cardCount } = await supabaseAdmin
        .from('user_cards')
        .select('*', { count: 'exact', head: true });

      const { data: sumData } = await supabaseAdmin
        .from('users')
        .select('packs_opened');
      
      const totalPacks = sumData ? sumData.reduce((sum, u) => sum + (u.packs_opened || 0), 0) : 0;

      const localCards = readJsonFile(CARDS_FILE_PATH);
      const localSets = readJsonFile(SETS_FILE_PATH);

      return NextResponse.json({
        totalUsers: userCount || 0,
        totalCardsClaimed: cardCount || 0,
        totalPacksOpened: totalPacks,
        databaseLatencyMs: dbLatency,
        databaseStatus: userCountError ? 'Error' : 'Healthy',
        totalAvailableCards: localCards.length,
        totalAvailableSets: localSets.length,
        serverTime: new Date().toISOString(),
      });
    }

    // 2. USERS LIST ACTION
    if (action === 'users_list') {
      const { search = '', limit = 100 } = payload || {};
      let query = supabaseAdmin
        .from('users')
        .select('id, fid, username, avatar, created_at, packs_opened')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (search) {
        query = query.or(`username.ilike.%${search}%,fid.eq.${isNaN(Number(search)) ? -1 : Number(search)}`);
      }

      const { data: users, error } = await query;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ users });
    }

    // 3. USER DETAIL ACTION
    if (action === 'user_detail') {
      const { userId } = payload || {};
      if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

      // Fetch user details
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });

      // Fetch user cards
      const { data: userCards, error: cardsError } = await supabaseAdmin
        .from('user_cards')
        .select('card_id, obtained_at, source_set_id')
        .eq('user_id', userId);

      if (cardsError) return NextResponse.json({ error: cardsError.message }, { status: 500 });

      return NextResponse.json({ user, cards: userCards });
    }

    // 4. USER UPDATE ACTION
    if (action === 'user_update') {
      const { userId, username, avatar, packsOpened } = payload || {};
      if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

      const { data: updatedUser, error } = await supabaseAdmin
        .from('users')
        .update({
          username,
          avatar,
          packs_opened: packsOpened
        })
        .eq('id', userId)
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      addAuditLog('USER_UPDATE', `Updated user details for ${username} (FID: ${updatedUser.fid})`);
      return NextResponse.json({ user: updatedUser });
    }

    // 5. USER DELETE ACTION
    if (action === 'user_delete') {
      const { userId } = payload || {};
      if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

      // Fetch username before deleting for audit logs
      const { data: user } = await supabaseAdmin.from('users').select('username').eq('id', userId).single();

      const { error } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      addAuditLog('USER_DELETE', `Deleted trainer account for username: ${user?.username || userId}`);
      return NextResponse.json({ success: true });
    }

    // 6. USER CLEAR COLLECTION ACTION
    if (action === 'user_clear') {
      const { userId } = payload || {};
      if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

      const { error } = await supabaseAdmin
        .from('user_cards')
        .delete()
        .eq('user_id', userId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      addAuditLog('USER_CLEAR', `Cleared all collection cards for user ID: ${userId}`);
      return NextResponse.json({ success: true });
    }

    // 7. USER GRANT RANDOM CARDS ACTION
    if (action === 'user_grant') {
      const { userId, count = 10, setId } = payload || {};
      if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

      const cards = readJsonFile(CARDS_FILE_PATH);
      let pool = cards;
      if (setId) {
        pool = cards.filter((c: any) => c.setId === setId);
      }

      if (pool.length === 0) {
        return NextResponse.json({ error: 'No cards available to grant' }, { status: 400 });
      }

      const inserts = [];
      for (let i = 0; i < count; i++) {
        const randCard = pool[Math.floor(Math.random() * pool.length)];
        inserts.push({
          user_id: userId,
          card_id: randCard.id,
          source_set_id: randCard.setId,
          obtained_at: new Date().toISOString()
        });
      }

      const { error } = await supabaseAdmin.from('user_cards').insert(inserts);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      addAuditLog('USER_GRANT', `Granted ${count} random cards to user ID: ${userId}`);
      return NextResponse.json({ success: true, grantedCount: count });
    }

    // 8. CARD UPDATE ACTION
    if (action === 'card_update') {
      const { cardId, updatedFields } = payload || {};
      if (!cardId || !updatedFields) {
        return NextResponse.json({ error: 'cardId and updatedFields are required' }, { status: 400 });
      }

      const cards = readJsonFile(CARDS_FILE_PATH);
      const cardIndex = cards.findIndex((c: any) => c.id === cardId);

      if (cardIndex === -1) {
        return NextResponse.json({ error: 'Card not found' }, { status: 404 });
      }

      cards[cardIndex] = {
        ...cards[cardIndex],
        ...updatedFields
      };

      const success = writeJsonFile(CARDS_FILE_PATH, cards);
      if (!success) return NextResponse.json({ error: 'Failed to write card updates' }, { status: 500 });

      addAuditLog('CARD_UPDATE', `Modified card: ${cards[cardIndex].name} (#${cards[cardIndex].number})`);
      return NextResponse.json({ success: true, card: cards[cardIndex] });
    }

    // 9. SET UPDATE ACTION
    if (action === 'set_update') {
      const { setId, updatedFields } = payload || {};
      if (!setId || !updatedFields) {
        return NextResponse.json({ error: 'setId and updatedFields are required' }, { status: 400 });
      }

      const sets = readJsonFile(SETS_FILE_PATH);
      const setIndex = sets.findIndex((s: any) => s.id === setId);

      if (setIndex === -1) {
        return NextResponse.json({ error: 'Set not found' }, { status: 404 });
      }

      sets[setIndex] = {
        ...sets[setIndex],
        ...updatedFields
      };

      const success = writeJsonFile(SETS_FILE_PATH, sets);
      if (!success) return NextResponse.json({ error: 'Failed to write set updates' }, { status: 500 });

      addAuditLog('SET_UPDATE', `Modified set: ${sets[setIndex].name} (${sets[setIndex].id.toUpperCase()})`);
      return NextResponse.json({ success: true, set: sets[setIndex] });
    }

    // 10. SIMULATE PACK PULLS ACTION (10,000 pulls to verify probabilities)
    if (action === 'simulate_packs') {
      const { setId } = payload || {};
      if (!setId) return NextResponse.json({ error: 'setId is required' }, { status: 400 });

      const cards = readJsonFile(CARDS_FILE_PATH);
      const setCards = cards.filter((c: any) => c.setId === setId);

      if (setCards.length === 0) {
        return NextResponse.json({ error: 'No cards found in set' }, { status: 404 });
      }

      const rarePool = setCards.filter((c: any) => c.rarity !== 'Common' && c.rarity !== 'Uncommon' && c.rarity);

      // Perform 5,000 mock rare pulls to build distribution map
      const rarityCounts: Record<string, number> = {};
      let totalPulls = 5000;

      function getRarityWeight(rarity: string): number {
        const r = rarity.toLowerCase();
        if (r.includes('secret') || r.includes('hyper') || r.includes('rainbow') || r.includes('special illustration') || r.includes('gold')) return 2;
        if (r.includes('illustration') || r.includes('shining') || r.includes('shiny ultra') || r.includes('radiant')) return 8;
        if (r.includes('ultra') || r.includes('double') || r.includes('vmax') || r.includes('vstar') || r.includes('ex') || r.includes('gx') || r.includes('v') || r.includes('break') || r.includes('prism')) return 25;
        if (r.includes('holo') || r.includes('shiny') || r.includes('promo')) return 65;
        return 100;
      }

      if (rarePool.length > 0) {
        const poolsByRarity: Record<string, any[]> = {};
        rarePool.forEach((c: any) => {
          const rarityName = c.rarity || 'Rare';
          if (!poolsByRarity[rarityName]) poolsByRarity[rarityName] = [];
          poolsByRarity[rarityName].push(c);
        });

        const poolWeights = Object.keys(poolsByRarity).map(rarityName => ({
          rarityName,
          weight: getRarityWeight(rarityName)
        }));

        const totalWeight = poolWeights.reduce((sum, item) => sum + item.weight, 0);

        for (let i = 0; i < totalPulls; i++) {
          let roll = Math.random() * totalWeight;
          let selectedRarity = poolWeights[0].rarityName;
          for (const item of poolWeights) {
            roll -= item.weight;
            if (roll <= 0) {
              selectedRarity = item.rarityName;
              break;
            }
          }
          rarityCounts[selectedRarity] = (rarityCounts[selectedRarity] || 0) + 1;
        }
      }

      const distribution = Object.entries(rarityCounts).map(([rarity, count]) => ({
        rarity,
        count,
        percentage: ((count / totalPulls) * 100).toFixed(2)
      }));

      return NextResponse.json({ distribution, totalSimulatedPulls: totalPulls });
    }

    // 11. AUDIT LOGS ACTION
    if (action === 'audit_logs') {
      return NextResponse.json({ logs: auditLogs });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('Unified Admin API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
