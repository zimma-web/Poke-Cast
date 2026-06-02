import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // 1. Fetch user data (streak, pack tickets, free packs)
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('login_streak, pack_tickets, free_packs_remaining')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('Fetch user for claim error:', userError);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const streak = user.login_streak || 1;

    // 2. Check if already claimed today in UTC
    const todayStr = new Date().toISOString().split('T')[0];
    const { data: claimedRow, error: claimCheckError } = await supabaseAdmin
      .from('login_rewards')
      .select('id')
      .eq('user_id', userId)
      .gte('claimed_at', `${todayStr}T00:00:00.000Z`)
      .lte('claimed_at', `${todayStr}T23:59:59.999Z`)
      .maybeSingle();

    if (claimCheckError) {
      console.error('Check claim error:', claimCheckError);
      return NextResponse.json({ error: 'Failed to verify claim status' }, { status: 500 });
    }

    if (claimedRow) {
      return NextResponse.json({ error: 'Already claimed today' }, { status: 400 });
    }

    // 3. Calculate rewards based on rules:
    // Day 1 to 6: +(Day % 7) Tickets
    // Day 7 (and multiples of 7): +10 Tickets + 1 Bonus Pack
    const isMultipleOf7 = streak % 7 === 0;
    let rewardType: 'tickets' | 'tickets_and_pack' = 'tickets';
    let rewardAmount = streak % 7;
    let ticketsAdded = rewardAmount;
    let packsAdded = 0;

    if (isMultipleOf7) {
      rewardType = 'tickets_and_pack';
      rewardAmount = 10;
      ticketsAdded = 10;
      packsAdded = 1;
    }

    // 4. Update database (insert login_rewards and update users)
    const { error: insertRewardError } = await supabaseAdmin
      .from('login_rewards')
      .insert({
        user_id: userId,
        streak_day: streak,
        reward_type: rewardType,
        reward_amount: rewardAmount,
        claimed_at: new Date().toISOString()
      });

    if (insertRewardError) {
      console.error('Insert login reward log error:', insertRewardError);
      if (insertRewardError.code === '23505') {
        return NextResponse.json({ error: 'Already claimed today' }, { status: 400 });
      }
      return NextResponse.json({ error: 'Failed to record login reward claim' }, { status: 500 });
    }

    const nextTickets = (user.pack_tickets || 0) + ticketsAdded;
    const nextFreePacks = (user.free_packs_remaining || 0) + packsAdded;

    const { error: updateUserError } = await supabaseAdmin
      .from('users')
      .update({
        pack_tickets: nextTickets,
        free_packs_remaining: nextFreePacks
      })
      .eq('id', userId);

    if (updateUserError) {
      console.error('Update user reward error:', updateUserError);
      return NextResponse.json({ error: 'Failed to award login reward' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      rewardType,
      rewardAmount,
      packTickets: nextTickets,
      freePacksRemaining: nextFreePacks,
      claimedToday: true
    });
  } catch (error) {
    console.error('Claim login reward API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
