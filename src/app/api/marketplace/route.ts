import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '@/lib/supabase';

const CARDS_FILE = path.join(process.cwd(), 'public', 'data', 'pokemon_cards.json');
const SETS_FILE = path.join(process.cwd(), 'public', 'data', 'pokemon_sets.json');

// ─── Card metadata resolution ─────────────────────────────────────────────────
let _cardMap: Map<string, any> | null = null;
let _setMap: Map<string, any> | null = null;

function getCardMap(): Map<string, any> {
  if (!_cardMap) {
    try {
      const cards = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf8'));
      _cardMap = new Map(cards.map((c: any) => [c.id, c]));
    } catch { _cardMap = new Map(); }
  }
  return _cardMap!;
}

function getSetMap(): Map<string, any> {
  if (!_setMap) {
    try {
      const sets = JSON.parse(fs.readFileSync(SETS_FILE, 'utf8'));
      _setMap = new Map(sets.map((s: any) => [s.id, s]));
    } catch { _setMap = new Map(); }
  }
  return _setMap!;
}

function resolveCards(cardIds: string[]) {
  const cardMap = getCardMap();
  return cardIds.map(id => cardMap.get(id) || { id, name: id, smallImage: '', largeImage: '' });
}

// ─── Notification helper ──────────────────────────────────────────────────────
async function notify(userId: string, type: string, title: string, body: string, data?: any) {
  try {
    await supabaseAdmin.from('notifications').insert({ user_id: userId, type, title, body, data });
  } catch (e) { console.error('Notify error:', e); }
}

// ─── Analytics helper ─────────────────────────────────────────────────────────
async function track(userId: string | null, event: string, data?: any) {
  try {
    await supabaseAdmin.from('analytics_events').insert({ user_id: userId, event, data });
  } catch (e) { console.error('Track error:', e); }
}

// ─── Ownership validation ─────────────────────────────────────────────────────
async function userOwnsCards(userId: string, cardIds: string[]): Promise<boolean> {
  if (!cardIds.length) return true;
  const { data } = await supabaseAdmin
    .from('user_cards').select('card_id').eq('user_id', userId).in('card_id', cardIds);
  const owned = new Set((data || []).map((r: any) => r.card_id));
  return cardIds.every(id => owned.has(id));
}

// ─── Enrich listing with card metadata + offer count ─────────────────────────
function enrichListing(listing: any, wishlistSet: Set<string> = new Set()) {
  const wantCards = resolveCards(listing.want_card_ids || []);
  const offerCards = resolveCards(listing.offer_card_ids || []);
  const wishlistMatch = (listing.want_card_ids || []).some((id: string) => wishlistSet.has(id));
  return { ...listing, wantCards, offerCards, wishlistMatch };
}

