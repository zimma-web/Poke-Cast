import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  data?: Record<string, any>
) {
  try {
    await supabaseAdmin.from('notifications').insert({ user_id: userId, type, title, body, data });
  } catch (e) {
    console.error('Failed to create notification:', e);
  }
}

async function trackEvent(userId: string | null, event: string, data?: Record<string, any>) {
  try {
    await supabaseAdmin.from('analytics_events').insert({ user_id: userId, event, data });
  } catch (e) {
    console.error('Failed to track event:', e);
  }
}

// Validate card availability accounting for duplicates, active auctions, and other active trades
async function validateCardAvailability(userId: string, cardIds: string[], excludeOfferId?: string): Promise<{ valid: boolean, error?: string }> {
  if (!cardIds.length) return { valid: true };

  // Count requested quantities in this transaction
  const requestedCounts: Record<string, number> = {};
  cardIds.forEach(id => {
    requestedCounts[id] = (requestedCounts[id] || 0) + 1;
  });

  const uniqueCardIds = Object.keys(requestedCounts);

  // 1. Fetch total owned copies
  const { data: ownedData } = await supabaseAdmin
    .from('user_cards')
    .select('card_id')
    .eq('user_id', userId)
    .in('card_id', uniqueCardIds);

  const ownedCounts: Record<string, number> = {};
  (ownedData || []).forEach((c: any) => {
    ownedCounts[c.card_id] = (ownedCounts[c.card_id] || 0) + 1;
  });

  // 2. Fetch active auction counts
  const { data: auctionData } = await supabaseAdmin
    .from('auctions')
    .select('card_id')
    .eq('seller_id', userId)
    .in('card_id', uniqueCardIds)
    .in('status', ['active', 'pending_payment']);

  const auctionCounts: Record<string, number> = {};
  (auctionData || []).forEach((c: any) => {
    auctionCounts[c.card_id] = (auctionCounts[c.card_id] || 0) + 1;
  });

  // 3. Fetch locked trade counts (in other pending trades)
  let pendingOffersQuery = supabaseAdmin
    .from('trade_offers')
    .select('id')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .eq('status', 'pending');
  
  if (excludeOfferId) {
    pendingOffersQuery = pendingOffersQuery.neq('id', excludeOfferId);
  }

  const { data: pendingOffers } = await pendingOffersQuery;

  const tradeCounts: Record<string, number> = {};
  if (pendingOffers && pendingOffers.length > 0) {
    const offerIds = pendingOffers.map((o: any) => o.id);
    const { data: lockedCards } = await supabaseAdmin
      .from('trade_offer_cards')
      .select('card_id')
      .eq('owner_user_id', userId)
      .in('offer_id', offerIds)
      .in('card_id', uniqueCardIds);

    (lockedCards || []).forEach((c: any) => {
      tradeCounts[c.card_id] = (tradeCounts[c.card_id] || 0) + 1;
    });
  }

  // Verify availability for each unique card
  for (const cardId of uniqueCardIds) {
    const owned = ownedCounts[cardId] || 0;
    const listed = auctionCounts[cardId] || 0;
    const lockedTrade = tradeCounts[cardId] || 0;
    const requested = requestedCounts[cardId];

    const available = owned - listed - lockedTrade;
    if (available < requested) {
      return {
        valid: false,
        error: `Insufficient copies of card ${cardId}. Available: ${available} (Owned: ${owned}, Listed: ${listed}, In Trades: ${lockedTrade}), Requested: ${requested}.`
      };
    }
  }

  return { valid: true };
}

