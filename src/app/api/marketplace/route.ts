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

// ─── Cards locked in active P2P trades ────────────────────────────────────────
async function getLockedCardIdsInTrades(userId: string): Promise<Record<string, number>> {
  const { data: pendingOffers } = await supabaseAdmin
    .from('trade_offers')
    .select('id')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .eq('status', 'pending');

  if (!pendingOffers || pendingOffers.length === 0) return {};

  const offerIds = pendingOffers.map((o: any) => o.id);
  const { data: lockedCards } = await supabaseAdmin
    .from('trade_offer_cards')
    .select('card_id')
    .eq('owner_user_id', userId)
    .in('offer_id', offerIds);

  const counts: Record<string, number> = {};
  (lockedCards || []).forEach((c: any) => {
    counts[c.card_id] = (counts[c.card_id] || 0) + 1;
  });
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
  return { ...auction, card, wishlistMatch };
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
      const { userId, cardId, startPrice, buyoutPrice, durationHours, listingTxHash } = payload || {};
      
      if (!userId || !cardId || !startPrice) {
        return NextResponse.json({ error: 'userId, cardId, and startPrice are required' }, { status: 400 });
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
          // 0.000015 ETH native transfer to TREASURY_ADDRESS
          isListingTxValid = await verifyBaseETHTransfer(listingTxHash, seller.wallet_address, TREASURY_ADDRESS, 0.000015);
        }

        if (!isListingTxValid) {
          return NextResponse.json({ error: 'Listing fee verification failed. Ensure you paid 0.05 USD in Base ETH (0.000015 ETH) to the treasury.' }, { status: 400 });
        }
      }

      // Fetch all card copies owned by user
      const { data: ownedCopies } = await supabaseAdmin
        .from('user_cards')
        .select('id')
        .eq('user_id', userId)
        .eq('card_id', cardId);

      if (!ownedCopies || ownedCopies.length === 0) {
        return NextResponse.json({ error: 'You do not own this card' }, { status: 400 });
      }

      // Fetch card copies currently listed in active auctions
      const { data: activeAuctions } = await supabaseAdmin
        .from('auctions')
        .select('user_card_id')
        .eq('seller_id', userId)
        .eq('card_id', cardId)
        .in('status', ['active', 'pending_payment']);

      const listedCardIds = new Set((activeAuctions || []).map((a: any) => a.user_card_id));
      
      // Filter out copies that are listed
      const unlistedCopies = ownedCopies.filter(c => !listedCardIds.has(c.id));
      if (unlistedCopies.length === 0) {
        return NextResponse.json({ error: 'All copies of this card are already listed for auction' }, { status: 400 });
      }

      // Filter out copies locked in active trades
      const lockedTradeCounts = await getLockedCardIdsInTrades(userId);
      const lockedInTradesCount = lockedTradeCounts[cardId] || 0;
      
      if (unlistedCopies.length <= lockedInTradesCount) {
        return NextResponse.json({ error: 'All remaining copies of this card are locked in pending trades' }, { status: 400 });
      }

      // Select the first available user_card_id
      const targetUserCard = unlistedCopies[0];

      // Insert auction record
      const endAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
      const { data: auction, error } = await supabaseAdmin
        .from('auctions')
        .insert({
          seller_id: userId,
          user_card_id: targetUserCard.id,
          card_id: cardId,
          start_price: parsedStart,
          buyout_price: parsedBuyout,
          highest_bid: 0,
          highest_bidder_id: null,
          status: 'active',
          end_at: endAt,
          listing_tx_hash: listingTxHash
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

      // Transfer card ownership in DB
      const { error: transferError } = await supabaseAdmin
        .from('user_cards')
        .update({ user_id: userId })
        .eq('id', auction.user_card_id);

      if (transferError) return NextResponse.json({ error: 'Card transfer failed in database: ' + transferError.message }, { status: 500 });

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
