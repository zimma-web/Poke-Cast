import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { userId, cardId } = await request.json();

    if (!userId || !cardId) {
      return NextResponse.json({ error: 'User ID and Card ID are required' }, { status: 400 });
    }

    // 1. Check if card is already in user's wishlist
    const { data: existingWish, error: findError } = await supabaseAdmin
      .from('user_wishlist')
      .select('*')
      .eq('user_id', userId)
      .eq('card_id', cardId)
      .maybeSingle();

    if (findError) {
      console.error('Database find wishlist error:', findError);
      return NextResponse.json({ error: 'Database query error' }, { status: 500 });
    }

    if (existingWish) {
      // Remove from wishlist
      const { error: deleteError } = await supabaseAdmin
        .from('user_wishlist')
        .delete()
        .eq('user_id', userId)
        .eq('card_id', cardId);

      if (deleteError) {
        console.error('Database delete wishlist error:', deleteError);
        return NextResponse.json({ error: 'Database delete error' }, { status: 500 });
      }

      return NextResponse.json({ success: true, added: false });
    } else {
      // Add to wishlist
      const { error: insertError } = await supabaseAdmin
        .from('user_wishlist')
        .insert({ user_id: userId, card_id: cardId });

      if (insertError) {
        console.error('Database insert wishlist error:', insertError);
        return NextResponse.json({ error: 'Database insert error' }, { status: 500 });
      }

      return NextResponse.json({ success: true, added: true });
    }
  } catch (error) {
    console.error('Wishlist toggle endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
