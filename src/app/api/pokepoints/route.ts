import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getRank, getRankProgress, getNextRank, awardPoints, canAwardSharePoints, COLLECTOR_RANKS } from '@/lib/pokepoints';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const isLeaderboard = searchParams.get('leaderboard') === 'true';

    // ── Leaderboard ──────────────────────────────────────────────────────────
    if (isLeaderboard) {
      const { data: leaders, error } = await supabaseAdmin
        .from('users')
        .select('id, username, avatar, pokepoints, lifetime_points')
        .or('is_hidden.is.null,is_hidden.eq.false')
        .order('pokepoints', { ascending: false })
        .limit(50);

      if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });

      const leaderboard = (leaders || []).map((u: any, i: number) => ({
        rank: i + 1,
        userId: u.id,
        username: u.username || `trainer_${u.id.slice(0, 6)}`,
        avatar: u.avatar || null,
        pokepoints: u.pokepoints || 0,
        lifetimePoints: u.lifetime_points || 0,
        collectorRank: getRank(u.pokepoints || 0)
      }));

      return NextResponse.json({ leaderboard });
    }

    // ── User Points ──────────────────────────────────────────────────────────
    if (!userId) {
      return NextResponse.json({ error: 'userId or leaderboard=true required' }, { status: 400 });
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('pokepoints, lifetime_points')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const points = user.pokepoints || 0;
    const lifetimePoints = user.lifetime_points || 0;
    const rank = getRank(points);
    const nextRank = getNextRank(points);
    const progress = getRankProgress(points);

    // Recent history (last 30)
    const { data: history } = await supabaseAdmin
      .from('user_points_history')
      .select('id, action_type, points, reference_id, metadata, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);

    return NextResponse.json({
      pokepoints: points,
      lifetimePoints,
      rank,
      nextRank,
      rankProgress: progress,
      history: history || []
    });
  } catch (e) {
    console.error('PokePoints GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { action, userId, referenceId } = await request.json();

    if (!userId || !action) {
      return NextResponse.json({ error: 'userId and action required' }, { status: 400 });
    }

    // ── Share Pull Award ─────────────────────────────────────────────────────
    if (action === 'share') {
      const canAward = await canAwardSharePoints(userId);
      if (!canAward) {
        return NextResponse.json({ awarded: false, reason: 'Daily share limit reached (20/day)' });
      }

      await awardPoints(userId, 'share', 2, referenceId, { source: 'card_share' });

      const { data: user } = await supabaseAdmin
        .from('users')
        .select('pokepoints')
        .eq('id', userId)
        .single();

      return NextResponse.json({ awarded: true, points: 2, total: user?.pokepoints || 0 });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    console.error('PokePoints POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