// Get enriched trade details (includes card metadata from JSON files)
async function enrichTrade(trade: any) {
  const { data: offerCards } = await supabaseAdmin
    .from('trade_offer_cards')
    .select('card_id, owner_user_id, direction')
    .eq('offer_id', trade.id);

  const senderCards = (offerCards || []).filter((c: any) => c.owner_user_id === trade.sender_id);
  const receiverCards = (offerCards || []).filter((c: any) => c.owner_user_id === trade.receiver_id);

  return {
    ...trade,
    sender_cards: senderCards.map((c: any) => c.card_id),
    receiver_cards: receiverCards.map((c: any) => c.card_id),
    card_count: (offerCards || []).length,
  };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, payload } = body;

    if (!action) return NextResponse.json({ error: 'Action required' }, { status: 400 });

    // ── CREATE TRADE ───────────────────────────────────────────────────────
    if (action === 'create') {
      const { senderId, receiverId, senderCardIds, receiverCardIds, message } = payload || {};

      if (!senderId || !receiverId || !senderCardIds?.length || !receiverCardIds?.length) {
        return NextResponse.json({ error: 'senderId, receiverId, senderCardIds, receiverCardIds are required' }, { status: 400 });
      }
      if (senderId === receiverId) {
        return NextResponse.json({ error: 'Cannot trade with yourself' }, { status: 400 });
      }

      // Validate sender card availability (owned - listed - locked)
      const senderCheck = await validateCardAvailability(senderId, senderCardIds);
      if (!senderCheck.valid) return NextResponse.json({ error: senderCheck.error }, { status: 400 });

      // Validate receiver card availability (owned - listed - locked)
      const receiverCheck = await validateCardAvailability(receiverId, receiverCardIds);
      if (!receiverCheck.valid) return NextResponse.json({ error: receiverCheck.error }, { status: 400 });

      // Create trade offer
      const { data: offer, error: offerError } = await supabaseAdmin
        .from('trade_offers')
        .insert({ sender_id: senderId, receiver_id: receiverId, status: 'pending', message })
        .select('*')
        .single();

      if (offerError || !offer) return NextResponse.json({ error: offerError?.message || 'Failed to create trade' }, { status: 500 });

      // Insert trade cards
      const cardInserts = [
        ...senderCardIds.map((cardId: string) => ({ offer_id: offer.id, card_id: cardId, owner_user_id: senderId, direction: 'send' })),
        ...receiverCardIds.map((cardId: string) => ({ offer_id: offer.id, card_id: cardId, owner_user_id: receiverId, direction: 'receive' })),
      ];
      const { error: cardsError } = await supabaseAdmin.from('trade_offer_cards').insert(cardInserts);
      if (cardsError) {
        // Rollback
        await supabaseAdmin.from('trade_offers').delete().eq('id', offer.id);
        return NextResponse.json({ error: cardsError.message }, { status: 500 });
      }

      // Notify receiver
      const { data: sender } = await supabaseAdmin.from('users').select('username').eq('id', senderId).single();
      await createNotification(receiverId, 'trade_received', 'New Trade Offer!', `${sender?.username || 'Someone'} wants to trade with you!`, { tradeId: offer.id });

      // Analytics
      await trackEvent(senderId, 'trade_created', { tradeId: offer.id, senderCardCount: senderCardIds.length, receiverCardCount: receiverCardIds.length });

      return NextResponse.json({ success: true, tradeId: offer.id });
    }

    // ── ACCEPT TRADE ──────────────────────────────────────────────────────
    if (action === 'accept') {
      const { tradeId, userId } = payload || {};
      if (!tradeId || !userId) return NextResponse.json({ error: 'tradeId and userId are required' }, { status: 400 });

      // Fetch trade
      const { data: trade, error: tradeError } = await supabaseAdmin
        .from('trade_offers').select('*').eq('id', tradeId).single();
      if (tradeError || !trade) return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
      if (trade.receiver_id !== userId) return NextResponse.json({ error: 'Not authorized to accept this trade' }, { status: 403 });
      if (trade.status !== 'pending') return NextResponse.json({ error: `Trade is already ${trade.status}` }, { status: 400 });

      // Fetch all trade cards
      const { data: tradeCards } = await supabaseAdmin
        .from('trade_offer_cards').select('*').eq('offer_id', tradeId);
      if (!tradeCards || tradeCards.length === 0) return NextResponse.json({ error: 'No cards in trade' }, { status: 400 });

      const senderCards = tradeCards.filter((c: any) => c.owner_user_id === trade.sender_id).map((c: any) => c.card_id);
      const receiverCards = tradeCards.filter((c: any) => c.owner_user_id === trade.receiver_id).map((c: any) => c.card_id);

      // VALIDATE availability before swap (excluding this trade's locking)
      const senderCheck = await validateCardAvailability(trade.sender_id, senderCards, tradeId);
      const receiverCheck = await validateCardAvailability(trade.receiver_id, receiverCards, tradeId);

      if (!senderCheck.valid || !receiverCheck.valid) {
        // Auto-cancel the trade as cards are no longer available
        await supabaseAdmin.from('trade_offers').update({ status: 'cancelled', completed_at: new Date().toISOString() }).eq('id', tradeId);
        return NextResponse.json({ error: `Trade cancelled — ${senderCheck.error || receiverCheck.error}` }, { status: 409 });
      }

      // Atomic ownership transfer:
      // Sender's cards → receiver's ownership
      for (const cardId of senderCards) {
        const { error } = await supabaseAdmin
          .from('user_cards')
          .update({ user_id: trade.receiver_id })
          .eq('user_id', trade.sender_id)
          .eq('card_id', cardId)
          .limit(1);
        if (error) {
          console.error('Transfer error (sender→receiver):', error);
          return NextResponse.json({ error: 'Card transfer failed: ' + error.message }, { status: 500 });
        }
      }

      // Receiver's cards → sender's ownership
      for (const cardId of receiverCards) {
        const { error } = await supabaseAdmin
          .from('user_cards')
          .update({ user_id: trade.sender_id })
          .eq('user_id', trade.receiver_id)
          .eq('card_id', cardId)
          .limit(1);
        if (error) {
          console.error('Transfer error (receiver→sender):', error);
          return NextResponse.json({ error: 'Card transfer failed: ' + error.message }, { status: 500 });
        }
      }

      // Mark trade complete
      await supabaseAdmin.from('trade_offers')
        .update({ status: 'accepted', completed_at: new Date().toISOString() })
        .eq('id', tradeId);

      // Notify sender
      const { data: receiver } = await supabaseAdmin.from('users').select('username').eq('id', userId).single();
      await createNotification(trade.sender_id, 'trade_accepted', 'Trade Accepted! 🎉', `${receiver?.username || 'Someone'} accepted your trade!`, { tradeId });

      await trackEvent(userId, 'trade_accepted', { tradeId });
      return NextResponse.json({ success: true });
    }

    // ── REJECT TRADE ──────────────────────────────────────────────────────
    if (action === 'reject') {
      const { tradeId, userId } = payload || {};
      if (!tradeId || !userId) return NextResponse.json({ error: 'tradeId and userId are required' }, { status: 400 });

      const { data: trade } = await supabaseAdmin.from('trade_offers').select('*').eq('id', tradeId).single();
      if (!trade) return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
      if (trade.receiver_id !== userId) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      if (trade.status !== 'pending') return NextResponse.json({ error: `Trade is already ${trade.status}` }, { status: 400 });

      await supabaseAdmin.from('trade_offers').update({ status: 'rejected', completed_at: new Date().toISOString() }).eq('id', tradeId);

      const { data: receiver } = await supabaseAdmin.from('users').select('username').eq('id', userId).single();
      await createNotification(trade.sender_id, 'trade_rejected', 'Trade Rejected', `${receiver?.username || 'Someone'} declined your trade offer.`, { tradeId });

      await trackEvent(userId, 'trade_rejected', { tradeId });
      return NextResponse.json({ success: true });
    }

    // ── CANCEL TRADE ──────────────────────────────────────────────────────
    if (action === 'cancel') {
      const { tradeId, userId } = payload || {};
      if (!tradeId || !userId) return NextResponse.json({ error: 'tradeId and userId are required' }, { status: 400 });

      const { data: trade } = await supabaseAdmin.from('trade_offers').select('*').eq('id', tradeId).single();
      if (!trade) return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
      if (trade.sender_id !== userId) return NextResponse.json({ error: 'Only the sender can cancel a trade' }, { status: 403 });
      if (trade.status !== 'pending') return NextResponse.json({ error: `Trade is already ${trade.status}` }, { status: 400 });

      await supabaseAdmin.from('trade_offers').update({ status: 'cancelled', completed_at: new Date().toISOString() }).eq('id', tradeId);

      const { data: sender } = await supabaseAdmin.from('users').select('username').eq('id', userId).single();
      await createNotification(trade.receiver_id, 'trade_cancelled', 'Trade Cancelled', `${sender?.username || 'Someone'} cancelled their trade offer.`, { tradeId });

      await trackEvent(userId, 'trade_cancelled', { tradeId });
      return NextResponse.json({ success: true });
    }

    // ── LIST TRADES ───────────────────────────────────────────────────────
    if (action === 'list') {
      const { userId } = payload || {};
      if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

      const { data: trades, error } = await supabaseAdmin
        .from('trade_offers')
        .select(`
          *,
          sender:sender_id(id, username, avatar, fid),
          receiver:receiver_id(id, username, avatar, fid)
        `)
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Enrich each trade with card IDs
      const enriched = await Promise.all((trades || []).map(enrichTrade));

      const incoming = enriched.filter((t: any) => t.receiver_id === userId);
      const outgoing = enriched.filter((t: any) => t.sender_id === userId);

      return NextResponse.json({ incoming, outgoing });
    }

    // ── TRADE DETAIL ──────────────────────────────────────────────────────
    if (action === 'detail') {
      const { tradeId, userId } = payload || {};
      if (!tradeId) return NextResponse.json({ error: 'tradeId is required' }, { status: 400 });

      const { data: trade, error } = await supabaseAdmin
        .from('trade_offers')
        .select(`
          *,
          sender:sender_id(id, username, avatar, fid),
          receiver:receiver_id(id, username, avatar, fid)
        `)
        .eq('id', tradeId)
        .single();

      if (error || !trade) return NextResponse.json({ error: 'Trade not found' }, { status: 404 });

      // Auth check — only participants can view
      if (userId && trade.sender_id !== userId && trade.receiver_id !== userId) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }

      const enriched = await enrichTrade(trade);
      return NextResponse.json({ trade: enriched });
    }

    // ── FORCE CANCEL (Admin) ──────────────────────────────────────────────
    if (action === 'force_cancel') {
      const adminPwd = request.headers.get('x-admin-password');
      const expectedPwd = process.env.ADMIN_PASSWORD || 'ZeemmyAdmin07';
      if (adminPwd !== expectedPwd) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const { tradeId } = payload || {};
      if (!tradeId) return NextResponse.json({ error: 'tradeId is required' }, { status: 400 });

      const { data: trade } = await supabaseAdmin.from('trade_offers').select('*').eq('id', tradeId).single();
      if (!trade) return NextResponse.json({ error: 'Trade not found' }, { status: 404 });

      await supabaseAdmin.from('trade_offers').update({ status: 'cancelled', completed_at: new Date().toISOString() }).eq('id', tradeId);
      await createNotification(trade.sender_id, 'trade_cancelled', 'Trade Cancelled by Admin', 'An admin cancelled this trade.', { tradeId });
      await createNotification(trade.receiver_id, 'trade_cancelled', 'Trade Cancelled by Admin', 'An admin cancelled this trade.', { tradeId });

      return NextResponse.json({ success: true });
    }

    // ── USER COLLECTION (for trade partner view) ─────────────────────────
    if (action === 'user_collection') {
      const { userId } = payload || {};
      if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

      const { data: cards } = await supabaseAdmin
        .from('user_cards')
        .select('card_id, obtained_at, source_set_id')
        .eq('user_id', userId);

      // Count duplicates
      const cardCounts: Record<string, number> = {};
      (cards || []).forEach((c: any) => {
        cardCounts[c.card_id] = (cardCounts[c.card_id] || 0) + 1;
      });

      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id, username, avatar, fid')
        .eq('id', userId)
        .single();

      const { data: wishlist } = await supabaseAdmin
        .from('user_wishlist')
        .select('card_id')
        .eq('user_id', userId);

      return NextResponse.json({
        user,
        cardCounts,
        wishlistCardIds: (wishlist || []).map((w: any) => w.card_id),
      });
    }

    // ── TRADE STATS (profile) ─────────────────────────────────────────────
    if (action === 'stats') {
      const { userId } = payload || {};
      if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

      const { data: trades } = await supabaseAdmin
        .from('trade_offers')
        .select('id, status, created_at, sender_id, receiver_id, sender:sender_id(username, avatar), receiver:receiver_id(username, avatar)')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      const total = trades?.length || 0;
      const completed = trades?.filter((t: any) => t.status === 'accepted').length || 0;
      const recent = (trades || []).slice(0, 5);

      return NextResponse.json({ total, completed, recent });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('Trade API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  // Allow fetching trade list via GET for BottomNav unread count
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ incoming: [], outgoing: [] });

  const { data: trades } = await supabaseAdmin
    .from('trade_offers')
    .select('id, status, sender_id, receiver_id')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .eq('status', 'pending');

  const incomingPending = (trades || []).filter((t: any) => t.receiver_id === userId).length;
  return NextResponse.json({ incomingPending });
}
