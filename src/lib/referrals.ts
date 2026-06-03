import { supabaseAdmin } from '@/lib/supabase';

export const createReferralCode = (fid: number | string) => {
  const normalizedFid = typeof fid === 'number' ? fid.toString() : fid;
  return `POKE-${normalizedFid}`;
};

export async function createReferralForNewUser(
  referrerCode: string,
  refereeId: string,
  refereeFid: string | number,
  sourceUrl: string | null = null
) {
  const normalizedCode = referrerCode?.toString().trim().toUpperCase();
  if (!normalizedCode) return null;

  const { data: referrer, error: referrerError } = await supabaseAdmin
    .from('users')
    .select('id, total_referrals')
    .eq('referral_code', normalizedCode)
    .maybeSingle();

  if (referrerError) {
    console.error('Referral lookup failed:', referrerError);
    return null;
  }

  if (!referrer || !referrer.id) {
    return null;
  }

  const { data: existingReferral } = await supabaseAdmin
    .from('referrals')
    .select('id')
    .eq('referee_id', refereeId)
    .maybeSingle();

  if (existingReferral) {
    return null;
  }

  const { data: referral, error: insertError } = await supabaseAdmin
    .from('referrals')
    .insert({
      referrer_id: referrer.id,
      referee_id: refereeId,
      referee_fid: refereeFid.toString(),
      referral_code: normalizedCode,
      source_url: sourceUrl,
      created_at: new Date().toISOString()
    })
    .select('*')
    .single();

  if (insertError) {
    console.error('Create referral failed:', insertError);
    return null;
  }

  await supabaseAdmin
    .from('users')
    .update({ total_referrals: (referrer.total_referrals || 0) + 1 })
    .eq('id', referrer.id);

  return referral;
}

async function getReferralForReferee(refereeId: string) {
  const { data, error } = await supabaseAdmin
    .from('referrals')
    .select('*')
    .eq('referee_id', refereeId)
    .maybeSingle();
  if (error) {
    console.error('Referral fetch error:', error);
    return null;
  }
  return data;
}

async function awardReferralReward(
  referralId: string,
  eventType: 'first_pack' | '50_cards' | '100_cards' | 'trade_complete',
  rewardAmount: number,
  rewardDescription: string,
  refereeRewardAmount?: number
) {
  const { data: referral, error: referralError } = await supabaseAdmin
    .from('referrals')
    .select('*')
    .eq('id', referralId)
    .maybeSingle();

  if (referralError) {
    console.error('Referral lookup failed:', referralError);
    return null;
  }

  if (!referral || !referral.referrer_id || referral.referrer_id === referral.referee_id) {
    return null;
  }

  const rewardFields: Record<string, string> = {
    first_pack: 'rewarded_first_pack',
    '50_cards': 'rewarded_50_cards',
    '100_cards': 'rewarded_100_cards',
    trade_complete: 'rewarded_trade_complete'
  };

  const rewardColumn = rewardFields[eventType];
  if (!rewardColumn || referral[rewardColumn]) {
    return null;
  }

  const { data: referrer, error: referrerError } = await supabaseAdmin
    .from('users')
    .select('id, pack_tickets, referral_tickets_earned, successful_referrals')
    .eq('id', referral.referrer_id)
    .maybeSingle();

  if (referrerError || !referrer) {
    console.error('Referrer record lookup failed:', referrerError);
    return null;
  }

  const referrerTickets = (referrer.pack_tickets || 0) + rewardAmount;
  const referrerReferralTicketsEarned = (referrer.referral_tickets_earned || 0) + rewardAmount;
  const successfulIncrement = eventType === 'first_pack' ? 1 : 0;

  const updatePayload: any = {
    pack_tickets: referrerTickets,
    referral_tickets_earned: referrerReferralTicketsEarned
  };
  if (successfulIncrement > 0) {
    updatePayload.successful_referrals = (referrer.successful_referrals || 0) + successfulIncrement;
  }

  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update(updatePayload)
    .eq('id', referrer.id);

  if (updateError) {
    console.error('Failed to update referrer tickets:', updateError);
  }

  if (refereeRewardAmount && eventType === 'first_pack') {
    const { data: referee, error: refereeError } = await supabaseAdmin
      .from('users')
      .select('pack_tickets')
      .eq('id', referral.referee_id)
      .maybeSingle();

    if (refereeError) {
      console.error('Failed to fetch referee for ticket reward:', refereeError);
    } else {
      const { error: refereeUpdateError } = await supabaseAdmin
        .from('users')
        .update({ pack_tickets: (referee?.pack_tickets || 0) + refereeRewardAmount })
        .eq('id', referral.referee_id);
      if (refereeUpdateError) {
        console.error('Failed to update referee ticket reward:', refereeUpdateError);
      }
    }
  }

  const { error: rewardInsertError } = await supabaseAdmin
    .from('referral_rewards')
    .insert({
      referral_id: referral.id,
      referrer_id: referrer.id,
      referee_id: referral.referee_id,
      event_type: eventType,
      reward_amount: rewardAmount,
      reward_description: rewardDescription,
      created_at: new Date().toISOString()
    });

  if (rewardInsertError) {
    console.error('Failed to log referral reward:', rewardInsertError);
  }

  const { error: referralUpdateError } = await supabaseAdmin
    .from('referrals')
    .update({ [rewardColumn]: true, last_reward_at: new Date().toISOString() })
    .eq('id', referral.id);

  if (referralUpdateError) {
    console.error('Failed to mark referral reward as claimed:', referralUpdateError);
  }

  return { referrerId: referrer.id, refereeId: referral.referee_id };
}

export async function processReferralMilestones(refereeId: string, previousPackCount: number | null = null) {
  const referral = await getReferralForReferee(refereeId);
  if (!referral || !referral.referrer_id) return;

  const { data: cardCountData, error: countError } = await supabaseAdmin
    .from('user_cards')
    .select('card_id', { count: 'exact', head: true })
    .eq('user_id', refereeId);

  if (countError) {
    console.error('Card count fetch failed:', countError);
    return;
  }

  const totalCards = (cardCountData as any)?.count || 0;

  // First pack reward: only when they actually open their first pack
  if (previousPackCount !== null && previousPackCount === 0 && !referral.rewarded_first_pack) {
    await awardReferralReward(referral.id, 'first_pack', 1, 'Referral first pack opened', 1);
  }

  if (totalCards >= 50 && !referral.rewarded_50_cards) {
    await awardReferralReward(referral.id, '50_cards', 2, 'Referred friend reached 50 cards');
  }

  if (totalCards >= 100 && !referral.rewarded_100_cards) {
    await awardReferralReward(referral.id, '100_cards', 3, 'Referred friend reached 100 cards');
  }
}

export async function awardReferralTradeComplete(refereeId: string) {
  const referral = await getReferralForReferee(refereeId);
  if (!referral || !referral.referrer_id || referral.rewarded_trade_complete) return;
  await awardReferralReward(referral.id, 'trade_complete', 5, 'Referred friend completed first trade');
}
