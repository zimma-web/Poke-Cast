import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyBaseETHTransfer, verifyBaseUSDCTransfer } from '@/lib/web3';

// Allow up to 120 seconds for this route (tx confirmation polling can take up to 90s)
export const maxDuration = 120;


const TREASURY_ADDRESS = '0x330CDc1dB0899f8d5C7D0E0e261271D574b5952f';

// Fetch the current price of ETH in USD to verify equivalent $1
async function getEthPrice(): Promise<number> {
  try {
    const res = await fetch('https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD', {
      next: { revalidate: 60 } // cache for 1 minute
    });
    const data = await res.json();
    return Number(data.USD) || 3000;
  } catch (err) {
    console.warn('Failed to fetch ETH price, using fallback $3000:', err);
    return 3000; // fallback
  }
}

export async function POST(request: Request) {
  try {
    const { userId, txHash, method, userAddress, usdAmount: rawUsdAmount } = await request.json();

    if (!userId || !txHash || !method) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const usdAmount = Math.max(1, parseInt(rawUsdAmount) || 1);
    const ticketAmount = usdAmount * 10;
    const pointsAwarded = usdAmount * 50;

    // 1. Fetch user to verify they exist
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, pack_tickets, wallet_address')
      .eq('id', userId)
      .single();

    if (!user || userError) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const senderWallet = userAddress || user.wallet_address;
    if (!senderWallet) {
      return NextResponse.json({ error: 'User wallet address not found' }, { status: 400 });
    }

    // 2. Check if transaction was already processed
    const { data: existingTx } = await supabaseAdmin
      .from('ticket_purchases')
      .select('id')
      .eq('tx_hash', txHash)
      .maybeSingle();

    if (existingTx) {
      return NextResponse.json({ error: 'Transaction has already been processed' }, { status: 400 });
    }

    const isMock = txHash.startsWith('0xmock') && process.env.NODE_ENV !== 'production';
    let verified = false;
    let costUsd = usdAmount;

    if (isMock) {
      verified = true;
    } else {
      if (method === 'usdc') {
        // USDC on Base (usdAmount USDC)
        verified = await verifyBaseUSDCTransfer(
          txHash,
          senderWallet,
          TREASURY_ADDRESS,
          usdAmount
        );
      } else if (method === 'eth') {
        // ETH on Base
        const ethPrice = await getEthPrice();
        // $usdAmount in ETH = usdAmount / ethPrice
        const expectedEth = usdAmount / ethPrice;
        
        // Add a small 5% buffer for price movements during transaction confirmation
        const minEth = expectedEth * 0.95;

        verified = await verifyBaseETHTransfer(
          txHash,
          senderWallet,
          TREASURY_ADDRESS,
          minEth
        );
      }
    }

    if (!verified) {
      return NextResponse.json({ error: `Transaction verification failed. Make sure you sent at least $${usdAmount} worth of tokens on Base.` }, { status: 400 });
    }

    // 3. Record purchase
    const { error: insertError } = await supabaseAdmin
      .from('ticket_purchases')
      .insert({
        user_id: userId,
        tx_hash: txHash,
        amount: ticketAmount,
        cost_usd: costUsd
      });

    if (insertError) {
      console.error('Failed to log ticket purchase:', insertError);
    }

    // 4. Update user tickets (+ticketAmount)
    const newBalance = (user.pack_tickets || 0) + ticketAmount;
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ pack_tickets: newBalance })
      .eq('id', userId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update user ticket balance' }, { status: 500 });
    }

    // 5. Award PokePoints (+50 per dollar)
    try {
      const { awardPoints } = await import('@/lib/pokepoints');
      await awardPoints(userId, 'topup', pointsAwarded, txHash, { amount: ticketAmount, method, usdAmount });
    } catch (e) {
      console.error('Failed to award PokePoints for topup:', e);
    }

    return NextResponse.json({
      success: true,
      newBalance,
      message: `Successfully purchased ${ticketAmount} Pack Tickets!`
    });

  } catch (error: any) {
    console.error('Top up API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
