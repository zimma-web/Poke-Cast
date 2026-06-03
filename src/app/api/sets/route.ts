import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  const filePath = path.join(process.cwd(), 'public', 'data', 'pokemon_sets.json');
  
  try {
    const { searchParams } = new URL(request.url);
    const includeAll = searchParams.get('all') === 'true';

    const fileContents = fs.readFileSync(filePath, 'utf8');
    const localSets = JSON.parse(fileContents);

    // 1. Fetch pack settings from database
    const { data: dbSettings, error: dbError } = await supabaseAdmin
      .from('pack_settings')
      .select('set_id, pack_enabled, featured_pack');

    const settingsMap = new Map();
    if (!dbError && dbSettings) {
      dbSettings.forEach((s: any) => {
        settingsMap.set(s.set_id, s);
      });
    }

    // 2. Map settings, filter if not including all, and sort
    const mappedSets = localSets.map((set: any) => {
      const setting = settingsMap.get(set.id) || { pack_enabled: true, featured_pack: false };
      return {
        ...set,
        pack_enabled: setting.pack_enabled,
        featured_pack: setting.featured_pack,
      };
    });

    const filteredSets = includeAll 
      ? mappedSets 
      : mappedSets.filter((set: any) => set.pack_enabled !== false);

    // Sort: Featured packs first
    const sortedSets = filteredSets.sort((a: any, b: any) => {
      const aFeatured = a.featured_pack ? 1 : 0;
      const bFeatured = b.featured_pack ? 1 : 0;
      return bFeatured - aFeatured;
    });

    return NextResponse.json({
      sets: sortedSets,
      total: sortedSets.length
    });
  } catch (error) {
    console.error('Failed to load sets with settings:', error);
    return NextResponse.json({ error: 'Failed to load sets' }, { status: 500 });
  }
}
