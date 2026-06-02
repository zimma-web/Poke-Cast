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
            avatar
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
        // Update username or avatar if changed
        if (existingUser.username !== username || existingUser.avatar !== avatar) {
          const { data: refreshedUser, error: updateError } = await supabaseAdmin
            .from('users')
            .update({ username, avatar })
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
      return NextResponse.json(updatedUser);
    }

    // 2. Create new user
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('users')
      .insert({ 
        fid, 
        username, 
        avatar, 
        packs_opened: 0,
        pack_tickets: 10,
        free_packs_remaining: 2,
        last_daily_reset: new Date().toISOString()
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Create user error:', insertError);
      return NextResponse.json({ error: 'Database insert error' }, { status: 500 });
    }

    return NextResponse.json(newUser);
  } catch (error) {
    console.error('Auth endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
