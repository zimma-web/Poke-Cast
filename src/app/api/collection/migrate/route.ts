import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { userId, ownedCards } = await request.json();

    if (!userId || !ownedCards) {
      return NextResponse.json({ error: 'Missing userId or ownedCards' }, { status: 400 });
    }

    const inserts: any[] = [];
    for (const [cardId, qty] of Object.entries(ownedCards)) {
      if (typeof qty !== 'number' || qty <= 0) continue;
      // Get set ID from card ID prefix, e.g. "hgss4-1" -> "hgss4"
      const setId = cardId.split('-')[0];
      for (let i = 0; i < qty; i++) {
        inserts.push({
          user_id: userId,
          card_id: cardId,
          source_set_id: setId,
          obtained_at: new Date().toISOString()
        });
      }
    }

    if (inserts.length > 0) {
      // Supabase has standard insert limits, batch inserts in groups of 500
      const batchSize = 500;
      for (let i = 0; i < inserts.length; i += batchSize) {
        const batch = inserts.slice(i, i + batchSize);
        const { error } = await supabaseAdmin.from('user_cards').insert(batch);
        
        if (error) {
          console.error('Migration batch insert database error:', error);
          return NextResponse.json({ error: 'Database insert error' }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ success: true, count: inserts.length });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
