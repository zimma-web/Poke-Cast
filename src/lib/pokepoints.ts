import { supabaseAdmin } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

// ─── Rarity → Points Table ────────────────────────────────────────────────────

export const RARITY_POINTS: Record<string, number> = {
  'Common': 1,
  'Uncommon': 2,
  'Rare': 5,
  'Rare Holo': 10,
  'Rare Holo EX': 10,
  'Rare Holo GX': 10,
  'Rare Holo V': 10,
  'Rare Prism Star': 10,
  'Double Rare': 20,
  'Rare BREAK': 20,
  'Rare Ultra': 20,
  'Ultra Rare': 50,
  'Rare Shiny': 50,
  'VMAX Rare': 50,
  'VSTAR Rare': 50,
  'ACE SPEC Rare': 50,
  'Illustration Rare': 75,
  'Radiant Rare': 75,
  'Shiny Rare': 75,
  'Shiny Ultra Rare': 150,
  'Special Illustration Rare': 150,
  'Trainer Gallery Rare Holo': 75,
  'Hyper Rare': 250,
  'Rare Secret': 250,
  'Rainbow Rare': 250,
  'Gold Rare': 250,
  'Rare Rainbow': 250,
};

/** Get PokePoints for a rarity string (case-insensitive fallback). */
export function getRarityPoints(rarity: string | null | undefined): number {
  if (!rarity) return 1;
  if (RARITY_POINTS[rarity] !== undefined) return RARITY_POINTS[rarity];
  const r = rarity.toLowerCase();
  if (r.includes('hyper') || r.includes('secret') || r.includes('rainbow') || r.includes('gold')) return 250;
  if (r.includes('special illustration')) return 150;
  if (r.includes('illustration')) return 75;
  if (r.includes('ultra') || r.includes('vmax') || r.includes('vstar') || r.includes('ace spec')) return 50;
  if (r.includes('double') || r.includes('break') || r.includes('radiant') || r.includes('shiny rare')) return 20;
  if (r.includes('holo') || r.includes('promo')) return 10;
  if (r.includes('rare')) return 5;
  if (r.includes('uncommon')) return 2;
  return 1;
}

// ─── Collector Ranks ──────────────────────────────────────────────────────────

export interface CollectorRank {
  name: string;
  minPoints: number;
  maxPoints: number | null;
  color: string;
  emoji: string;
}

export const COLLECTOR_RANKS: CollectorRank[] = [
  { name: 'Trainer',    minPoints: 0,      maxPoints: 999,    color: 'text-zinc-400',   emoji: '🎒' },
  { name: 'Ace Trainer', minPoints: 1000,  maxPoints: 4999,   color: 'text-blue-400',   emoji: '⭐' },
  { name: 'Gym Leader', minPoints: 5000,   maxPoints: 19999,  color: 'text-emerald-400', emoji: '🏅' },
  { name: 'Elite Four', minPoints: 20000,  maxPoints: 99999,  color: 'text-violet-400',  emoji: '💎' },
  { name: 'Champion',   minPoints: 100000, maxPoints: null,   color: 'text-yellow-400',  emoji: '👑' },
];

export function getRank(points: number): CollectorRank {
  for (let i = COLLECTOR_RANKS.length - 1; i >= 0; i--) {
    if (points >= COLLECTOR_RANKS[i].minPoints) return COLLECTOR_RANKS[i];
  }
  return COLLECTOR_RANKS[0];
}

export function getNextRank(points: number): CollectorRank | null {
  const current = getRank(points);
  const idx = COLLECTOR_RANKS.findIndex(r => r.name === current.name);
  return idx < COLLECTOR_RANKS.length - 1 ? COLLECTOR_RANKS[idx + 1] : null;
}

export function getRankProgress(points: number): number {
  const current = getRank(points);
  const next = getNextRank(points);
  if (!next) return 100;
  const range = next.minPoints - current.minPoints;
  const progress = points - current.minPoints;
  return Math.min(100, Math.round((progress / range) * 100));
}

// ─── Core Award Function ──────────────────────────────────────────────────────

/**
 * Awards PokePoints to a user, updates lifetime_points, and logs to history.
 * Fire-and-forget safe — errors are caught and logged without throwing.
 */
