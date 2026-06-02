import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // 1. Fetch all achievements definitions
    const { data: allAchievements, error: achError } = await supabaseAdmin
      .from('achievements')
      .select('*')
      .order('reward_value', { ascending: true });

    if (achError || !allAchievements) {
      console.error('Database query achievements definitions error:', achError);
      return NextResponse.json({ error: 'Database query error' }, { status: 500 });
    }

    // 2. Fetch user's unlocked achievements
    const { data: userUnlocked, error: unlockedError } = await supabaseAdmin
      .from('user_achievements')
      .select('achievement_id, unlocked_at')
      .eq('user_id', userId);

    if (unlockedError) {
      console.error('Database query user achievements error:', unlockedError);
      return NextResponse.json({ error: 'Database query error' }, { status: 500 });
    }

    const unlockedMap = new Map<string, string>(
      userUnlocked.map((row: any) => [row.achievement_id, row.unlocked_at])
    );

    // 3. Map status to each achievement
    const achievementsWithStatus = allAchievements.map((ach: any) => {
      const unlockedAt = unlockedMap.get(ach.id) || null;
      return {
        ...ach,
        unlocked: !!unlockedAt,
        unlockedAt
      };
    });

    return NextResponse.json({ achievements: achievementsWithStatus });
  } catch (error) {
    console.error('Achievements API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
