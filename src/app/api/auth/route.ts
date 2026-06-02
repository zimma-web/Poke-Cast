import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { fid, username, avatar } = await request.json();

    if (fid === undefined || fid === null) {
      return NextResponse.json({ error: 'FID is required' }, { status: 400 });
    }

    // 1. Check if user already exists
    const { data: existingUser, error: findError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('fid', fid)
      .maybeSingle();

    if (findError) {
      console.error('Database query error:', findError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (existingUser) {
      const now = new Date();
      let lastReset = existingUser.last_daily_reset ? new Date(existingUser.last_daily_reset) : null;
      let currentTickets = existingUser.pack_tickets !== null && existingUser.pack_tickets !== undefined ? existingUser.pack_tickets : 10;
      let currentFreePacks = existingUser.free_packs_remaining !== null && existingUser.free_packs_remaining !== undefined ? existingUser.free_packs_remaining : 2;

      const timeSinceReset = lastReset ? now.getTime() - lastReset.getTime() : null;
      const isDueForReset = lastReset === null || (timeSinceReset !== null && timeSinceReset >= 24 * 60 * 60 * 1000);

      // Calculate login streak in UTC
      const todayStr = now.toISOString().split('T')[0];
      let newStreak = existingUser.login_streak !== null && existingUser.login_streak !== undefined ? existingUser.login_streak : 0;
      let newHighest = existingUser.highest_streak !== null && existingUser.highest_streak !== undefined ? existingUser.highest_streak : 0;
      const lastLoginStr = existingUser.last_login_date || null;
      let streakUpdated = false;

      if (!lastLoginStr) {
        newStreak = 1;
        newHighest = Math.max(newHighest, 1);
        streakUpdated = true;
      } else {
        const lastLoginTime = new Date(lastLoginStr).getTime();
        const todayTime = new Date(todayStr).getTime();
        const diffTime = todayTime - lastLoginTime;
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          newStreak += 1;
          newHighest = Math.max(newHighest, newStreak);
          streakUpdated = true;
        } else if (diffDays > 1 || diffDays < 0) {
          newStreak = 1;
          streakUpdated = true;
        }
      }

      const streakUpdates: any = {};
      if (streakUpdated) {
        streakUpdates.login_streak = newStreak;
        streakUpdates.highest_streak = newHighest;
        streakUpdates.last_login_date = todayStr;
      }

      let updatedUser = existingUser;

      if (isDueForReset) {
        currentFreePacks = 2;
        currentTickets = (currentTickets || 0) + 2;
        lastReset = now;

        const { data: refreshedUser, error: updateResetError } = await supabaseAdmin
          .from('users')
          .update({
            free_packs_remaining: currentFreePacks,
            pack_tickets: currentTickets,
            last_daily_reset: lastReset.toISOString(),
            username,
            avatar,
            ...streakUpdates
          })
          .eq('id', existingUser.id)
          .select('*')
          .single();

        if (updateResetError) {
          console.error('Update reset user error:', updateResetError);
          return NextResponse.json({ error: 'Database update error' }, { status: 500 });
        }
        updatedUser = refreshedUser;
      } else {
        const needsMetadataUpdate = existingUser.username !== username || existingUser.avatar !== avatar;
        if (needsMetadataUpdate || streakUpdated) {
          const { data: refreshedUser, error: updateError } = await supabaseAdmin
            .from('users')
            .update({
              ...(needsMetadataUpdate ? { username, avatar } : {}),
              ...streakUpdates
            })
            .eq('id', existingUser.id)
            .select('*')
            .single();

          if (updateError) {
            console.error('Update user error:', updateError);
            return NextResponse.json({ error: 'Database update error' }, { status: 500 });
          }
          updatedUser = refreshedUser;
        }
      }

      // Check if already claimed today
      const { data: claimedRow } = await supabaseAdmin
        .from('login_rewards')
        .select('id')
        .eq('user_id', updatedUser.id)
        .gte('claimed_at', `${todayStr}T00:00:00.000Z`)
        .lte('claimed_at', `${todayStr}T23:59:59.999Z`)
        .maybeSingle();

      const claimedToday = !!claimedRow;

      // Fetch wishlist for returning user
      const { data: wishlistData } = await supabaseAdmin
        .from('user_wishlist')
        .select('card_id')
        .eq('user_id', updatedUser.id);

      return NextResponse.json({
        ...updatedUser,
        wishlist: wishlistData ? wishlistData.map((row: any) => row.card_id) : [],
        claimed_today: claimedToday
      });
    }

    // 2. Create new user
    const todayStr = new Date().toISOString().split('T')[0];
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('users')
      .insert({ 
        fid, 
        username, 
        avatar, 
        packs_opened: 0,
        pack_tickets: 10,
        free_packs_remaining: 2,
        last_daily_reset: new Date().toISOString(),
        login_streak: 1,
        highest_streak: 1,
        last_login_date: todayStr
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Create user error:', insertError);
      return NextResponse.json({ error: 'Database insert error' }, { status: 500 });
    }

    return NextResponse.json({
      ...newUser,
      wishlist: [],
      claimed_today: false
    });
  } catch (error) {
    console.error('Auth endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