export async function awardPoints(
  userId: string,
  actionType: string,
  points: number,
  referenceId?: string,
  metadata?: Record<string, any>
): Promise<void> {
  if (!userId || points <= 0) return;
  try {
    // Atomically increment both pokepoints and lifetime_points
    const { error: rpcError } = await supabaseAdmin.rpc('increment_pokepoints', {
      p_user_id: userId,
      p_points: points
    });

    if (rpcError) {
      // Fallback: manual increment if RPC not available
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('pokepoints, lifetime_points')
        .eq('id', userId)
        .single();

      if (user) {
        await supabaseAdmin
          .from('users')
          .update({
            pokepoints: (user.pokepoints || 0) + points,
            lifetime_points: (user.lifetime_points || 0) + points
          })
          .eq('id', userId);
      }
    }

    // Insert history row
    await supabaseAdmin.from('user_points_history').insert({
      user_id: userId,
      action_type: actionType,
      points,
      reference_id: referenceId || null,
      metadata: metadata || null
    });
  } catch (e) {
    console.error(`[PokePoints] Failed to award ${points} pts (${actionType}) to ${userId}:`, e);
  }
}

// ─── Daily Share Limit ────────────────────────────────────────────────────────

const DAILY_SHARE_LIMIT = 5;

export async function canAwardSharePoints(userId: string): Promise<boolean> {
  try {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const { count } = await supabaseAdmin
      .from('user_points_history')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action_type', 'share')
      .gte('created_at', todayStart.toISOString());

    return (count || 0) < DAILY_SHARE_LIMIT;
  } catch {
    return false;
  }
}

// ─── Set Completion Milestones ────────────────────────────────────────────────

const MILESTONE_CONFIGS = [
  { pct: 25,  points: 50,  key: '25pct'  },
  { pct: 50,  points: 100, key: '50pct'  },
  { pct: 75,  points: 250, key: '75pct'  },
  { pct: 100, points: 500, key: '100pct' },
];

export async function checkSetCompletionMilestones(userId: string, setId: string): Promise<void> {
  try {
    // Load set's total card count
    const setsPath = path.join(process.cwd(), 'public', 'data', 'pokemon_sets.json');
    const sets = JSON.parse(fs.readFileSync(setsPath, 'utf8'));
    const setInfo = sets.find((s: any) => s.id === setId);
    if (!setInfo || !setInfo.totalCards || setInfo.totalCards === 0) return;

    // Count unique cards owned in this set
    const { count: ownedCount } = await supabaseAdmin
      .from('user_cards')
      .select('card_id', { count: 'exact', head: false })
      .eq('user_id', userId)
      .like('card_id', `${setId}-%`);

    // Get unique card count
    const { data: ownedRows } = await supabaseAdmin
      .from('user_cards')
      .select('card_id')
      .eq('user_id', userId)
      .like('card_id', `${setId}-%`);

    const uniqueOwned = new Set(ownedRows?.map((r: any) => r.card_id) || []).size;
    const completionPct = (uniqueOwned / setInfo.totalCards) * 100;

    for (const milestone of MILESTONE_CONFIGS) {
      if (completionPct < milestone.pct) continue;

      const refId = `${setId}_${milestone.key}`;

      // Check if already awarded this milestone (ever)
      const { count: alreadyAwarded } = await supabaseAdmin
        .from('user_points_history')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('action_type', 'set_completion')
        .eq('reference_id', refId);

      if ((alreadyAwarded || 0) > 0) continue;

      await awardPoints(userId, 'set_completion', milestone.points, refId, {
        setId,
        milestone: `${milestone.pct}%`,
        setName: setInfo.name
      });
    }
  } catch (e) {
    console.error('[PokePoints] Set completion milestone check failed:', e);
  }
}

// ─── Login Streak Points ──────────────────────────────────────────────────────

export async function awardLoginStreakPoints(userId: string, streak: number): Promise<void> {
  // Day 1
  if (streak === 1) {
    const todayStr = new Date().toISOString().split('T')[0];
    const { count } = await supabaseAdmin
      .from('user_points_history')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action_type', 'login_day1')
      .gte('created_at', `${todayStr}T00:00:00.000Z`);
    if ((count || 0) === 0) await awardPoints(userId, 'login_day1', 5);
  }
  // Day 7 milestone
  if (streak === 7) {
    const { count } = await supabaseAdmin
      .from('user_points_history')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action_type', 'login_day7');
    if ((count || 0) === 0) await awardPoints(userId, 'login_day7', 50);
  }
  // Day 30 milestone
  if (streak === 30) {
    const { count } = await supabaseAdmin
      .from('user_points_history')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action_type', 'login_day30');
    if ((count || 0) === 0) await awardPoints(userId, 'login_day30', 250);
  }
}
