import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { supabaseAdmin, fetchAllUserCards } from '@/lib/supabase';

// Absolute file paths to card databases
const CARDS_FILE_PATH = path.join(process.cwd(), 'public', 'data', 'pokemon_cards.json');
const SETS_FILE_PATH = path.join(process.cwd(), 'public', 'data', 'pokemon_sets.json');

function readJsonFile(filePath: string) {
  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (err) {
    console.error(`Failed to read file ${filePath}:`, err);
    return [];
  }
}

function writeJsonFile(filePath: string, data: any) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Failed to write file ${filePath}:`, err);
    return false;
  }
}

// Write persistent audit log to Supabase admin_logs table
async function writeAuditLog(adminUserId: string, action: string, details: string, targetUserId?: string) {
  try {
    await supabaseAdmin.from('admin_logs').insert({
      admin_user_id: adminUserId,
      action,
      details,
      target_user_id: targetUserId || null
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

// Verify admin role from Supabase
async function verifyAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;
  const { data } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle();
  return data?.is_admin === true;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, payload, adminUserId } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    // Legacy password-based login for backward compatibility
    const expectedPassword = process.env.ADMIN_PASSWORD || 'ZeemmyAdmin07';
    if (action === 'login') {
      const { password } = payload || {};
      if (password === expectedPassword) {
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    // All other actions require admin verification
    // Support both role-based (adminUserId) and legacy password header
    const adminPasswordHeader = request.headers.get('x-admin-password');
    const isLegacyAuth = adminPasswordHeader === expectedPassword;
    const isRoleAuth = adminUserId ? await verifyAdmin(adminUserId) : false;

    if (!isLegacyAuth && !isRoleAuth) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 });
    }

    const effectiveAdminId = adminUserId || null;

    // ─── STATS ───────────────────────────────────────────────────────────────
    if (action === 'stats') {
      const dbStart = Date.now();
      const { count: userCount, error: userCountError } = await supabaseAdmin
        .from('users').select('*', { count: 'exact', head: true });
      const dbLatency = Date.now() - dbStart;

      const { count: cardCount } = await supabaseAdmin
        .from('user_cards').select('*', { count: 'exact', head: true });

      const { count: wishlistCount } = await supabaseAdmin
        .from('user_wishlist').select('*', { count: 'exact', head: true });

      const { count: tradeCount } = await supabaseAdmin
        .from('trade_offers').select('*', { count: 'exact', head: true });

      const { data: sumData } = await supabaseAdmin.from('users').select('packs_opened');
      const totalPacks = sumData ? sumData.reduce((s, u) => s + (u.packs_opened || 0), 0) : 0;

      // Daily active users: logged in within last 24h
      const since24h = new Date(Date.now() - 86400000).toISOString();
      const { count: dauCount } = await supabaseAdmin
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('last_login_date', since24h.split('T')[0]);

      // New users today
      const todayStr = new Date().toISOString().split('T')[0];
      const { count: newUsersToday } = await supabaseAdmin
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${todayStr}T00:00:00.000Z`);

      const localCards = readJsonFile(CARDS_FILE_PATH);
      const localSets = readJsonFile(SETS_FILE_PATH);

      return NextResponse.json({
        totalUsers: userCount || 0,
        dailyActiveUsers: dauCount || 0,
        newUsersToday: newUsersToday || 0,
        totalCardsClaimed: cardCount || 0,
        totalPacksOpened: totalPacks,
        totalWishlists: wishlistCount || 0,
        totalTrades: tradeCount || 0,
        databaseLatencyMs: dbLatency,
        databaseStatus: userCountError ? 'Error' : 'Healthy',
        totalAvailableCards: localCards.length,
        totalAvailableSets: localSets.length,
        serverTime: new Date().toISOString(),
      });
    }

    // ─── USERS LIST ──────────────────────────────────────────────────────────
    if (action === 'users_list') {
      const { search = '', limit = 100 } = payload || {};
      let query = supabaseAdmin
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (search) {
        query = query.or(`username.ilike.%${search}%,fid.eq.${isNaN(Number(search)) ? -1 : Number(search)}`);
      }

      const { data: users, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Enrich with card counts
      const enriched = await Promise.all((users || []).map(async (u: any) => {
        const { count } = await supabaseAdmin
          .from('user_cards').select('*', { count: 'exact', head: true }).eq('user_id', u.id);
        return { ...u, totalCards: count || 0 };
      }));

      return NextResponse.json({ users: enriched });
    }

    // ─── USER DETAIL ─────────────────────────────────────────────────────────
    if (action === 'user_detail') {
      const { userId } = payload || {};
      if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

      const { data: user, error: userError } = await supabaseAdmin
        .from('users').select('*').eq('id', userId).single();
      if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });

      let userCards: any[] = [];
      try {
        userCards = await fetchAllUserCards(userId);
      } catch (cardsError: any) {
        console.error('Failed to query user cards for admin:', cardsError);
      }

      // Count unique cards
      const uniqueCardIds = new Set((userCards || []).map((c: any) => c.card_id));

      return NextResponse.json({
        user,
        cards: userCards || [],
        totalCards: (userCards || []).length,
        uniqueCards: uniqueCardIds.size
      });
    }

    // ─── USER UPDATE ─────────────────────────────────────────────────────────
    if (action === 'user_update') {
      const { userId, username, avatar, packsOpened } = payload || {};
      if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

      const { data: updatedUser, error } = await supabaseAdmin
        .from('users')
        .update({ username, avatar, packs_opened: packsOpened })
        .eq('id', userId).select('*').single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (effectiveAdminId) await writeAuditLog(effectiveAdminId, 'USER_UPDATE', `Updated profile for ${username}`, userId);
      return NextResponse.json({ user: updatedUser });
    }

    // ─── ADD TICKETS ─────────────────────────────────────────────────────────
    if (action === 'add_tickets') {
      const { userId, amount } = payload || {};
      if (!userId || !amount) return NextResponse.json({ error: 'userId and amount are required' }, { status: 400 });

      const { data: user } = await supabaseAdmin.from('users').select('pack_tickets, username').eq('id', userId).single();
      const newBalance = (user?.pack_tickets || 0) + Number(amount);

      const { error } = await supabaseAdmin.from('users').update({ pack_tickets: newBalance }).eq('id', userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      if (effectiveAdminId) await writeAuditLog(effectiveAdminId, 'ADD_TICKETS', `Added ${amount} tickets to ${user?.username || userId} (new balance: ${newBalance})`, userId);
      return NextResponse.json({ success: true, newBalance });
    }

    // ─── REMOVE TICKETS ──────────────────────────────────────────────────────
    if (action === 'remove_tickets') {
      const { userId, amount } = payload || {};
      if (!userId || !amount) return NextResponse.json({ error: 'userId and amount are required' }, { status: 400 });

      const { data: user } = await supabaseAdmin.from('users').select('pack_tickets, username').eq('id', userId).single();
      const newBalance = Math.max(0, (user?.pack_tickets || 0) - Number(amount));

      const { error } = await supabaseAdmin.from('users').update({ pack_tickets: newBalance }).eq('id', userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      if (effectiveAdminId) await writeAuditLog(effectiveAdminId, 'REMOVE_TICKETS', `Removed ${amount} tickets from ${user?.username || userId} (new balance: ${newBalance})`, userId);
      return NextResponse.json({ success: true, newBalance });
    }

    // ─── RESET STREAK ────────────────────────────────────────────────────────
    if (action === 'reset_streak') {
      const { userId } = payload || {};
      if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

      const { data: user } = await supabaseAdmin.from('users').select('username').eq('id', userId).single();
      const { error } = await supabaseAdmin
        .from('users')
        .update({ login_streak: 0, last_login_date: null })
        .eq('id', userId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (effectiveAdminId) await writeAuditLog(effectiveAdminId, 'RESET_STREAK', `Reset login streak for ${user?.username || userId}`, userId);
      return NextResponse.json({ success: true });
    }

    // ─── HIDE USER ───────────────────────────────────────────────────────────
    if (action === 'hide_user') {
      const { userId } = payload || {};
      if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

      const { data: user } = await supabaseAdmin.from('users').select('username').eq('id', userId).single();
      const { error } = await supabaseAdmin
        .from('users')
        .update({ is_hidden: true })
        .eq('id', userId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (effectiveAdminId) await writeAuditLog(effectiveAdminId, 'HIDE_USER', `Hid user ${user?.username || userId} from leaderboard`, userId);
      return NextResponse.json({ success: true });
    }

    // ─── UNHIDE USER ─────────────────────────────────────────────────────────
    if (action === 'unhide_user') {
      const { userId } = payload || {};
      if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

      const { data: user } = await supabaseAdmin.from('users').select('username').eq('id', userId).single();
      const { error } = await supabaseAdmin
        .from('users')
        .update({ is_hidden: false })
        .eq('id', userId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (effectiveAdminId) await writeAuditLog(effectiveAdminId, 'UNHIDE_USER', `Unhid user ${user?.username || userId} from leaderboard`, userId);
      return NextResponse.json({ success: true });
    }

    // ─── BAN USER ────────────────────────────────────────────────────────────
    if (action === 'ban_user') {
      const { userId, reason } = payload || {};
      if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

      const { data: user } = await supabaseAdmin.from('users').select('username').eq('id', userId).single();
      const { error } = await supabaseAdmin
        .from('users')
        .update({ is_banned: true, banned_at: new Date().toISOString(), ban_reason: reason || 'Admin action' })
        .eq('id', userId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (effectiveAdminId) await writeAuditLog(effectiveAdminId, 'BAN_USER', `Banned user ${user?.username || userId}: ${reason || 'No reason'}`, userId);
      return NextResponse.json({ success: true });
    }

    // ─── UNBAN USER ──────────────────────────────────────────────────────────
    if (action === 'unban_user') {
      const { userId } = payload || {};
      if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

      const { data: user } = await supabaseAdmin.from('users').select('username').eq('id', userId).single();
      const { error } = await supabaseAdmin
        .from('users')
        .update({ is_banned: false, banned_at: null, ban_reason: null })
        .eq('id', userId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (effectiveAdminId) await writeAuditLog(effectiveAdminId, 'UNBAN_USER', `Unbanned user ${user?.username || userId}`, userId);
      return NextResponse.json({ success: true });
    }

    // ─── USER DELETE ─────────────────────────────────────────────────────────
    if (action === 'user_delete') {
      const { userId } = payload || {};
      if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

      const { data: user } = await supabaseAdmin.from('users').select('username').eq('id', userId).single();
      const { error } = await supabaseAdmin.from('users').delete().eq('id', userId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (effectiveAdminId) await writeAuditLog(effectiveAdminId, 'USER_DELETE', `Deleted account for ${user?.username || userId}`);
      return NextResponse.json({ success: true });
    }

    // ─── USER CLEAR COLLECTION ───────────────────────────────────────────────
    if (action === 'user_clear') {
      const { userId } = payload || {};
      if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

      const { data: user } = await supabaseAdmin.from('users').select('username').eq('id', userId).single();
      const { error } = await supabaseAdmin.from('user_cards').delete().eq('user_id', userId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (effectiveAdminId) await writeAuditLog(effectiveAdminId, 'USER_CLEAR', `Cleared all cards for ${user?.username || userId}`, userId);
      return NextResponse.json({ success: true });
    }

    // ─── USER GRANT CARDS ────────────────────────────────────────────────────
    if (action === 'user_grant') {
      const { userId, count = 10, setId } = payload || {};
      if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

      const cards = readJsonFile(CARDS_FILE_PATH);
      let pool = setId ? cards.filter((c: any) => c.setId === setId) : cards;
      if (pool.length === 0) return NextResponse.json({ error: 'No cards available to grant' }, { status: 400 });

      const inserts = [];
      for (let i = 0; i < count; i++) {
        const randCard = pool[Math.floor(Math.random() * pool.length)];
        inserts.push({ user_id: userId, card_id: randCard.id, source_set_id: randCard.setId, obtained_at: new Date().toISOString() });
      }

      const { error } = await supabaseAdmin.from('user_cards').insert(inserts);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const { data: user } = await supabaseAdmin.from('users').select('username').eq('id', userId).single();
      if (effectiveAdminId) await writeAuditLog(effectiveAdminId, 'USER_GRANT', `Granted ${count} cards to ${user?.username || userId}`, userId);
      return NextResponse.json({ success: true, grantedCount: count });
    }

    // ─── PACK LIST ───────────────────────────────────────────────────────────
    if (action === 'pack_list') {
      const sets = readJsonFile(SETS_FILE_PATH);

      // Get settings from DB
      const { data: settings } = await supabaseAdmin.from('pack_settings').select('*');
      const settingsMap = new Map((settings || []).map((s: any) => [s.set_id, s]));

      const packsWithSettings = sets.map((set: any) => {
        const setting = settingsMap.get(set.id) || { pack_enabled: true, featured_pack: false };
        return { ...set, pack_enabled: setting.pack_enabled, featured_pack: setting.featured_pack };
      });

      return NextResponse.json({ packs: packsWithSettings });
    }

    // ─── PACK UPDATE ─────────────────────────────────────────────────────────
    if (action === 'pack_update') {
      const { setId, pack_enabled, featured_pack } = payload || {};
      if (!setId) return NextResponse.json({ error: 'setId is required' }, { status: 400 });

      const { error } = await supabaseAdmin
        .from('pack_settings')
        .upsert({ set_id: setId, pack_enabled, featured_pack, updated_at: new Date().toISOString() }, { onConflict: 'set_id' });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (effectiveAdminId) await writeAuditLog(effectiveAdminId, 'PACK_UPDATE', `Updated pack ${setId}: enabled=${pack_enabled}, featured=${featured_pack}`);
      return NextResponse.json({ success: true });
    }

    // ─── PACK DISABLE ALL ────────────────────────────────────────────────────
    if (action === 'pack_disable_all') {
      const sets = readJsonFile(SETS_FILE_PATH);
      const upserts = sets.map((set: any) => ({
        set_id: set.id,
        pack_enabled: false,
        featured_pack: false,
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabaseAdmin
        .from('pack_settings')
        .upsert(upserts, { onConflict: 'set_id' });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (effectiveAdminId) await writeAuditLog(effectiveAdminId, 'PACK_DISABLE_ALL', 'Disabled all booster packs');
      return NextResponse.json({ success: true });
    }

    // ─── PACK ENABLE ALL ─────────────────────────────────────────────────────
    if (action === 'pack_enable_all') {
      const sets = readJsonFile(SETS_FILE_PATH);
      const upserts = sets.map((set: any) => ({
        set_id: set.id,
        pack_enabled: true,
        featured_pack: false,
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabaseAdmin
        .from('pack_settings')
        .upsert(upserts, { onConflict: 'set_id' });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (effectiveAdminId) await writeAuditLog(effectiveAdminId, 'PACK_ENABLE_ALL', 'Enabled all booster packs');
      return NextResponse.json({ success: true });
    }

    // ─── EVENT LIST ──────────────────────────────────────────────────────────
    if (action === 'event_list') {
      const { data: events, error } = await supabaseAdmin
        .from('event_packs').select('*').order('created_at', { ascending: false });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ events: events || [] });
    }

    // ─── EVENT CREATE ────────────────────────────────────────────────────────
    if (action === 'event_create') {
      const { name, description, start_date, end_date, bonus_drop_rate } = payload || {};
      if (!name || !start_date || !end_date) {
        return NextResponse.json({ error: 'name, start_date, end_date are required' }, { status: 400 });
      }

      const { data: event, error } = await supabaseAdmin
        .from('event_packs')
        .insert({ name, description, start_date, end_date, bonus_drop_rate: bonus_drop_rate || 1.0, is_active: true })
        .select('*').single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (effectiveAdminId) await writeAuditLog(effectiveAdminId, 'EVENT_CREATE', `Created event pack: ${name}`);
      return NextResponse.json({ success: true, event });
    }

    // ─── EVENT UPDATE ────────────────────────────────────────────────────────
    if (action === 'event_update') {
      const { eventId, name, description, start_date, end_date, bonus_drop_rate, is_active } = payload || {};
      if (!eventId) return NextResponse.json({ error: 'eventId is required' }, { status: 400 });

      const { data: event, error } = await supabaseAdmin
        .from('event_packs')
        .update({ name, description, start_date, end_date, bonus_drop_rate, is_active })
        .eq('id', eventId).select('*').single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (effectiveAdminId) await writeAuditLog(effectiveAdminId, 'EVENT_UPDATE', `Updated event pack: ${name || eventId}`);
      return NextResponse.json({ success: true, event });
    }

    // ─── EVENT DELETE ────────────────────────────────────────────────────────
    if (action === 'event_delete') {
      const { eventId } = payload || {};
      if (!eventId) return NextResponse.json({ error: 'eventId is required' }, { status: 400 });

      const { data: ev } = await supabaseAdmin.from('event_packs').select('name').eq('id', eventId).single();
      const { error } = await supabaseAdmin.from('event_packs').delete().eq('id', eventId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (effectiveAdminId) await writeAuditLog(effectiveAdminId, 'EVENT_DELETE', `Deleted event pack: ${ev?.name || eventId}`);
      return NextResponse.json({ success: true });
    }

    // ─── CARD UPDATE ─────────────────────────────────────────────────────────
    if (action === 'card_update') {
      const { cardId, updatedFields } = payload || {};
      if (!cardId || !updatedFields) return NextResponse.json({ error: 'cardId and updatedFields are required' }, { status: 400 });

      const cards = readJsonFile(CARDS_FILE_PATH);
      const cardIndex = cards.findIndex((c: any) => c.id === cardId);
      if (cardIndex === -1) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

      cards[cardIndex] = { ...cards[cardIndex], ...updatedFields };
      const success = writeJsonFile(CARDS_FILE_PATH, cards);
      if (!success) return NextResponse.json({ error: 'Failed to write card updates' }, { status: 500 });

      if (effectiveAdminId) await writeAuditLog(effectiveAdminId, 'CARD_UPDATE', `Updated card: ${cards[cardIndex].name}`);
      return NextResponse.json({ success: true, card: cards[cardIndex] });
    }

    // ─── CARD HIDE / UNHIDE ──────────────────────────────────────────────────
    if (action === 'card_hide' || action === 'card_unhide') {
      const { cardId } = payload || {};
      if (!cardId) return NextResponse.json({ error: 'cardId is required' }, { status: 400 });

      const cards = readJsonFile(CARDS_FILE_PATH);
      const cardIndex = cards.findIndex((c: any) => c.id === cardId);
      if (cardIndex === -1) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

      cards[cardIndex].hidden = action === 'card_hide';
      const success = writeJsonFile(CARDS_FILE_PATH, cards);
      if (!success) return NextResponse.json({ error: 'Failed to write card updates' }, { status: 500 });

      const verb = action === 'card_hide' ? 'Hidden' : 'Unhidden';
      if (effectiveAdminId) await writeAuditLog(effectiveAdminId, action.toUpperCase(), `${verb} card: ${cards[cardIndex].name}`);
      return NextResponse.json({ success: true });
    }

    // ─── SET UPDATE ──────────────────────────────────────────────────────────
    if (action === 'set_update') {
      const { setId, updatedFields } = payload || {};
      if (!setId || !updatedFields) return NextResponse.json({ error: 'setId and updatedFields are required' }, { status: 400 });

      const sets = readJsonFile(SETS_FILE_PATH);
      const setIndex = sets.findIndex((s: any) => s.id === setId);
      if (setIndex === -1) return NextResponse.json({ error: 'Set not found' }, { status: 404 });

      sets[setIndex] = { ...sets[setIndex], ...updatedFields };
      const success = writeJsonFile(SETS_FILE_PATH, sets);
      if (!success) return NextResponse.json({ error: 'Failed to write set updates' }, { status: 500 });

      if (effectiveAdminId) await writeAuditLog(effectiveAdminId, 'SET_UPDATE', `Updated set: ${sets[setIndex].name}`);
      return NextResponse.json({ success: true, set: sets[setIndex] });
    }

    // ─── ANALYTICS ───────────────────────────────────────────────────────────
    if (action === 'analytics') {
      const todayStr = new Date().toISOString().split('T')[0];

      // Daily active users (last 7 days)
      const dauData = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
        const { count } = await supabaseAdmin
          .from('users').select('*', { count: 'exact', head: true }).eq('last_login_date', d);
        dauData.push({ date: d, users: count || 0 });
      }

      // New users today
      const { count: newToday } = await supabaseAdmin
        .from('users').select('*', { count: 'exact', head: true })
        .gte('created_at', `${todayStr}T00:00:00.000Z`);

      // Packs opened today (users whose last login_streak update was today - approximate)
      const { data: recentRewards } = await supabaseAdmin
        .from('login_rewards').select('user_id')
        .gte('claimed_at', `${todayStr}T00:00:00.000Z`);
      const packsToday = recentRewards?.length || 0;

      // Most collected card (top by count in user_cards)
      const { data: topCardsRaw } = await supabaseAdmin
        .from('user_cards').select('card_id');

      const cardCounts: Record<string, number> = {};
      (topCardsRaw || []).forEach((r: any) => {
        cardCounts[r.card_id] = (cardCounts[r.card_id] || 0) + 1;
      });
      const topCardId = Object.entries(cardCounts).sort((a, b) => b[1] - a[1])[0];

      // Most wishlisted card
      const { data: topWishRaw } = await supabaseAdmin.from('user_wishlist').select('card_id');
      const wishCounts: Record<string, number> = {};
      (topWishRaw || []).forEach((r: any) => {
        wishCounts[r.card_id] = (wishCounts[r.card_id] || 0) + 1;
      });
      const topWishId = Object.entries(wishCounts).sort((a, b) => b[1] - a[1])[0];

      // Most opened set (by user_cards source_set_id)
      const { data: packRaw } = await supabaseAdmin.from('user_cards').select('source_set_id');
      const packCounts: Record<string, number> = {};
      (packRaw || []).forEach((r: any) => {
        if (r.source_set_id) packCounts[r.source_set_id] = (packCounts[r.source_set_id] || 0) + 1;
      });
      const topPackId = Object.entries(packCounts).sort((a, b) => b[1] - a[1])[0];

      // Resolve card names from local JSON
      const cards = readJsonFile(CARDS_FILE_PATH);
      const cardMap = new Map(cards.map((c: any) => [c.id, c]));
      const sets = readJsonFile(SETS_FILE_PATH);
      const setMap = new Map(sets.map((s: any) => [s.id, s]));

      return NextResponse.json({
        dauData,
        newUsersToday: newToday || 0,
        packsOpenedToday: packsToday,
        mostOpenedPack: topPackId ? { id: topPackId[0], count: topPackId[1], name: (setMap.get(topPackId[0]) as any)?.name || topPackId[0] } : null,
        mostCollectedCard: topCardId ? { id: topCardId[0], count: topCardId[1], card: cardMap.get(topCardId[0]) || null } : null,
        mostWishlistedCard: topWishId ? { id: topWishId[0], count: topWishId[1], card: cardMap.get(topWishId[0]) || null } : null,
      });
    }

    // ─── AUDIT LOGS ──────────────────────────────────────────────────────────
    if (action === 'audit_logs') {
      const { limit = 100 } = payload || {};
      const { data: logs, error } = await supabaseAdmin
        .from('admin_logs')
        .select('*, admin:admin_user_id(username), target:target_user_id(username)')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ logs: logs || [] });
    }

    // ─── SIMULATE PACKS ──────────────────────────────────────────────────────
    if (action === 'simulate_packs') {
      const { setId } = payload || {};
      if (!setId) return NextResponse.json({ error: 'setId is required' }, { status: 400 });

      const cards = readJsonFile(CARDS_FILE_PATH);
      const setCards = cards.filter((c: any) => c.setId === setId);
      if (setCards.length === 0) return NextResponse.json({ error: 'No cards found in set' }, { status: 404 });

      const rarePool = setCards.filter((c: any) => c.rarity !== 'Common' && c.rarity !== 'Uncommon' && c.rarity);
      const rarityCounts: Record<string, number> = {};
      const totalPulls = 5000;

      function getRarityWeight(rarity: string): number {
        const r = rarity.toLowerCase();
        if (r.includes('secret') || r.includes('hyper') || r.includes('rainbow') || r.includes('special illustration') || r.includes('gold')) return 2;
        if (r.includes('illustration') || r.includes('shining') || r.includes('shiny ultra') || r.includes('radiant')) return 8;
        if (r.includes('ultra') || r.includes('double') || r.includes('vmax') || r.includes('vstar') || r.includes('ex') || r.includes('gx') || r.includes('v') || r.includes('break') || r.includes('prism')) return 25;
        if (r.includes('holo') || r.includes('shiny') || r.includes('promo')) return 65;
        return 100;
      }

      if (rarePool.length > 0) {
        const poolsByRarity: Record<string, any[]> = {};
        rarePool.forEach((c: any) => {
          const rarityName = c.rarity || 'Rare';
          if (!poolsByRarity[rarityName]) poolsByRarity[rarityName] = [];
          poolsByRarity[rarityName].push(c);
        });

        const poolWeights = Object.keys(poolsByRarity).map(rarityName => ({ rarityName, weight: getRarityWeight(rarityName) }));
        const totalWeight = poolWeights.reduce((sum, item) => sum + item.weight, 0);

        for (let i = 0; i < totalPulls; i++) {
          let roll = Math.random() * totalWeight;
          let selectedRarity = poolWeights[0].rarityName;
          for (const item of poolWeights) {
            roll -= item.weight;
            if (roll <= 0) { selectedRarity = item.rarityName; break; }
          }
          rarityCounts[selectedRarity] = (rarityCounts[selectedRarity] || 0) + 1;
        }
      }

      const distribution = Object.entries(rarityCounts).map(([rarity, count]) => ({
        rarity, count, percentage: ((count / totalPulls) * 100).toFixed(2)
      }));

      return NextResponse.json({ distribution, totalSimulatedPulls: totalPulls });
    }

    // ─── ADD POINTS ──────────────────────────────────────────────────────────
    if (action === 'add_points') {
      const { userId, amount, reason } = payload || {};
      if (!userId || !amount) return NextResponse.json({ error: 'userId and amount are required' }, { status: 400 });

      const { data: user } = await supabaseAdmin.from('users').select('pokepoints, lifetime_points, username').eq('id', userId).single();
      const pointsToAdd = Number(amount);
      const newPoints = (user?.pokepoints || 0) + pointsToAdd;
      const newLifetime = (user?.lifetime_points || 0) + pointsToAdd;

      const { error } = await supabaseAdmin
        .from('users')
        .update({ pokepoints: newPoints, lifetime_points: newLifetime })
        .eq('id', userId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Add to points history
      await supabaseAdmin.from('user_points_history').insert({
        user_id: userId,
        action_type: 'admin_add',
        points: pointsToAdd,
        metadata: { reason: reason || 'Admin manual add', adminId: effectiveAdminId }
      });

      if (effectiveAdminId) await writeAuditLog(effectiveAdminId, 'ADD_POINTS', `Added ${amount} PokePoints to ${user?.username || userId} (new balance: ${newPoints})`, userId);
      return NextResponse.json({ success: true, newPoints, newLifetime });
    }

    // ─── REMOVE POINTS ───────────────────────────────────────────────────────
    if (action === 'remove_points') {
      const { userId, amount, reason } = payload || {};
      if (!userId || !amount) return NextResponse.json({ error: 'userId and amount are required' }, { status: 400 });

      const { data: user } = await supabaseAdmin.from('users').select('pokepoints, username').eq('id', userId).single();
      const pointsToRemove = Number(amount);
      const newPoints = Math.max(0, (user?.pokepoints || 0) - pointsToRemove);

      const { error } = await supabaseAdmin
        .from('users')
        .update({ pokepoints: newPoints })
        .eq('id', userId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Add to points history
      await supabaseAdmin.from('user_points_history').insert({
        user_id: userId,
        action_type: 'admin_remove',
        points: -pointsToRemove,
        metadata: { reason: reason || 'Admin manual remove', adminId: effectiveAdminId }
      });

      if (effectiveAdminId) await writeAuditLog(effectiveAdminId, 'REMOVE_POINTS', `Removed ${amount} PokePoints from ${user?.username || userId} (new balance: ${newPoints})`, userId);
      return NextResponse.json({ success: true, newPoints });
    }

    // ─── GET POINTS HISTORY ──────────────────────────────────────────────────
    if (action === 'get_points_history') {
      const { userId, limit = 50 } = payload || {};
      if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

      const { data: history, error } = await supabaseAdmin
        .from('user_points_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ history: history || [] });
    }

    // ─── TOGGLE ADMIN ROLE ───────────────────────────────────────────────────
    if (action === 'toggle_admin') {
      const { userId } = payload || {};
      if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

      const { data: user } = await supabaseAdmin.from('users').select('is_admin, username').eq('id', userId).single();
      const newAdminState = !user?.is_admin;

      const { error } = await supabaseAdmin
        .from('users')
        .update({ is_admin: newAdminState })
        .eq('id', userId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (effectiveAdminId) {
        const actionVerb = newAdminState ? 'Granted admin role' : 'Revoked admin role';
        await writeAuditLog(effectiveAdminId, 'TOGGLE_ADMIN', `${actionVerb} for user ${user?.username || userId}`, userId);
      }
      return NextResponse.json({ success: true, is_admin: newAdminState });
    }

    // ─── ADMIN AUCTIONS LIST ─────────────────────────────────────────────────
    if (action === 'admin_auctions_list') {
      const { data: auctions, error } = await supabaseAdmin
        .from('auctions')
        .select('*, seller:seller_id(username), bidder:highest_bidder_id(username)')
        .order('created_at', { ascending: false });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ auctions: auctions || [] });
    }

    // ─── ADMIN AUCTION CANCEL ────────────────────────────────────────────────
    if (action === 'admin_auction_cancel') {
      const { auctionId } = payload || {};
      if (!auctionId) return NextResponse.json({ error: 'auctionId is required' }, { status: 400 });

      const { data: auction } = await supabaseAdmin.from('auctions').select('status, seller_id').eq('id', auctionId).single();
      if (!auction) return NextResponse.json({ error: 'Auction not found' }, { status: 404 });

      const { error } = await supabaseAdmin
        .from('auctions')
        .update({ status: 'cancelled' })
        .eq('id', auctionId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (effectiveAdminId) await writeAuditLog(effectiveAdminId, 'AUCTION_CANCEL', `Force-cancelled auction ${auctionId}`, auction.seller_id);
      return NextResponse.json({ success: true });
    }

    // ─── ADMIN AUCTION COMPLETE ──────────────────────────────────────────────
    if (action === 'admin_auction_complete') {
      const { auctionId } = payload || {};
      if (!auctionId) return NextResponse.json({ error: 'auctionId is required' }, { status: 400 });

      const { data: auction } = await supabaseAdmin.from('auctions').select('*').eq('id', auctionId).single();
      if (!auction) return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
      if (auction.status !== 'active' && auction.status !== 'pending_payment') {
        return NextResponse.json({ error: 'Auction is not in active or pending state' }, { status: 400 });
      }
      if (!auction.highest_bidder_id) {
        return NextResponse.json({ error: 'Cannot complete auction without a highest bidder' }, { status: 400 });
      }

      // 1. Transfer main card
      const { error: transferError } = await supabaseAdmin
        .from('user_cards')
        .update({ user_id: auction.highest_bidder_id })
        .eq('id', auction.user_card_id);

      if (transferError) return NextResponse.json({ error: 'Failed to transfer main card' }, { status: 500 });

      // 2. Transfer additional cards
      if (auction.additional_user_card_ids && Array.isArray(auction.additional_user_card_ids)) {
        const { error: additionalTransferError } = await supabaseAdmin
          .from('user_cards')
          .update({ user_id: auction.highest_bidder_id })
          .in('id', auction.additional_user_card_ids);

        if (additionalTransferError) console.error('Failed to transfer additional cards:', additionalTransferError);
      }

      // 3. Award +15 PokePoints to seller
      try {
        const { awardPoints } = await import('@/lib/pokepoints');
        await awardPoints(auction.seller_id, 'marketplace_sale', 15, auctionId, { price: auction.highest_bid });
      } catch (e) {
        console.error('Failed to award PokePoints:', e);
      }

      // 4. Update status to completed
      const { error: updateError } = await supabaseAdmin
        .from('auctions')
        .update({ status: 'completed' })
        .eq('id', auctionId);

      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
      if (effectiveAdminId) await writeAuditLog(effectiveAdminId, 'AUCTION_COMPLETE', `Force-completed auction ${auctionId} for buyer ${auction.highest_bidder_id}`, auction.seller_id);
      return NextResponse.json({ success: true });
    }

    // ─── ADMIN QUESTS LIST ───────────────────────────────────────────────────
    if (action === 'admin_quests_list') {
      const { data: quests, error } = await supabaseAdmin
        .from('quest_definitions')
        .select('*')
        .order('is_main', { ascending: true })
        .order('id', { ascending: true });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ quests: quests || [] });
    }

    // ─── ADMIN QUEST UPDATE ──────────────────────────────────────────────────
    if (action === 'admin_quest_update') {
      const { questId, title, description, target, reward, link } = payload || {};
      if (!questId) return NextResponse.json({ error: 'questId is required' }, { status: 400 });

      const { error } = await supabaseAdmin
        .from('quest_definitions')
        .upsert({
          id: questId,
          title,
          description,
          target: Number(target) || 1,
          reward: Number(reward) || 1,
          link: link || null
        });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (effectiveAdminId) await writeAuditLog(effectiveAdminId, 'QUEST_UPDATE', `Updated quest definition for ${questId}`);
      return NextResponse.json({ success: true });
    }

    // ─── ADMIN LIVE LOGS ─────────────────────────────────────────────────────
    if (action === 'admin_live_logs') {
      const { limit = 100 } = payload || {};

      // Query recent pack openings
      const { data: packs } = await supabaseAdmin
        .from('pack_openings')
        .select('*, user:user_id(username)')
        .order('created_at', { ascending: false })
        .limit(limit);

      // Query recent ticket purchases
      const { data: purchases } = await supabaseAdmin
        .from('ticket_purchases')
        .select('*, user:user_id(username)')
        .order('created_at', { ascending: false })
        .limit(limit);

      // Query recent point adjustments (user_points_history)
      const { data: points } = await supabaseAdmin
        .from('user_points_history')
        .select('*, user:user_id(username)')
        .order('created_at', { ascending: false })
        .limit(limit);

      // Merge, sort, and slice logs
      const allLogs = [
        ...(packs || []).map(p => ({
          id: p.id,
          type: 'pack_open',
          username: p.user?.username || `FID ${p.user_id}`,
          details: `Opened pack from set: ${p.set_id}`,
          tx_hash: p.tx_hash,
          created_at: p.created_at
        })),
        ...(purchases || []).map(p => ({
          id: p.id,
          type: 'topup',
          username: p.user?.username || `FID ${p.user_id}`,
          details: `Purchased ${p.amount} tickets for $${p.cost_usd}`,
          tx_hash: p.tx_hash,
          created_at: p.created_at
        })),
        ...(points || []).map(p => ({
          id: p.id,
          type: 'points',
          username: p.user?.username || `FID ${p.user_id}`,
          details: `Earned ${p.points} PokePoints via ${p.action_type}`,
          created_at: p.created_at
        }))
      ];

      allLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return NextResponse.json({ logs: allLogs.slice(0, limit) });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('Admin API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
