import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Define the static configuration for our daily quests
const QUESTS_CONFIG = [
  { id: 'daily_login', title: 'Daily Check-in', desc: 'Claim your daily login streak reward', target: 1, reward: 2 },
  { id: 'open_pack', title: 'Booster Ripper', desc: 'Open at least 1 booster pack today', target: 1, reward: 3 },
  { id: 'place_bid', title: 'Auction Bidder', desc: 'Place at least 1 bid in the Auction House', target: 1, reward: 4 },
  { id: 'create_auction', title: 'Card Trader', desc: 'List at least 1 card for sale in the Auction House', target: 1, reward: 5 },
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Fetch current quests for the user for today
    let { data: quests, error: fetchError } = await supabaseAdmin
      .from('user_quests')
      .select('*')
      .eq('user_id', userId)
      .eq('day', todayStr);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // 2. If quests are not initialized for today, initialize them!
    if (!quests || quests.length === 0) {
      const inserts = QUESTS_CONFIG.map(q => ({
        user_id: userId,
        quest_id: q.id,
        progress: 0,
        target: q.target,
        claimed: false,
        day: todayStr
      }));

      const { data: newQuests, error: insertError } = await supabaseAdmin
        .from('user_quests')
        .insert(inserts)
        .select('*');

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      quests = newQuests || [];
    }

    // 3. Sync Daily Login status on-the-fly
    const { data: claimedRow } = await supabaseAdmin
      .from('login_rewards')
      .select('id')
      .eq('user_id', userId)
      .gte('claimed_at', `${todayStr}T00:00:00.000Z`)
      .lte('claimed_at', `${todayStr}T23:59:59.999Z`)
      .maybeSingle();

    if (claimedRow) {
      const dailyLoginQuest = quests.find(q => q.quest_id === 'daily_login');
      if (dailyLoginQuest && dailyLoginQuest.progress === 0) {
        await supabaseAdmin
          .from('user_quests')
          .update({ progress: 1 })
          .eq('user_id', userId)
          .eq('quest_id', 'daily_login')
          .eq('day', todayStr);
        
        dailyLoginQuest.progress = 1;
      }
    }

    // Map database records with the static metadata configurations (titles, descriptions, rewards)
    const enrichedQuests = quests.map(q => {
      const config = QUESTS_CONFIG.find(c => c.id === q.quest_id) || { title: q.quest_id, desc: '', reward: 1 };
      return {
        ...q,
        title: config.title,
        desc: config.desc,
        reward: config.reward
      };
    });

    // Sort to keep order consistent
    enrichedQuests.sort((a, b) => a.quest_id.localeCompare(b.quest_id));

    return NextResponse.json({ quests: enrichedQuests });
  } catch (error: any) {
    console.error('Quests API GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId, questId } = await request.json();

    if (!userId || !questId) {
      return NextResponse.json({ error: 'userId and questId are required' }, { status: 400 });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Fetch quest
    const { data: quest, error: fetchError } = await supabaseAdmin
      .from('user_quests')
      .select('*')
      .eq('user_id', userId)
      .eq('quest_id', questId)
      .eq('day', todayStr)
      .maybeSingle();

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
    if (!quest) return NextResponse.json({ error: 'Quest not found for today' }, { status: 404 });
    if (quest.claimed) return NextResponse.json({ error: 'Reward already claimed' }, { status: 400 });
    if (quest.progress < quest.target) return NextResponse.json({ error: 'Quest not completed' }, { status: 400 });

    // 2. Fetch user's current tickets
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('pack_tickets')
      .eq('id', userId)
      .single();

    if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });

    const config = QUESTS_CONFIG.find(c => c.id === questId);
    if (!config) return NextResponse.json({ error: 'Invalid quest config' }, { status: 400 });

    const newTickets = (user.pack_tickets || 0) + config.reward;

    // 3. Mark claimed and grant tickets in transaction/sequence
    const { error: updateQuestError } = await supabaseAdmin
      .from('user_quests')
      .update({ claimed: true })
      .eq('user_id', userId)
      .eq('quest_id', questId)
      .eq('day', todayStr);

    if (updateQuestError) return NextResponse.json({ error: updateQuestError.message }, { status: 500 });

    const { error: updateUserError } = await supabaseAdmin
      .from('users')
      .update({ pack_tickets: newTickets })
      .eq('id', userId);

    if (updateUserError) {
      // Rollback quest claim if user update fails
      await supabaseAdmin
        .from('user_quests')
        .update({ claimed: false })
        .eq('user_id', userId)
        .eq('quest_id', questId)
        .eq('day', todayStr);
      return NextResponse.json({ error: updateUserError.message }, { status: 500 });
    }

    // Log analytics event
    try {
      await supabaseAdmin.from('analytics_events').insert({
        user_id: userId,
        event: 'quest_claimed',
        data: { questId, reward: config.reward }
      });
    } catch {}

    return NextResponse.json({ success: true, packTickets: newTickets, rewardAmount: config.reward });
  } catch (error: any) {
    console.error('Quests API POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
