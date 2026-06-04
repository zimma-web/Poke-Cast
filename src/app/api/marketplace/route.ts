import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '@/lib/supabase';
import { getBaseUSDCBalance, verifyBaseUSDCTransfer, verifyBaseETHTransfer } from '@/lib/web3';
import { sendUSDCFromTreasury } from '@/lib/treasury';

const CARDS_FILE = path.join(process.cwd(), 'public', 'data', 'pokemon_cards.json');
const SETS_FILE = path.join(process.cwd(), 'public', 'data', 'pokemon_sets.json');
const TREASURY_ADDRESS = '0xe251A3a0D23859157ef8041394279f7Ba46C90e3';

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

function resolveCard(cardId: string) {
  const cardMap = getCardMap();
  return cardMap.get(cardId) || { id: cardId, name: cardId, smallImage: '', largeImage: '' };
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

// ─── Cards locked in active P2P trades & WTB offers ───────────────────────────
async function getLockedCardIdsInTrades(userId: string): Promise<Record<string, number>> {
  const { data: pendingOffers } = await supabaseAdmin
    .from('trade_offers')
    .select('id')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .eq('status', 'pending');

  const counts: Record<string, number> = {};

  if (pendingOffers && pendingOffers.length > 0) {
    const offerIds = pendingOffers.map((o: any) => o.id);
    const { data: lockedCards } = await supabaseAdmin
      .from('trade_offer_cards')
      .select('card_id')
      .eq('owner_user_id', userId)
      .in('offer_id', offerIds);

    (lockedCards || []).forEach((c: any) => {
      counts[c.card_id] = (counts[c.card_id] || 0) + 1;
    });
  }

  // Count cards locked in active pending WTB request offers
  try {
    const { data: wtbOffers } = await supabaseAdmin
      .from('card_request_offers')
      .select('user_card_id')
      .eq('seller_id', userId)
      .eq('status', 'pending');

    if (wtbOffers && wtbOffers.length > 0) {
      const userCardIds = wtbOffers.map((o: any) => o.user_card_id);
      const { data: userCards } = await supabaseAdmin
        .from('user_cards')
        .select('card_id')
        .in('id', userCardIds);

      (userCards || []).forEach((c: any) => {
        counts[c.card_id] = (counts[c.card_id] || 0) + 1;
      });
    }
  } catch (e) {
    console.error('Failed to get WTB locked cards:', e);
  }

  return counts;
}

// ─── Expired auctions background processor ───────────────────────────────────
async function processExpiredAuctions() {
  try {
    const now = new Date().toISOString();
    
    // 1. Process active auctions that reached their end_at time
    const { data: expired } = await supabaseAdmin
      .from('auctions')
      .select('*')
      .eq('status', 'active')
      .lte('end_at', now);

    if (expired && expired.length > 0) {
      for (const auction of expired) {
        if (auction.highest_bidder_id && auction.highest_bid > 0) {
          // The Treasury already holds the funds!
          // Payout to seller (98%)
          const payoutAmount = auction.highest_bid * 0.98;
          const { data: seller } = await supabaseAdmin.from('users').select('wallet_address').eq('id', auction.seller_id).single();
          if (seller?.wallet_address) {
            // Transfer USDC to seller
            const isMock = auction.tx_hash?.startsWith('0xmock') || (process.env.NODE_ENV !== 'production' && auction.tx_hash?.includes('mock'));
            if (!isMock) {
               sendUSDCFromTreasury(seller.wallet_address, payoutAmount).catch(err => console.error("Payout error:", err));
            }
          }

          // Transfer card to winner immediately
          await supabaseAdmin
            .from('user_cards')
            .update({ user_id: auction.highest_bidder_id })
            .eq('id', auction.user_card_id);

          if (auction.additional_user_card_ids && auction.additional_user_card_ids.length > 0) {
            await supabaseAdmin
              .from('user_cards')
              .update({ user_id: auction.highest_bidder_id })
              .in('id', auction.additional_user_card_ids);
          }

          // Transition to completed
          await supabaseAdmin
            .from('auctions')
            .update({ status: 'completed' })
            .eq('id', auction.id);

          await notify(
            auction.highest_bidder_id,
            'auction_won',
            'Auction Won! 🏆',
            `You won the auction for card ${resolveCard(auction.card_id).name}! The card has been automatically transferred to your collection.`,
            { auctionId: auction.id }
          );

          await notify(
            auction.seller_id,
            'auction_completed',
            'Auction Completed 🪙',
            `Your auction for card ${resolveCard(auction.card_id).name} ended. ${payoutAmount.toFixed(2)} USDC has been sent to your wallet.`,
            { auctionId: auction.id }
          );
        } else {
          // No bids. Close as expired.
          await supabaseAdmin
            .from('auctions')
            .update({ status: 'expired' })
            .eq('id', auction.id);

          await notify(
            auction.seller_id,
            'auction_expired',
            'Auction Expired ⏳',
            `Your auction for card ${resolveCard(auction.card_id).name} expired with no bids.`,
            { auctionId: auction.id }
          );
        }
      }
    }


  } catch (e) {
    console.error('Error processing expired auctions:', e);
  }
}

// ─── enrich auction listing with card metadata ──────────────────────────────
function enrichAuction(auction: any, wishlistSet: Set<string> = new Set()) {
  const card = resolveCard(auction.card_id);
  const wishlistMatch = wishlistSet.has(auction.card_id);
  
  let additionalCards = [];
  if (auction.additional_card_ids && Array.isArray(auction.additional_card_ids)) {
    additionalCards = auction.additional_card_ids.map((id: string) => resolveCard(id));
  }
  
  return { ...auction, card, additionalCards, wishlistMatch };
}

// ─── POST Handler ─────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, payload } = body;
    if (!action) return NextResponse.json({ error: 'Action required' }, { status: 400 });

    // Process expired auctions before handling feed/listing queries
    await processExpiredAuctions();

    // ── LIST FEED ─────────────────────────────────────────────────────────────
    if (action === 'list_feed') {
      const { page = 1, limit = 20, search = '', wishlistCardIds = [], userId } = payload || {};

      let query = supabaseAdmin
        .from('auctions')
        .select(`
          *,
          seller:seller_id(id, username, avatar, fid, wallet_address, is_hidden)
        `, { count: 'exact' })
        .eq('status', 'active')
        .order('end_at', { ascending: true }) // ending soonest first
        .range((page - 1) * limit, page * limit - 1);

      if (userId) {
        query = query.neq('seller_id', userId); // hide own auctions from feed
      }

      const { data: rawAuctions, count, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Filter out auctions where seller is hidden
      const activeAuctions = (rawAuctions || []).filter((a: any) => !a.seller || !a.seller.is_hidden);

      const wishlistSet = new Set<string>(wishlistCardIds);
      let enriched = activeAuctions.map((a: any) => enrichAuction(a, wishlistSet));

      // Search filter
      if (search) {
        const q = search.toLowerCase();
        enriched = enriched.filter((a: any) => a.card?.name?.toLowerCase().includes(q));
      }

      // Sort wishlist matches first
      if (wishlistCardIds.length > 0) {
        enriched.sort((a: any, b: any) => (b.wishlistMatch ? 1 : 0) - (a.wishlistMatch ? 1 : 0));
      }

      return NextResponse.json({
        auctions: enriched,
        total: count || 0,
        page,
        totalPages: Math.ceil((count || 0) / limit),
      });
    }

    // ── CREATE AUCTION ────────────────────────────────────────────────────────
    if (action === 'create_auction') {
      const { userId, cardId, cardIds, startPrice, buyoutPrice, durationHours, listingTxHash } = payload || {};
      
      if (!userId || (!cardId && (!cardIds || cardIds.length === 0)) || !startPrice) {
        return NextResponse.json({ error: 'userId, cardId/cardIds, and startPrice are required' }, { status: 400 });
      }

      const parsedStart = parseFloat(startPrice);
      const parsedBuyout = buyoutPrice ? parseFloat(buyoutPrice) : null;

      if (isNaN(parsedStart) || parsedStart < 0.01) {
        return NextResponse.json({ error: 'Start price must be at least 0.01 USDC' }, { status: 400 });
      }
      if (parsedBuyout !== null && (isNaN(parsedBuyout) || parsedBuyout <= parsedStart)) {
        return NextResponse.json({ error: 'Buyout price must be greater than start price' }, { status: 400 });
      }

      // Fetch user's wallet address to ensure they have one
      const { data: seller } = await supabaseAdmin.from('users').select('wallet_address').eq('id', userId).single();
      if (!seller?.wallet_address) {
        return NextResponse.json({ error: 'Farcaster wallet address is required to sell cards' }, { status: 400 });
      }

      // Verify listing fee on-chain if buyout price is set
      if (parsedBuyout !== null && parsedBuyout > 0) {
        if (!listingTxHash) {
          return NextResponse.json({ error: 'Listing fee transaction hash is required for auctions with a buyout price' }, { status: 400 });
        }
        
        // Verify listing tx hash isn't already processed to prevent replay
        const { data: duplicateListing } = await supabaseAdmin
          .from('auctions')
          .select('id')
          .eq('listing_tx_hash', listingTxHash)
          .maybeSingle();

        if (duplicateListing) {
          return NextResponse.json({ error: 'This listing transaction hash has already been processed' }, { status: 400 });
        }

        const isMock = listingTxHash.startsWith('0xmock') || process.env.NODE_ENV !== 'production' && listingTxHash.includes('mock');
        let isListingTxValid = false;
        if (isMock) {
          isListingTxValid = true;
        } else {
          // 0.000016 ETH native transfer to TREASURY_ADDRESS
          isListingTxValid = await verifyBaseETHTransfer(listingTxHash, seller.wallet_address, TREASURY_ADDRESS, 0.000016);
        }

        if (!isListingTxValid) {
          return NextResponse.json({ error: 'Listing fee verification failed. Ensure you paid 0.000016 ETH on Base to the treasury.' }, { status: 400 });
        }
      }

      const listCardIds: string[] = cardIds && Array.isArray(cardIds) ? cardIds : [cardId];
      if (listCardIds.length > 5) {
        return NextResponse.json({ error: 'You can list a maximum of 5 cards in a single auction' }, { status: 400 });
      }

      // Count frequency of each card ID requested
      const cardCounts: Record<string, number> = {};
      for (const id of listCardIds) {
        cardCounts[id] = (cardCounts[id] || 0) + 1;
      }

      const lockedTradeCounts = await getLockedCardIdsInTrades(userId);
      const pool: Record<string, string[]> = {};

      for (const [id, countNeeded] of Object.entries(cardCounts)) {
        // Fetch all copies owned by user
        const { data: ownedCopies } = await supabaseAdmin
          .from('user_cards')
          .select('id')
          .eq('user_id', userId)
          .eq('card_id', id);

        if (!ownedCopies || ownedCopies.length < countNeeded) {
          return NextResponse.json({ error: `You do not own enough copies of card ${id}` }, { status: 400 });
        }

        // Fetch card copies currently listed in active/pending auctions
        const { data: activeAuctions } = await supabaseAdmin
          .from('auctions')
          .select('user_card_id, additional_user_card_ids')
          .eq('seller_id', userId)
          .in('status', ['active', 'pending_payment']);

        const listedCardIds = new Set<string>();
        if (activeAuctions) {
          for (const a of activeAuctions) {
            if (a.user_card_id) listedCardIds.add(a.user_card_id);
            if (a.additional_user_card_ids && Array.isArray(a.additional_user_card_ids)) {
              for (const addId of a.additional_user_card_ids) {
                listedCardIds.add(addId);
              }
            }
          }
        }

        // Fetch card copies offered in active WTB offers
        try {
          const { data: activeWTBOffers } = await supabaseAdmin
            .from('card_request_offers')
            .select('user_card_id')
            .eq('seller_id', userId)
            .eq('status', 'pending');

          if (activeWTBOffers) {
            for (const o of activeWTBOffers) {
              if (o.user_card_id) listedCardIds.add(o.user_card_id);
            }
          }
        } catch (e) {
          console.error('Failed to check WTB active offers for listing:', e);
        }

        const unlistedCopies = ownedCopies.filter(c => !listedCardIds.has(c.id));
        const lockedInTradesCount = lockedTradeCounts[id] || 0;
        
        if (unlistedCopies.length - lockedInTradesCount < countNeeded) {
          return NextResponse.json({ error: `Not enough unlocked copies of card ${id}` }, { status: 400 });
        }

        const availableCopies = unlistedCopies.slice(lockedInTradesCount);
        pool[id] = availableCopies.slice(0, countNeeded).map(c => c.id);
      }

      // Map listCardIds to their specific userCardIds in order
      const selectedUserCardIds = listCardIds.map(id => pool[id].pop() as string);

      const mainUserCardId = selectedUserCardIds[0];
      const additionalUserCardIds = selectedUserCardIds.slice(1);
      const selectedMainCardId = listCardIds[0];
      const additionalCardIds = listCardIds.slice(1);

      // Insert auction record
      const endAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
      const { data: auction, error } = await supabaseAdmin
        .from('auctions')
        .insert({
          seller_id: userId,
          user_card_id: mainUserCardId,
          card_id: selectedMainCardId,
          start_price: parsedStart,
          buyout_price: parsedBuyout,
          highest_bid: 0,
          highest_bidder_id: null,
          status: 'active',
          end_at: endAt,
          listing_tx_hash: listingTxHash,
          additional_user_card_ids: additionalUserCardIds.length > 0 ? additionalUserCardIds : null,
          additional_card_ids: additionalCardIds.length > 0 ? additionalCardIds : null
        })
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await track(userId, 'auction_created', { auctionId: auction.id, cardId, startPrice: parsedStart, buyoutPrice: parsedBuyout });

      // Award +1 PokePoint for marketplace listing
      try {
        const { awardPoints } = await import('@/lib/pokepoints');
        await awardPoints(userId, 'marketplace_listing', 1, auction.id, { cardId });
      } catch (e) {
        console.error('Failed to award PokePoints for marketplace listing:', e);
      }

      // Increment create_auction quest progress
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const { data: questRow } = await supabaseAdmin
          .from('user_quests')
          .select('*')
          .eq('user_id', userId)
          .eq('quest_id', 'create_auction')
          .eq('day', todayStr)
          .maybeSingle();

        if (questRow) {
          await supabaseAdmin
            .from('user_quests')
            .update({ progress: Math.min(questRow.target, questRow.progress + 1) })
            .eq('user_id', userId)
            .eq('quest_id', 'create_auction')
            .eq('day', todayStr);
        } else {
          await supabaseAdmin
            .from('user_quests')
            .insert({
              user_id: userId,
              quest_id: 'create_auction',
              progress: 1,
              target: 1,
              claimed: false,
              day: todayStr
            });
        }
      } catch (e) {
        console.error('Failed to update create_auction quest:', e);
      }

      return NextResponse.json({ success: true, auction });
    }

    // ── PLACE BID ─────────────────────────────────────────────────────────────
    if (action === 'place_bid') {
      const { auctionId, bidderId, amount, txHash } = payload || {};
      if (!auctionId || !bidderId || !amount || !txHash) {
        return NextResponse.json({ error: 'auctionId, bidderId, amount, and txHash are required' }, { status: 400 });
      }

      const bidAmount = parseFloat(amount);
      if (isNaN(bidAmount) || bidAmount < 0.01) {
        return NextResponse.json({ error: 'Bid amount must be at least 0.01 USDC' }, { status: 400 });
      }

      // Prevent replay attacks (check if tx_hash was already used in any auction)
      const { data: duplicateTx } = await supabaseAdmin.from('auctions').select('id').eq('tx_hash', txHash).maybeSingle();
      if (duplicateTx) {
        return NextResponse.json({ error: 'This transaction hash has already been processed' }, { status: 400 });
      }

      // Fetch bidder's wallet
      const { data: bidder } = await supabaseAdmin.from('users').select('wallet_address').eq('id', bidderId).single();
      if (!bidder?.wallet_address) {
        return NextResponse.json({ error: 'Farcaster wallet must be connected to bid' }, { status: 400 });
      }

      // Verify on-chain transfer to Treasury
      const isMock = txHash.startsWith('0xmock') || (process.env.NODE_ENV !== 'production' && txHash.includes('mock'));
      let isTxValid = false;
      if (isMock) {
        isTxValid = true;
      } else {
        isTxValid = await verifyBaseUSDCTransfer(txHash, bidder.wallet_address, TREASURY_ADDRESS, bidAmount);
      }

      if (!isTxValid) {
        return NextResponse.json({ error: 'Transaction validation failed. Ensure the deposit to Treasury was successful.' }, { status: 400 });
      }

      // Helper to refund invalid bids instantly
      const refundInvalidBid = async (reason: string) => {
        if (!isMock) await sendUSDCFromTreasury(bidder.wallet_address, bidAmount);
        return NextResponse.json({ error: `${reason} Your deposit of ${bidAmount.toFixed(2)} USDC has been refunded.` }, { status: 400 });
      };

      // Fetch auction details
      const { data: auction } = await supabaseAdmin.from('auctions').select('*').eq('id', auctionId).single();
      if (!auction) return await refundInvalidBid('Auction not found.');
      if (auction.status !== 'active') return await refundInvalidBid('Auction is no longer active.');
      if (auction.seller_id === bidderId) return await refundInvalidBid('You cannot bid on your own auction.');

      // Check end time
      if (new Date(auction.end_at).getTime() <= Date.now()) {
        return await refundInvalidBid('Auction has already ended.');
      }

      // Verify bid is higher than starting price / current highest bid
      const minRequired = auction.highest_bid > 0 ? auction.highest_bid + 0.01 : auction.start_price;
      if (bidAmount < minRequired) {
        return await refundInvalidBid(`Bid must be at least ${minRequired.toFixed(2)} USDC.`);
      }

      // Check buyout threshold
      if (auction.buyout_price && bidAmount >= auction.buyout_price) {
        return await refundInvalidBid('Bid exceeds or meets buyout price. Use Buyout instead.');
      }

      const previousBidderId = auction.highest_bidder_id;
      const previousBid = auction.highest_bid;

      // Update auction
      const { data: updatedAuction, error: updateError } = await supabaseAdmin
        .from('auctions')
        .update({
          highest_bid: bidAmount,
          highest_bidder_id: bidderId,
          tx_hash: txHash
        })
        .eq('id', auctionId)
        .select('*')
        .single();

      if (updateError) {
        if (!isMock) await sendUSDCFromTreasury(bidder.wallet_address, bidAmount);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // Record bid
      await supabaseAdmin.from('auction_bids').insert({
        auction_id: auctionId,
        bidder_id: bidderId,
        amount: bidAmount
      });

      // Send notifications
      const cardName = resolveCard(auction.card_id).name;
      
      // Automatically refund the previous highest bidder
      if (previousBidderId && previousBid > 0 && previousBidderId !== bidderId) {
        const { data: prevBidder } = await supabaseAdmin.from('users').select('wallet_address').eq('id', previousBidderId).single();
        if (prevBidder?.wallet_address) {
          if (!isMock) sendUSDCFromTreasury(prevBidder.wallet_address, previousBid).catch(err => console.error("Refund error:", err));
        }
        await notify(previousBidderId, 'outbid', 'You\'ve been outbid! ⏳', `Someone placed a higher bid on ${cardName}. Your ${previousBid.toFixed(2)} USDC deposit has been refunded.`, { auctionId });
      }

      // Notify seller
      const { data: bidderUser } = await supabaseAdmin.from('users').select('username').eq('id', bidderId).single();
      await notify(auction.seller_id, 'new_bid', 'New Bid! 🪙', `${bidderUser?.username || 'Someone'} bid ${bidAmount.toFixed(2)} USDC on your card ${cardName}.`, { auctionId });

      await track(bidderId, 'bid_placed', { auctionId, amount: bidAmount });

      // Increment place_bid quest progress
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const { data: questRow } = await supabaseAdmin
          .from('user_quests')
          .select('*')
          .eq('user_id', bidderId)
          .eq('quest_id', 'place_bid')
          .eq('day', todayStr)
          .maybeSingle();

        if (questRow) {
          await supabaseAdmin
            .from('user_quests')
            .update({ progress: Math.min(questRow.target, questRow.progress + 1) })
            .eq('user_id', bidderId)
            .eq('quest_id', 'place_bid')
            .eq('day', todayStr);
        } else {
          await supabaseAdmin
            .from('user_quests')
            .insert({
              user_id: bidderId,
              quest_id: 'place_bid',
              progress: 1,
              target: 1,
              claimed: false,
              day: todayStr
            });
        }
      } catch (e) {
        console.error('Failed to update place_bid quest:', e);
      }

      return NextResponse.json({ success: true, auction: enrichAuction(updatedAuction) });
    }

    // ── VERIFY ON-CHAIN PAYMENT (Buyout or Auction Claim) ────────────────────────
    if (action === 'verify_payment') {
      const { auctionId, txHash, userId } = payload || {};
      if (!auctionId || !txHash || !userId) {
        return NextResponse.json({ error: 'auctionId, txHash, and userId are required' }, { status: 400 });
      }

      // Fetch auction
      const { data: auction } = await supabaseAdmin.from('auctions').select('*').eq('id', auctionId).single();
      if (!auction) return NextResponse.json({ error: 'Auction not found' }, { status: 404 });

      // Must be active (for buyout) or pending_payment (for auction claim)
      if (auction.status !== 'active' && auction.status !== 'pending_payment') {
        return NextResponse.json({ error: 'Auction is not in a payable state' }, { status: 400 });
      }

      const isBuyout = auction.status === 'active';
      if (isBuyout) {
        if (!auction.buyout_price) return NextResponse.json({ error: 'Buyout not enabled for this auction' }, { status: 400 });
        if (auction.seller_id === userId) return NextResponse.json({ error: 'Cannot buy out your own card' }, { status: 400 });
      } else {
        // Claiming pending payment
        if (auction.highest_bidder_id !== userId) {
          return NextResponse.json({ error: 'Only the winning bidder can claim this card' }, { status: 403 });
        }
      }

      // Check if tx hash is already used in DB to prevent replay attacks
      const { data: duplicateTx } = await supabaseAdmin.from('auctions').select('id').eq('tx_hash', txHash).maybeSingle();
      if (duplicateTx) {
        return NextResponse.json({ error: 'This transaction hash has already been processed' }, { status: 400 });
      }

      // Fetch addresses of buyer and seller
      const { data: buyer } = await supabaseAdmin.from('users').select('wallet_address').eq('id', userId).single();
      const { data: seller } = await supabaseAdmin.from('users').select('wallet_address').eq('id', auction.seller_id).single();

      if (!buyer?.wallet_address || !seller?.wallet_address) {
        return NextResponse.json({ error: 'Wallet addresses are missing for this trade' }, { status: 400 });
      }

      const expectedUSDC = isBuyout ? auction.buyout_price : auction.highest_bid;

      // Call Web3 helper to verify tx on-chain
      let isTxValid = false;
      const isMock = txHash.startsWith('0xmock') || process.env.NODE_ENV !== 'production' && txHash.includes('mock');
      if (isMock) {
        isTxValid = true;
      } else {
        const hashes = txHash.split(',');
        if (hashes.length === 2) {
          const sellerAmount = expectedUSDC * 0.98;
          const treasuryAmount = expectedUSDC * 0.02;
          
          const isSellerTxValid = await verifyBaseUSDCTransfer(hashes[0], buyer.wallet_address, seller.wallet_address, sellerAmount);
          const isTreasuryTxValid = await verifyBaseUSDCTransfer(hashes[1], buyer.wallet_address, TREASURY_ADDRESS, treasuryAmount);
          
          isTxValid = isSellerTxValid && isTreasuryTxValid;
        } else {
          isTxValid = await verifyBaseUSDCTransfer(txHash, buyer.wallet_address, seller.wallet_address, expectedUSDC);
        }
      }

      if (!isTxValid) {
        return NextResponse.json({ error: 'Transaction validation failed. Ensure the transactions are confirmed on Base, matching the split price (98% seller, 2% fee) and correct recipients.' }, { status: 400 });
      }

      // Check if card is still owned by the seller
      const { data: cardRow } = await supabaseAdmin
        .from('user_cards')
        .select('*')
        .eq('id', auction.user_card_id)
        .eq('user_id', auction.seller_id)
        .maybeSingle();

      if (!cardRow) {
        // Seller no longer owns the card. Cancel the auction.
        await supabaseAdmin.from('auctions').update({ status: 'cancelled' }).eq('id', auctionId);
        return NextResponse.json({ error: 'Card transfer failed — seller no longer owns the card. Auction cancelled.' }, { status: 409 });
      }

      // Check if seller still owns additional cards
      if (auction.additional_user_card_ids && auction.additional_user_card_ids.length > 0) {
        const { data: additionalCardRows } = await supabaseAdmin
          .from('user_cards')
          .select('id')
          .in('id', auction.additional_user_card_ids)
          .eq('user_id', auction.seller_id);

        if (!additionalCardRows || additionalCardRows.length !== auction.additional_user_card_ids.length) {
          await supabaseAdmin.from('auctions').update({ status: 'cancelled' }).eq('id', auctionId);
          return NextResponse.json({ error: 'Card transfer failed — seller no longer owns all cards in the bundle. Auction cancelled.' }, { status: 409 });
        }
      }

      // Transfer main card ownership in DB
      const { error: transferError } = await supabaseAdmin
        .from('user_cards')
        .update({ user_id: userId })
        .eq('id', auction.user_card_id);

      if (transferError) return NextResponse.json({ error: 'Card transfer failed in database: ' + transferError.message }, { status: 500 });

      // Transfer additional cards ownership
      if (auction.additional_user_card_ids && auction.additional_user_card_ids.length > 0) {
        const { error: additionalTransferError } = await supabaseAdmin
          .from('user_cards')
          .update({ user_id: userId })
          .in('id', auction.additional_user_card_ids);

        if (additionalTransferError) {
          console.error('Failed to transfer additional cards:', additionalTransferError);
        }
      }

      // Award +15 PokePoints to the seller for the successful card sale
      try {
        const { awardPoints } = await import('@/lib/pokepoints');
        await awardPoints(auction.seller_id, 'marketplace_sale', 15, auctionId, { buyerId: userId, cardId: auction.card_id, price: expectedUSDC });
      } catch (e) {
        console.error('Failed to award PokePoints for marketplace sale:', e);
      }

      // Update auction record
      const updateData: any = {
        status: 'completed',
        tx_hash: txHash
      };
      if (isBuyout) {
        updateData.highest_bid = expectedUSDC;
        updateData.highest_bidder_id = userId;
      }
      await supabaseAdmin.from('auctions').update(updateData).eq('id', auctionId);

      // Send notifications
      const cardName = resolveCard(auction.card_id).name;
      await notify(
        auction.seller_id,
        'auction_sold',
        'Card Sold! 🪙',
        `Your card ${cardName} was purchased by ${buyer.wallet_address.slice(0, 6)}... for ${expectedUSDC.toFixed(2)} USDC on Base.`,
        { auctionId, txHash }
      );
      await notify(
        userId,
        'auction_purchased',
        'Card Claimed! 🎉',
        `You purchased ${cardName} for ${expectedUSDC.toFixed(2)} USDC! It is now in your collection.`,
        { auctionId, txHash }
      );

      // Notify outbid users if buyout triggered
      if (isBuyout && auction.highest_bidder_id) {
        await notify(
          auction.highest_bidder_id,
          'outbid',
          'Auction Buyout Triggered ⏳',
          `The auction for card ${cardName} was bought out immediately by another user.`,
          { auctionId }
        );
      }

      await track(userId, 'auction_completed', { auctionId, amount: expectedUSDC, isBuyout });
      return NextResponse.json({ success: true });
    }

    // ── CANCEL AUCTION ────────────────────────────────────────────────────────
    if (action === 'cancel_auction') {
      const { auctionId, userId } = payload || {};
      if (!auctionId || !userId) return NextResponse.json({ error: 'auctionId and userId are required' }, { status: 400 });

      const { data: auction } = await supabaseAdmin.from('auctions').select('*').eq('id', auctionId).single();
      if (!auction) return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
      
      // Authorization check (owner or admin check via x-admin-password)
      const adminPwd = request.headers.get('x-admin-password');
      const isAdmin = adminPwd === (process.env.ADMIN_PASSWORD || 'ZeemmyAdmin07');

      if (auction.seller_id !== userId && !isAdmin) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }

      if (auction.status !== 'active' && auction.status !== 'pending_payment') {
        return NextResponse.json({ error: 'Auction is not active' }, { status: 400 });
      }

      // Update status
      await supabaseAdmin.from('auctions').update({ status: 'cancelled' }).eq('id', auctionId);

      // Notify highest bidder (since bidding was off-chain commitment, we just notify them it was cancelled)
      if (auction.highest_bidder_id) {
        await notify(
          auction.highest_bidder_id,
          'outbid',
          'Auction Cancelled',
          `The auction for card ${resolveCard(auction.card_id).name} was cancelled by the seller.`,
          { auctionId }
        );
      }

      return NextResponse.json({ success: true });
    }

    // ── MY AUCTIONS ───────────────────────────────────────────────────────────
    if (action === 'my_auctions') {
      const { userId } = payload || {};
      if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

      const { data: rawAuctions, error } = await supabaseAdmin
        .from('auctions')
        .select(`
          *,
          seller:seller_id(username, avatar),
          winner:highest_bidder_id(username, avatar, wallet_address)
        `)
        .eq('seller_id', userId)
        .order('created_at', { ascending: false });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const enriched = (rawAuctions || []).map((a: any) => enrichAuction(a));

      return NextResponse.json({ auctions: enriched });
    }

    // ── MY BIDS ───────────────────────────────────────────────────────────────
    if (action === 'my_bids') {
      const { userId } = payload || {};
      if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

      // Fetch auctions where user bid
      const { data: userBids, error: bidsError } = await supabaseAdmin
        .from('auction_bids')
        .select('auction_id')
        .eq('bidder_id', userId);

      if (bidsError) return NextResponse.json({ error: bidsError.message }, { status: 500 });
      if (!userBids || userBids.length === 0) return NextResponse.json({ auctions: [] });

      const auctionIds = Array.from(new Set(userBids.map((b: any) => b.auction_id)));

      const { data: rawAuctions, error: auctionsError } = await supabaseAdmin
        .from('auctions')
        .select(`
          *,
          seller:seller_id(username, avatar, wallet_address)
        `)
        .in('id', auctionIds)
        .order('end_at', { ascending: true });

      if (auctionsError) return NextResponse.json({ error: auctionsError.message }, { status: 500 });
      const enriched = (rawAuctions || []).map((a: any) => enrichAuction(a));

      return NextResponse.json({ auctions: enriched });
    }

    // ── GET AUCTION DETAIL ────────────────────────────────────────────────────
    if (action === 'get_auction') {
      const { auctionId } = payload || {};
      if (!auctionId) return NextResponse.json({ error: 'auctionId required' }, { status: 400 });

      const { data: auction, error } = await supabaseAdmin
        .from('auctions')
        .select(`
          *,
          seller:seller_id(id, username, avatar, fid, wallet_address)
        `)
        .eq('id', auctionId)
        .single();

      if (error || !auction) return NextResponse.json({ error: 'Auction not found' }, { status: 404 });

      // Fetch bid history
      const { data: bids } = await supabaseAdmin
        .from('auction_bids')
        .select(`
          *,
          bidder:bidder_id(id, username, avatar)
        `)
        .eq('auction_id', auctionId)
        .order('amount', { ascending: false })
        .limit(10);

      return NextResponse.json({
        auction: enrichAuction(auction),
        bids: bids || []
      });
    }

    // ── REPORT LISTING ────────────────────────────────────────────────────────
    if (action === 'report_auction') {
      const { auctionId, reporterUserId, reason } = payload || {};
      if (!auctionId || !reporterUserId || !reason) {
        return NextResponse.json({ error: 'auctionId, reporterUserId, and reason are required' }, { status: 400 });
      }
      const { error } = await supabaseAdmin
        .from('auction_reports')
        .insert({ auction_id: auctionId, reporter_user_id: reporterUserId, reason });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // ── ADMIN: LIST ALL + REPORTS ─────────────────────────────────────────────
    if (action === 'admin_auctions') {
      const adminPwd = request.headers.get('x-admin-password');
      if (adminPwd !== (process.env.ADMIN_PASSWORD || 'ZeemmyAdmin07')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const { page = 1, limit = 50, status } = payload || {};

      let query = supabaseAdmin
        .from('auctions')
        .select(`*, seller:seller_id(id, username, avatar)`)
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (status) query = query.eq('status', status);
      const { data: rawAuctions, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const { data: reports } = await supabaseAdmin
        .from('auction_reports')
        .select(`*, reporter:reporter_user_id(username), auction:auction_id(*)`)
        .eq('resolved', false)
        .order('created_at', { ascending: false });

      const { count: totalActive } = await supabaseAdmin
        .from('auctions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      const { count: totalBids } = await supabaseAdmin
        .from('auction_bids')
        .select('*', { count: 'exact', head: true });

      return NextResponse.json({
        auctions: (rawAuctions || []).map((a: any) => enrichAuction(a)),
        reports: reports || [],
        stats: {
          totalActive: totalActive || 0,
          totalBids: totalBids || 0,
          unresolvedReports: (reports || []).length
        }
      });
    }

    // ── ADMIN: RESOLVE REPORT ─────────────────────────────────────────────────
    if (action === 'admin_resolve_report') {
      const adminPwd = request.headers.get('x-admin-password');
      if (adminPwd !== (process.env.ADMIN_PASSWORD || 'ZeemmyAdmin07')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const { reportId } = payload || {};
      if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 });
      await supabaseAdmin.from('auction_reports').update({ resolved: true }).eq('id', reportId);
      return NextResponse.json({ success: true });
    }

    // ── WTB: LIST REQUESTS ───────────────────────────────────────────────────
    if (action === 'list_requests') {
      const { page = 1, limit = 20, userId, onlyMyRequests = false } = payload || {};

      let query = supabaseAdmin
        .from('card_requests')
        .select(`
          *,
          requester:requester_id(id, username, avatar, fid, wallet_address)
        `, { count: 'exact' })
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (onlyMyRequests && userId) {
        query = query.eq('requester_id', userId);
      } else if (userId) {
        query = query.neq('requester_id', userId);
      }

      const { data: requests, count, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const enriched = [];
      for (const r of (requests || [])) {
        const card = resolveCard(r.card_id);
        const { count: offerCount } = await supabaseAdmin
          .from('card_request_offers')
          .select('*', { count: 'exact', head: true })
          .eq('request_id', r.id)
          .eq('status', 'pending');

        enriched.push({
          ...r,
          card,
          offerCount: offerCount || 0
        });
      }

      return NextResponse.json({
        requests: enriched,
        total: count || 0,
        page,
        totalPages: Math.ceil((count || 0) / limit)
      });
    }

    // ── WTB: CREATE REQUEST ──────────────────────────────────────────────────
    if (action === 'create_request') {
      const { userId, cardId, budget } = payload || {};
      if (!userId || !cardId || !budget) {
        return NextResponse.json({ error: 'userId, cardId, and budget are required' }, { status: 400 });
      }

      const parsedBudget = parseFloat(budget);
      if (isNaN(parsedBudget) || parsedBudget < 0.01) {
        return NextResponse.json({ error: 'Budget must be at least 0.01 USDC' }, { status: 400 });
      }

      const { data: requestRecord, error } = await supabaseAdmin
        .from('card_requests')
        .insert({
          requester_id: userId,
          card_id: cardId,
          budget: parsedBudget,
          status: 'active'
        })
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, request: requestRecord });
    }

    // ── WTB: CANCEL REQUEST ──────────────────────────────────────────────────
    if (action === 'cancel_request') {
      const { userId, requestId } = payload || {};
      if (!userId || !requestId) {
        return NextResponse.json({ error: 'userId and requestId are required' }, { status: 400 });
      }

      const { data: requestRecord } = await supabaseAdmin
        .from('card_requests')
        .select('requester_id, status')
        .eq('id', requestId)
        .single();

      if (!requestRecord) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
      if (requestRecord.requester_id !== userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

      await supabaseAdmin
        .from('card_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId);

      await supabaseAdmin
        .from('card_request_offers')
        .update({ status: 'cancelled' })
        .eq('request_id', requestId)
        .eq('status', 'pending');

      return NextResponse.json({ success: true });
    }

    // ── WTB: LIST OFFERS FOR REQUEST ─────────────────────────────────────────
    if (action === 'list_offers') {
      const { requestId } = payload || {};
      if (!requestId) return NextResponse.json({ error: 'requestId is required' }, { status: 400 });

      const { data: offers, error } = await supabaseAdmin
        .from('card_request_offers')
        .select(`
          *,
          seller:seller_id(id, username, avatar, fid, wallet_address)
        `)
        .eq('request_id', requestId)
        .eq('status', 'pending')
        .order('price', { ascending: true });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ offers: offers || [] });
    }

    // ── WTB: CREATE OFFER ────────────────────────────────────────────────────
    if (action === 'create_offer') {
      const { userId, requestId, price } = payload || {};
      if (!userId || !requestId || !price) {
        return NextResponse.json({ error: 'userId, requestId, and price are required' }, { status: 400 });
      }

      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0.01) {
        return NextResponse.json({ error: 'Price must be at least 0.01 USDC' }, { status: 400 });
      }

      const { data: requestRecord } = await supabaseAdmin
        .from('card_requests')
        .select('*')
        .eq('id', requestId)
        .eq('status', 'active')
        .single();

      if (!requestRecord) return NextResponse.json({ error: 'Active card request not found' }, { status: 404 });
      if (requestRecord.requester_id === userId) return NextResponse.json({ error: 'You cannot offer cards to your own request' }, { status: 400 });

      if (parsedPrice > requestRecord.budget) {
        return NextResponse.json({ error: `Offered price exceeds budget of ${requestRecord.budget} USDC` }, { status: 400 });
      }

      const { data: ownedCopies } = await supabaseAdmin
        .from('user_cards')
        .select('id')
        .eq('user_id', userId)
        .eq('card_id', requestRecord.card_id);

      if (!ownedCopies || ownedCopies.length === 0) {
        return NextResponse.json({ error: 'You do not own this card' }, { status: 400 });
      }

      const lockedTradeCounts = await getLockedCardIdsInTrades(userId);
      const lockedInTradesCount = lockedTradeCounts[requestRecord.card_id] || 0;

      const { data: activeAuctions } = await supabaseAdmin
        .from('auctions')
        .select('user_card_id, additional_user_card_ids')
        .eq('seller_id', userId)
        .in('status', ['active', 'pending_payment']);

      const listedCardIds = new Set<string>();
      if (activeAuctions) {
        for (const a of activeAuctions) {
          if (a.user_card_id) listedCardIds.add(a.user_card_id);
          if (a.additional_user_card_ids && Array.isArray(a.additional_user_card_ids)) {
            for (const addId of a.additional_user_card_ids) {
              listedCardIds.add(addId);
            }
          }
        }
      }

      const { data: activeOffers } = await supabaseAdmin
        .from('card_request_offers')
        .select('user_card_id')
        .eq('seller_id', userId)
        .eq('status', 'pending');

      if (activeOffers) {
        for (const o of activeOffers) {
          listedCardIds.add(o.user_card_id);
        }
      }

      const unlistedCopies = ownedCopies.filter(c => !listedCardIds.has(c.id));
      if (unlistedCopies.length - lockedInTradesCount < 1) {
        return NextResponse.json({ error: 'All copies of this card are currently listed, locked in trades, or offered elsewhere' }, { status: 400 });
      }

      const availableCopy = unlistedCopies[lockedInTradesCount];

      const { data: offerRecord, error } = await supabaseAdmin
        .from('card_request_offers')
        .insert({
          request_id: requestId,
          seller_id: userId,
          user_card_id: availableCopy.id,
          price: parsedPrice,
          status: 'pending'
        })
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505') {
          return NextResponse.json({ error: 'You have already offered this card copy to this request' }, { status: 400 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const { data: sellerUser } = await supabaseAdmin.from('users').select('username').eq('id', userId).single();
      const cardName = resolveCard(requestRecord.card_id).name;
      await notify(
        requestRecord.requester_id,
        'wtb_offer',
        'New WTB Offer! 🪙',
        `${sellerUser?.username || 'A seller'} offered to sell ${cardName} for ${parsedPrice.toFixed(2)} USDC.`,
        { requestId, offerId: offerRecord.id }
      );

      return NextResponse.json({ success: true, offer: offerRecord });
    }

    // ── WTB: CANCEL OFFER ────────────────────────────────────────────────────
    if (action === 'cancel_offer') {
      const { userId, offerId } = payload || {};
      if (!userId || !offerId) return NextResponse.json({ error: 'userId and offerId are required' }, { status: 400 });

      const { data: offerRecord } = await supabaseAdmin
        .from('card_request_offers')
        .select('seller_id, status')
        .eq('id', offerId)
        .single();

      if (!offerRecord) return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
      if (offerRecord.seller_id !== userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

      await supabaseAdmin
        .from('card_request_offers')
        .update({ status: 'cancelled' })
        .eq('id', offerId);

      return NextResponse.json({ success: true });
    }

    // ── WTB: VERIFY REQUEST PAYMENT (ACCEPT OFFER) ───────────────────────────
    if (action === 'verify_request_payment') {
      const { offerId, txHash, userId } = payload || {};
      if (!offerId || !txHash || !userId) {
        return NextResponse.json({ error: 'offerId, txHash, and userId are required' }, { status: 400 });
      }

      const { data: offerRecord } = await supabaseAdmin
        .from('card_request_offers')
        .select('*, request:request_id(*)')
        .eq('id', offerId)
        .single();

      if (!offerRecord) return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
      if (offerRecord.request.requester_id !== userId) return NextResponse.json({ error: 'Only the request creator can accept offers' }, { status: 403 });
      if (offerRecord.status !== 'pending' || offerRecord.request.status !== 'active') {
        return NextResponse.json({ error: 'Offer or request is no longer active' }, { status: 400 });
      }

      const { data: buyer } = await supabaseAdmin.from('users').select('wallet_address').eq('id', userId).single();
      const { data: seller } = await supabaseAdmin.from('users').select('wallet_address').eq('id', offerRecord.seller_id).single();

      if (!buyer?.wallet_address || !seller?.wallet_address) {
        return NextResponse.json({ error: 'Seller and buyer wallets must be connected' }, { status: 400 });
      }

      const expectedUSDC = offerRecord.price;
      const isMock = txHash.startsWith('0xmock') || (process.env.NODE_ENV !== 'production' && txHash.includes('mock'));
      let isTxValid = false;

      if (isMock) {
        isTxValid = true;
      } else {
        const hashes = txHash.split(',');
        if (hashes.length === 2) {
          const sellerAmount = expectedUSDC * 0.98;
          const treasuryAmount = expectedUSDC * 0.02;
          const isSellerTxValid = await verifyBaseUSDCTransfer(hashes[0], buyer.wallet_address, seller.wallet_address, sellerAmount);
          const isTreasuryTxValid = await verifyBaseUSDCTransfer(hashes[1], buyer.wallet_address, TREASURY_ADDRESS, treasuryAmount);
          isTxValid = isSellerTxValid && isTreasuryTxValid;
        } else {
          isTxValid = await verifyBaseUSDCTransfer(txHash, buyer.wallet_address, seller.wallet_address, expectedUSDC);
        }
      }

      if (!isTxValid) {
        return NextResponse.json({ error: 'Payment validation failed' }, { status: 400 });
      }

      const { data: cardRow } = await supabaseAdmin
        .from('user_cards')
        .select('*')
        .eq('id', offerRecord.user_card_id)
        .eq('user_id', offerRecord.seller_id)
        .maybeSingle();

      if (!cardRow) {
        await supabaseAdmin.from('card_request_offers').update({ status: 'cancelled' }).eq('id', offerId);
        return NextResponse.json({ error: 'Seller no longer owns the offered card copy' }, { status: 409 });
      }

      const { error: transferError } = await supabaseAdmin
        .from('user_cards')
        .update({ user_id: userId })
        .eq('id', offerRecord.user_card_id);

      if (transferError) return NextResponse.json({ error: 'Card transfer failed in database' }, { status: 500 });

      await supabaseAdmin.from('card_request_offers').update({ status: 'accepted' }).eq('id', offerId);

      await supabaseAdmin
        .from('card_request_offers')
        .update({ status: 'cancelled' })
        .eq('request_id', offerRecord.request_id)
        .neq('id', offerId)
        .eq('status', 'pending');

      await supabaseAdmin.from('card_requests').update({ status: 'completed' }).eq('id', offerRecord.request_id);

      try {
        const { awardPoints } = await import('@/lib/pokepoints');
        await awardPoints(offerRecord.seller_id, 'marketplace_sale', 15, offerRecord.request_id, { buyerId: userId, cardId: offerRecord.request.card_id, price: expectedUSDC });
      } catch {}

      const cardName = resolveCard(offerRecord.request.card_id).name;
      await notify(offerRecord.seller_id, 'wtb_sold', 'Card Sold via Request! 🪙', `Your offer to sell ${cardName} for ${expectedUSDC.toFixed(2)} USDC was accepted by the buyer.`, { requestId: offerRecord.request_id });
      await notify(userId, 'wtb_completed', 'Card Purchased via Request! 🎉', `You accepted the offer and purchased ${cardName} for ${expectedUSDC.toFixed(2)} USDC.`, { requestId: offerRecord.request_id });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('Auction API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// ─── GET: lightweight counter for BottomNav badge ────────────────────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ pendingPayments: 0 });

  // Count auctions won by user that are awaiting payment
  const { count } = await supabaseAdmin
    .from('auctions')
    .select('*', { count: 'exact', head: true })
    .eq('highest_bidder_id', userId)
    .eq('status', 'pending_payment');

  return NextResponse.json({ pendingPayments: count || 0, pendingOffers: count || 0 });
}
