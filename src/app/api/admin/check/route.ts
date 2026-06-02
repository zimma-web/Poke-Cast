import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ isAdmin: false });
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('is_admin, is_banned')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ isAdmin: false });
    }

    return NextResponse.json({
      isAdmin: data.is_admin === true,
      isBanned: data.is_banned === true
    });
  } catch (error) {
    console.error('Admin check error:', error);
    return NextResponse.json({ isAdmin: false });
  }
}