// ─── POST Handler ─────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, payload } = body;
    if (!action) return NextResponse.json({ error: 'Action required' }, { status: 400 });

    // ── LIST FEED ─────────────────────────────────────────────────────────────
    if (action === 'list_feed') {
      const { page = 1, limit = 20, search = '', wishlistCardIds = [], userId } = payload || {};

      let query = supabaseAdmin
        .from('marketplace_listings')
        .select(`
          *,
          user:user_id(id, username, avatar, fid),
          offer_count:marketplace_offers(count)
        `, { count: 'exact' })
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      const { data: listings, count, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const wishlistSet = new Set<string>(wishlistCardIds);
      let enriched = (listings || []).map((l: any) => ({
        ...enrichListing(l, wishlistSet),
        offerCount: l.offer_count?.[0]?.count || 0,
      }));

      // Apply search filter on card names
      if (search) {
        const q = search.toLowerCase();
        const cardMap = getCardMap();
        enriched = enriched.filter((l: any) =>
          [...(l.want_card_ids || []), ...(l.offer_card_ids || [])].some(id => {
            const card = cardMap.get(id);
            return card?.name?.toLowerCase().includes(q);
          })
        );
      }

      // Sort wishlist matches first
      if (wishlistCardIds.length > 0) {
        enriched.sort((a: any, b: any) => (b.wishlistMatch ? 1 : 0) - (a.wishlistMatch ? 1 : 0));
      }

      return NextResponse.json({
        listings: enriched,
        total: count || 0,
        page,
        totalPages: Math.ceil((count || 0) / limit),
      });
    }

    // ── CREATE LISTING ────────────────────────────────────────────────────────
    if (action === 'create_listing') {
      const { userId, wantCardIds, offerCardIds, note } = payload || {};
      if (!userId || !wantCardIds?.length || !offerCardIds?.length) {
        return NextResponse.json({ error: 'userId, wantCardIds and offerCardIds are required' }, { status: 400 });
      }

      // Validate user owns offered cards
      const ownsAll = await userOwnsCards(userId, offerCardIds);
      if (!ownsAll) return NextResponse.json({ error: 'You do not own all offered cards' }, { status: 400 });

      const { data: listing, error } = await supabaseAdmin
        .from('marketplace_listings')
        .insert({ user_id: userId, want_card_ids: wantCardIds, offer_card_ids: offerCardIds, note, status: 'active' })
        .select('*').single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await track(userId, 'listing_created', { listingId: listing.id, wantCount: wantCardIds.length, offerCount: offerCardIds.length });
      return NextResponse.json({ success: true, listing });
    }

    // ── GET LISTING ───────────────────────────────────────────────────────────
    if (action === 'get_listing') {
      const { listingId } = payload || {};
      if (!listingId) return NextResponse.json({ error: 'listingId required' }, { status: 400 });

      const { data: listing, error } = await supabaseAdmin
        .from('marketplace_listings')
        .select(`*, user:user_id(id, username, avatar, fid)`)
        .eq('id', listingId).single();
      if (error || !listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });

      const { data: offers } = await supabaseAdmin
        .from('marketplace_offers')
        .select(`*, offerer:offerer_user_id(id, username, avatar, fid)`)
        .eq('listing_id', listingId)
        .order('created_at', { ascending: false });

      const enrichedOffers = (offers || []).map((o: any) => ({
        ...o,
        offerCards: resolveCards(o.offer_card_ids || []),
        wantCards: resolveCards(o.want_card_ids || []),
      }));

      return NextResponse.json({ listing: enrichListing(listing), offers: enrichedOffers });
    }

    // ── CANCEL LISTING ────────────────────────────────────────────────────────
    if (action === 'cancel_listing') {
      const { listingId, userId } = payload || {};
      if (!listingId || !userId) return NextResponse.json({ error: 'listingId and userId required' }, { status: 400 });

      const { data: listing } = await supabaseAdmin.from('marketplace_listings').select('*').eq('id', listingId).single();
      if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
      if (listing.user_id !== userId) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      if (listing.status !== 'active') return NextResponse.json({ error: `Listing is already ${listing.status}` }, { status: 400 });

      await supabaseAdmin.from('marketplace_listings').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', listingId);

      // Notify pending offerers
      const { data: pendingOffers } = await supabaseAdmin.from('marketplace_offers')
        .select('offerer_user_id').eq('listing_id', listingId).eq('status', 'pending');
      for (const offer of (pendingOffers || [])) {
        await notify(offer.offerer_user_id, 'offer_rejected', 'Listing Cancelled', 'A listing you made an offer on was cancelled.', { listingId });
      }
      await supabaseAdmin.from('marketplace_offers').update({ status: 'rejected' }).eq('listing_id', listingId).eq('status', 'pending');

      return NextResponse.json({ success: true });
    }

    // ── CREATE OFFER ──────────────────────────────────────────────────────────
    if (action === 'create_offer') {
      const { listingId, offererId, offerCardIds, wantCardIds, note } = payload || {};
      if (!listingId || !offererId || !offerCardIds?.length || !wantCardIds?.length) {
        return NextResponse.json({ error: 'listingId, offererId, offerCardIds and wantCardIds required' }, { status: 400 });
      }

      const { data: listing } = await supabaseAdmin.from('marketplace_listings').select('*').eq('id', listingId).single();
      if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
      if (listing.status !== 'active') return NextResponse.json({ error: 'Listing is no longer active' }, { status: 400 });
      if (listing.user_id === offererId) return NextResponse.json({ error: 'Cannot offer on your own listing' }, { status: 400 });

      // Check offerer doesn't already have a pending offer
      const { data: existingOffer } = await supabaseAdmin.from('marketplace_offers')
        .select('id').eq('listing_id', listingId).eq('offerer_user_id', offererId).eq('status', 'pending').maybeSingle();
      if (existingOffer) return NextResponse.json({ error: 'You already have a pending offer on this listing' }, { status: 400 });

      // Validate offerer owns their cards
      const ownsAll = await userOwnsCards(offererId, offerCardIds);
      if (!ownsAll) return NextResponse.json({ error: 'You do not own all offered cards' }, { status: 400 });

      const { data: offer, error } = await supabaseAdmin.from('marketplace_offers')
        .insert({ listing_id: listingId, offerer_user_id: offererId, offer_card_ids: offerCardIds, want_card_ids: wantCardIds, note, status: 'pending' })
        .select('*').single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Notify listing owner
      const { data: offerer } = await supabaseAdmin.from('users').select('username').eq('id', offererId).single();
      await notify(listing.user_id, 'new_offer', 'New Offer on Your Listing! 🎴', `${offerer?.username || 'Someone'} made an offer on your listing.`, { listingId, offerId: offer.id });
      await track(offererId, 'offer_created', { listingId, offerId: offer.id });

      return NextResponse.json({ success: true, offerId: offer.id });
    }

    // ── ACCEPT OFFER ──────────────────────────────────────────────────────────
    if (action === 'accept_offer') {
      const { offerId, userId } = payload || {};
      if (!offerId || !userId) return NextResponse.json({ error: 'offerId and userId required' }, { status: 400 });

      const { data: offer } = await supabaseAdmin.from('marketplace_offers').select('*').eq('id', offerId).single();
      if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
      if (offer.status !== 'pending') return NextResponse.json({ error: `Offer is already ${offer.status}` }, { status: 400 });

      const { data: listing } = await supabaseAdmin.from('marketplace_listings').select('*').eq('id', offer.listing_id).single();
      if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
      if (listing.user_id !== userId) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      if (listing.status !== 'active') return NextResponse.json({ error: 'Listing is no longer active' }, { status: 400 });

      // Validate ownership before transfer
      const listerOwns = await userOwnsCards(listing.user_id, offer.want_card_ids);
      const offererOwns = await userOwnsCards(offer.offerer_user_id, offer.offer_card_ids);

      if (!listerOwns || !offererOwns) {
        // Auto-cancel listing — cards no longer available
        await supabaseAdmin.from('marketplace_listings').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', listing.id);
        return NextResponse.json({ error: 'Trade failed — one or more cards are no longer available. Listing cancelled.' }, { status: 409 });
      }

      // Transfer cards: lister's wanted cards → offerer
      for (const cardId of offer.want_card_ids) {
        await supabaseAdmin.from('user_cards')
          .update({ user_id: offer.offerer_user_id })
          .eq('user_id', listing.user_id).eq('card_id', cardId).limit(1);
      }

      // Transfer cards: offerer's cards → lister
      for (const cardId of offer.offer_card_ids) {
        await supabaseAdmin.from('user_cards')
          .update({ user_id: listing.user_id })
          .eq('user_id', offer.offerer_user_id).eq('card_id', cardId).limit(1);
      }

      // Mark offer accepted, listing completed
      await supabaseAdmin.from('marketplace_offers').update({ status: 'accepted' }).eq('id', offerId);
      await supabaseAdmin.from('marketplace_listings').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', listing.id);

      // Auto-reject all other pending offers
      const { data: otherOffers } = await supabaseAdmin.from('marketplace_offers')
        .select('id, offerer_user_id').eq('listing_id', listing.id).eq('status', 'pending').neq('id', offerId);
      for (const other of (otherOffers || [])) {
        await supabaseAdmin.from('marketplace_offers').update({ status: 'rejected' }).eq('id', other.id);
        await notify(other.offerer_user_id, 'offer_rejected', 'Offer Not Selected', 'The listing owner chose a different offer.', { listingId: listing.id });
      }

      // Notify accepted offerer
      const { data: lister } = await supabaseAdmin.from('users').select('username').eq('id', listing.user_id).single();
      await notify(offer.offerer_user_id, 'offer_accepted', 'Offer Accepted! 🎉', `${lister?.username || 'Someone'} accepted your marketplace offer!`, { listingId: listing.id, offerId });
      await track(userId, 'offer_accepted', { listingId: listing.id, offerId });

      return NextResponse.json({ success: true });
    }

    // ── REJECT OFFER ──────────────────────────────────────────────────────────
    if (action === 'reject_offer') {
      const { offerId, userId } = payload || {};
      if (!offerId || !userId) return NextResponse.json({ error: 'offerId and userId required' }, { status: 400 });

      const { data: offer } = await supabaseAdmin.from('marketplace_offers').select('*').eq('id', offerId).single();
      if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
      if (offer.status !== 'pending') return NextResponse.json({ error: `Offer is ${offer.status}` }, { status: 400 });

      const { data: listing } = await supabaseAdmin.from('marketplace_listings').select('user_id').eq('id', offer.listing_id).single();
      if (listing?.user_id !== userId) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

      await supabaseAdmin.from('marketplace_offers').update({ status: 'rejected' }).eq('id', offerId);
      await notify(offer.offerer_user_id, 'offer_rejected', 'Offer Rejected', 'Your marketplace offer was declined.', { listingId: offer.listing_id, offerId });
      await track(userId, 'offer_rejected', { listingId: offer.listing_id, offerId });

      return NextResponse.json({ success: true });
    }

    // ── REPORT LISTING ────────────────────────────────────────────────────────
    if (action === 'report_listing') {
      const { listingId, reporterUserId, reason } = payload || {};
      if (!listingId || !reporterUserId || !reason) {
        return NextResponse.json({ error: 'listingId, reporterUserId and reason required' }, { status: 400 });
      }
      const { error } = await supabaseAdmin.from('marketplace_reports').insert({ listing_id: listingId, reporter_user_id: reporterUserId, reason });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // ── MY LISTINGS ───────────────────────────────────────────────────────────
    if (action === 'my_listings') {
      const { userId } = payload || {};
      if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

      const { data: listings, error } = await supabaseAdmin
        .from('marketplace_listings')
        .select(`*, offer_count:marketplace_offers(count)`)
        .eq('user_id', userId).order('created_at', { ascending: false });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const enriched = (listings || []).map((l: any) => ({
        ...enrichListing(l),
        offerCount: l.offer_count?.[0]?.count || 0,
        pendingOfferCount: 0, // resolved below
      }));

      return NextResponse.json({ listings: enriched });
    }

    // ── MY OFFERS ─────────────────────────────────────────────────────────────
    if (action === 'my_offers') {
      const { userId } = payload || {};
      if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

      const { data: offers, error } = await supabaseAdmin
        .from('marketplace_offers')
        .select(`*, listing:listing_id(*, user:user_id(id, username, avatar))`)
        .eq('offerer_user_id', userId).order('created_at', { ascending: false });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const enriched = (offers || []).map((o: any) => ({
        ...o,
        offerCards: resolveCards(o.offer_card_ids || []),
        wantCards: resolveCards(o.want_card_ids || []),
        listing: o.listing ? enrichListing(o.listing) : null,
      }));

      return NextResponse.json({ offers: enriched });
    }

    // ── ADMIN: LIST ALL + REPORTS ─────────────────────────────────────────────
    if (action === 'admin_listings') {
      const adminPwd = request.headers.get('x-admin-password');
      if (adminPwd !== (process.env.ADMIN_PASSWORD || 'ZeemmyAdmin07')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const { page = 1, limit = 50, status } = payload || {};
      let query = supabaseAdmin
        .from('marketplace_listings')
        .select(`*, user:user_id(id, username, avatar), offer_count:marketplace_offers(count)`)
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);
      if (status) query = query.eq('status', status);
      const { data: listings, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const { data: reports } = await supabaseAdmin
        .from('marketplace_reports')
        .select(`*, reporter:reporter_user_id(username), listing:listing_id(*)`)
        .eq('resolved', false).order('created_at', { ascending: false });

      const { count: totalActive } = await supabaseAdmin
        .from('marketplace_listings').select('*', { count: 'exact', head: true }).eq('status', 'active');
      const { count: totalOffers } = await supabaseAdmin
        .from('marketplace_offers').select('*', { count: 'exact', head: true });

      return NextResponse.json({
        listings: (listings || []).map((l: any) => ({ ...enrichListing(l), offerCount: l.offer_count?.[0]?.count || 0 })),
        reports: reports || [],
        stats: { totalActive: totalActive || 0, totalOffers: totalOffers || 0, unresolvedReports: (reports || []).length },
      });
    }

    // ── ADMIN: REMOVE LISTING ─────────────────────────────────────────────────
    if (action === 'admin_remove_listing') {
      const adminPwd = request.headers.get('x-admin-password');
      if (adminPwd !== (process.env.ADMIN_PASSWORD || 'ZeemmyAdmin07')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const { listingId } = payload || {};
      if (!listingId) return NextResponse.json({ error: 'listingId required' }, { status: 400 });

      const { data: listing } = await supabaseAdmin.from('marketplace_listings').select('user_id').eq('id', listingId).single();
      await supabaseAdmin.from('marketplace_listings').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', listingId);
      if (listing) await notify(listing.user_id, 'listing_removed', 'Listing Removed', 'Your marketplace listing was removed by an admin.', { listingId });

      return NextResponse.json({ success: true });
    }

    // ── ADMIN: RESOLVE REPORT ─────────────────────────────────────────────────
    if (action === 'admin_resolve_report') {
      const adminPwd = request.headers.get('x-admin-password');
      if (adminPwd !== (process.env.ADMIN_PASSWORD || 'ZeemmyAdmin07')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const { reportId } = payload || {};
      if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 });
      await supabaseAdmin.from('marketplace_reports').update({ resolved: true }).eq('id', reportId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('Marketplace API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// ─── GET: lightweight pending offer count for badge ───────────────────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ pendingOffers: 0 });

  // Count pending offers on user's active listings
  const { data: listings } = await supabaseAdmin
    .from('marketplace_listings').select('id').eq('user_id', userId).eq('status', 'active');
  const listingIds = (listings || []).map((l: any) => l.id);
  if (!listingIds.length) return NextResponse.json({ pendingOffers: 0 });

  const { count } = await supabaseAdmin
    .from('marketplace_offers').select('*', { count: 'exact', head: true })
    .in('listing_id', listingIds).eq('status', 'pending');

  return NextResponse.json({ pendingOffers: count || 0 });
}
