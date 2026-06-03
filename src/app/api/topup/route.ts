import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyBaseETHTransfer, verifyBaseUSDCTransfer } from '@/lib/web3';

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
    const { userId, txHash, method, userAddress } = await request.json();

    if (!userId || !txHash || !method) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

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
    let costUsd = 1.00;

    if (isMock) {
      verified = true;
    } else {
      if (method === 'usdc') {
        // USDC on Base (1.0 USDC)
        verified = await verifyBaseUSDCTransfer(
          txHash,
          senderWallet,
          TREASURY_ADDRESS,
          1.00
        );
      } else if (method === 'eth') {
        // ETH on Base
        const ethPrice = await getEthPrice();
        // $1 in ETH = 1 / ethPrice
        const expectedEth = 1 / ethPrice;
        
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
      return NextResponse.json({ error: 'Transaction verification failed. Make sure you sent the transaction on Base.' }, { status: 400 });
    }

    // 3. Record purchase
    const { error: insertError } = await supabaseAdmin
      .from('ticket_purchases')
      .insert({
        user_id: userId,
        tx_hash: txHash,
        amount: 10,
        cost_usd: costUsd
      });

    if (insertError) {
      console.error('Failed to log ticket purchase:', insertError);
      // We can continue if it fails due to table missing or log error, but it's important
    }

    // 4. Update user tickets (+10)
    const newBalance = (user.pack_tickets || 0) + 10;
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ pack_tickets: newBalance })
      .eq('id', userId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update user ticket balance' }, { status: 500 });
    }

    // 5. Award PokePoints (+50 for top-up/supporting the app)
    try {
      const { awardPoints } = await import('@/lib/pokepoints');
      await awardPoints(userId, 'topup', 50, txHash, { amount: 10, method });
    } catch (e) {
      console.error('Failed to award PokePoints for topup:', e);
    }

    return NextResponse.json({
      success: true,
      newBalance,
      message: 'Successfully purchased 10 Pack Tickets!'
    });

  } catch (error: any) {
    console.error('Top up API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
