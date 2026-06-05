import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Define the static configuration for our daily quests
const QUESTS_CONFIG = [
  { id: 'daily_login', title: 'Daily Check-in', desc: 'Claim your daily login streak reward', target: 1, reward: 2 },
  { id: 'open_pack', title: 'Booster Ripper', desc: 'Open at least 1 booster pack today', target: 1, reward: 2 },
  { id: 'place_bid', title: 'Auction Bidder', desc: 'Place at least 1 bid in the Auction House', target: 1, reward: 2 },
  { id: 'create_auction', title: 'Card Trader', desc: 'List at least 1 card for sale in the Auction House', target: 1, reward: 3 },
];

const MAIN_QUESTS_CONFIG = [
  { id: 'main_follow_dev', title: 'Follow Developer', desc: 'Follow @pokecast on Warpcast', target: 1, reward: 5, link: 'https://farcaster.xyz/pokecast' },
  { id: 'main_join_channel', title: 'Like PokéCast Post', desc: 'Like PokéCast post on Warpcast', target: 1, reward: 5, link: 'https://farcaster.xyz/pokecast/0x0ba20c68' },
  { id: 'main_share_app', title: 'Share App', desc: 'Share PokéCast on Warpcast', target: 1, reward: 5, link: 'https://warpcast.com/~/compose?text=I%20am%20collecting%20Pok%C3%A9mon%20cards%20on%20Pok%C3%A9Cast%21%20Come%20rip%20packs%20with%20me%20%F0%9F%8E%B4%E2%9C%A8&embeds[]=https://poke-cast.vercel.app' },
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Fetch quest definitions from database, fallback to hardcoded if table doesn't exist/fails
    let questsConfig = QUESTS_CONFIG;
    let mainQuestsConfig = MAIN_QUESTS_CONFIG;
    
    try {
      const { data: dbConfigs, error: dbConfigsError } = await supabaseAdmin
        .from('quest_definitions')
        .select('*');
        
      if (!dbConfigsError && dbConfigs && dbConfigs.length > 0) {
        const daily = dbConfigs.filter(c => !c.is_main);
        const main = dbConfigs.filter(c => c.is_main);
        if (daily.length > 0) questsConfig = daily;
        if (main.length > 0) mainQuestsConfig = main;
      }
    } catch (e) {
      console.warn('Failed to fetch quest definitions from database, using fallback config:', e);
    }

    // 1. Fetch current quests for the user for today
    const { data: rawQuests, error: fetchError } = await supabaseAdmin
      .from('user_quests')
      .select('*')
      .eq('user_id', userId)
      .eq('day', todayStr);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    let quests = rawQuests || [];

    // 2. Initialize any missing daily quests
    if (quests.length < questsConfig.length) {
      const existingIds = quests.map(q => q.quest_id);
      const missingConfigs = questsConfig.filter(c => !existingIds.includes(c.id));

      if (missingConfigs.length > 0) {
        const inserts = missingConfigs.map(q => ({
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
        quests = [...quests, ...(newQuests || [])];
      }
    }

    // 3. Fetch main quests for the user
    let { data: mainQuests, error: mainFetchError } = await supabaseAdmin
      .from('user_quests')
      .select('*')
      .eq('user_id', userId)
      .eq('day', '2000-01-01');

    if (mainFetchError) {
      return NextResponse.json({ error: mainFetchError.message }, { status: 500 });
    }

    // 4. Initialize main quests if not fully initialized
    if (!mainQuests || mainQuests.length < mainQuestsConfig.length) {
      const existingIds = mainQuests ? mainQuests.map(q => q.quest_id) : [];
      const missingConfigs = mainQuestsConfig.filter(c => !existingIds.includes(c.id));

      if (missingConfigs.length > 0) {
        const inserts = missingConfigs.map(q => ({
          user_id: userId,
          quest_id: q.id,
          progress: 0,
          target: q.target,
          claimed: false,
          day: '2000-01-01'
        }));

        const { data: newMainQuests, error: insertMainError } = await supabaseAdmin
          .from('user_quests')
          .insert(inserts)
          .select('*');

        if (insertMainError) {
          return NextResponse.json({ error: insertMainError.message }, { status: 500 });
        }
        mainQuests = [...(mainQuests || []), ...(newMainQuests || [])];
      }
    }

    // 5. Sync Daily Login status on-the-fly
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
      const config = questsConfig.find(c => c.id === q.quest_id) || { title: q.quest_id, desc: '', reward: 1 };
      return {
        ...q,
        title: config.title,
        desc: config.desc,
        reward: config.reward
      };
    });

    const enrichedMainQuests = (mainQuests || []).map(q => {
      const config = mainQuestsConfig.find(c => c.id === q.quest_id) || { title: q.quest_id, desc: '', reward: 1, link: '' };
      return {
        ...q,
        title: config.title,
        desc: config.desc,
        reward: config.reward,
        link: config.link
      };
    });

    // Sort to keep order consistent
    enrichedQuests.sort((a, b) => a.quest_id.localeCompare(b.quest_id));
    enrichedMainQuests.sort((a, b) => a.quest_id.localeCompare(b.quest_id));

    return NextResponse.json({ 
      quests: enrichedQuests,
      mainQuests: enrichedMainQuests 
    });
  } catch (error: any) {
    console.error('Quests API GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId, questId, action } = await request.json();

    if (!userId || !questId) {
      return NextResponse.json({ error: 'userId and questId are required' }, { status: 400 });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const isMainQuest = questId.startsWith('main_');
    const dayFilter = isMainQuest ? '2000-01-01' : todayStr;

    // Handle completing a quest (progress = 1)
    if (action === 'complete') {
      const { error: updateError } = await supabaseAdmin
        .from('user_quests')
        .update({ progress: 1 })
        .eq('user_id', userId)
        .eq('quest_id', questId)
        .eq('day', dayFilter);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    // Default action: Claim reward
    // 1. Fetch quest
    const { data: quest, error: fetchError } = await supabaseAdmin
      .from('user_quests')
      .select('*')
      .eq('user_id', userId)
      .eq('quest_id', questId)
      .eq('day', dayFilter)
      .maybeSingle();

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
    if (!quest) return NextResponse.json({ error: 'Quest not found' }, { status: 404 });
    if (quest.claimed) return NextResponse.json({ error: 'Reward already claimed' }, { status: 400 });
    if (quest.progress < quest.target) return NextResponse.json({ error: 'Quest not completed' }, { status: 400 });

    // 2. Fetch user's current tickets
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('pack_tickets')
      .eq('id', userId)
      .single();

    if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });

    // Fetch dynamic config, fallback to hardcoded
    let config = QUESTS_CONFIG.find(c => c.id === questId) || MAIN_QUESTS_CONFIG.find(c => c.id === questId);
    try {
      const { data: dbConfig, error: dbConfigError } = await supabaseAdmin
        .from('quest_definitions')
        .select('*')
        .eq('id', questId)
        .maybeSingle();
        
      if (!dbConfigError && dbConfig) {
        config = dbConfig;
      }
    } catch (e) {
      console.warn('Failed to fetch quest definition from database, using fallback config:', e);
    }

    if (!config) return NextResponse.json({ error: 'Invalid quest config' }, { status: 400 });

    const newTickets = (user.pack_tickets || 0) + config.reward;

    // 3. Mark claimed and grant tickets in transaction/sequence
    const { error: updateQuestError } = await supabaseAdmin
      .from('user_quests')
      .update({ claimed: true })
      .eq('user_id', userId)
      .eq('quest_id', questId)
      .eq('day', dayFilter);

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
        .eq('day', dayFilter);
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
