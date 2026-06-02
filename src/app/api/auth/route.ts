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
      // Update username or avatar if changed
      if (existingUser.username !== username || existingUser.avatar !== avatar) {
        const { data: updatedUser, error: updateError } = await supabaseAdmin
          .from('users')
          .update({ username, avatar })
          .eq('id', existingUser.id)
          .select('*')
          .single();

        if (updateError) {
          console.error('Update user error:', updateError);
          return NextResponse.json({ error: 'Database update error' }, { status: 500 });
        }
        return NextResponse.json(updatedUser);
      }
      return NextResponse.json(existingUser);
    }

    // 2. Create new user
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('users')
      .insert({ fid, username, avatar, packs_opened: 0 })
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
