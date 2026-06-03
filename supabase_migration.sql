-- SQL Database Migration: Pack Economy System
-- Run these statements in your Supabase SQL Editor.

ALTER TABLE users ADD COLUMN IF NOT EXISTS pack_tickets INTEGER DEFAULT 10 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS free_packs_remaining INTEGER DEFAULT 2 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_daily_reset TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL;

-- SQL Database Migration: Duplicate Tracking & Trading Foundation

-- 1. Create user_wishlist table
CREATE TABLE IF NOT EXISTS user_wishlist (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  PRIMARY KEY (user_id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_user_wishlist_user ON user_wishlist(user_id);

-- 2. Create trade_offers table
CREATE TABLE IF NOT EXISTS trade_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Can be null for public/any trade offers
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, rejected, cancelled
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trade_offers_sender ON trade_offers(sender_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_receiver ON trade_offers(receiver_id);

-- 3. Create trade_offer_cards table
CREATE TABLE IF NOT EXISTS trade_offer_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES trade_offers(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  direction TEXT NOT NULL, -- 'send' (offered by sender) or 'receive' (requested from receiver)
  quantity INTEGER DEFAULT 1 NOT NULL,
  CONSTRAINT chk_direction CHECK (direction IN ('send', 'receive')),
  CONSTRAINT chk_quantity CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_trade_offer_cards_offer ON trade_offer_cards(offer_id);

-- SQL Database Migration: Achievement System

-- 1. Create achievements table
CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  reward_type TEXT NOT NULL, -- 'tickets' or 'badge'
  reward_value INTEGER DEFAULT 0 NOT NULL,
  badge_name TEXT,
  CONSTRAINT chk_reward_type CHECK (reward_type IN ('tickets', 'badge'))
);

-- 2. Create user_achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);

-- 3. Seed achievements definitions
INSERT INTO achievements (id, title, description, icon, reward_type, reward_value, badge_name) VALUES
('first_pack', 'First Pack', 'Rip open your very first booster pack!', '📦', 'tickets', 2, 'Newbie Trainer'),
('first_rare', 'First Rare Card', 'Pull a Rare or Holo Rare card from a pack!', '⭐', 'tickets', 5, 'Lucky Star'),
('first_ultra_rare', 'First Ultra Rare', 'Pull an Ultra Rare or higher rarity card!', '✨', 'tickets', 10, 'Ultra Collector'),
('collected_100', '100 Cards Collected', 'Amass 100 total card copies in your collection!', '💯', 'tickets', 10, 'Century Club'),
('collected_500', '500 Cards Collected', 'Amass 500 total card copies in your collection!', '🛡️', 'tickets', 25, 'Half-Milestone'),
('collected_1000', '1000 Cards Collected', 'Amass 1,000 total card copies in your collection!', '👑', 'tickets', 50, 'Grandmaster'),
('complete_set_1', 'Complete First Set', 'Collect 100% of all cards in any single expansion set!', '🏆', 'tickets', 100, 'Set Completer'),
('opened_50', 'Open 50 Packs', 'Open 50 total booster packs!', '🔥', 'tickets', 20, 'Booster Popper'),
('opened_100', 'Open 100 Packs', 'Open 100 total booster packs!', '🌪️', 'tickets', 50, 'Booster Junkie')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  reward_type = EXCLUDED.reward_type,
  reward_value = EXCLUDED.reward_value,
  badge_name = EXCLUDED.badge_name;


-- SQL Database Migration: Daily Login Streak System

-- 1. Add fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_streak INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS highest_streak INTEGER DEFAULT 0 NOT NULL;

-- 2. Create login_rewards table
CREATE TABLE IF NOT EXISTS login_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  streak_day INTEGER NOT NULL,
  reward_type TEXT NOT NULL,
  reward_amount INTEGER NOT NULL DEFAULT 0,
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_rewards_user ON login_rewards(user_id);

-- Note: same-day claim uniqueness is enforced in application logic
CREATE INDEX IF NOT EXISTS idx_login_rewards_user_date ON login_rewards(user_id, claimed_at DESC);


-- SQL Database Migration: Updated Admin Panel

-- 1. Add admin/ban fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT;

-- 2. Create pack_settings table (per set configuration)
CREATE TABLE IF NOT EXISTS pack_settings (
  set_id TEXT PRIMARY KEY,
  pack_enabled BOOLEAN DEFAULT TRUE NOT NULL,
  featured_pack BOOLEAN DEFAULT FALSE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 3. Create event_packs table
CREATE TABLE IF NOT EXISTS event_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  bonus_drop_rate NUMERIC(5,2) DEFAULT 1.0 NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT chk_bonus_rate CHECK (bonus_drop_rate > 0 AND bonus_drop_rate <= 10.0)
);

CREATE INDEX IF NOT EXISTS idx_event_packs_active ON event_packs(is_active, end_date);

-- 4. Create admin_logs table (persistent audit trail)
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON admin_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target ON admin_logs(target_user_id);


-- SQL Database Migration: Complete Trading System

-- 1. Extend trade_offers table
ALTER TABLE trade_offers ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE trade_offers ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE trade_offers DROP CONSTRAINT IF EXISTS chk_trade_status;
ALTER TABLE trade_offers ADD CONSTRAINT chk_trade_status
  CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled'));

-- 2. Extend trade_offer_cards with owner tracking
ALTER TABLE trade_offer_cards ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- 3. Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB,
  read BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read, created_at DESC);

-- 4. Create analytics_events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id, created_at DESC);


-- SQL Database Migration: Marketplace V1 (Replaced with USDC Auction House)

-- Add wallet_address to users table to store connected Farcaster wallet address
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_address TEXT;

-- Drop old barter marketplace tables
DROP TABLE IF EXISTS marketplace_reports CASCADE;
DROP TABLE IF EXISTS marketplace_offers CASCADE;
DROP TABLE IF EXISTS marketplace_listings CASCADE;

-- 1. Auctions
CREATE TABLE IF NOT EXISTS auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_card_id UUID NOT NULL REFERENCES user_cards(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  start_price NUMERIC(12, 2) NOT NULL DEFAULT 1.00,
  buyout_price NUMERIC(12, 2),
  highest_bid NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
  highest_bidder_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'pending_payment', 'completed', 'cancelled', 'expired'
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  tx_hash TEXT, -- transaction hash verifying buyout or winner's claim payment
  CONSTRAINT chk_auction_status CHECK (status IN ('active', 'pending_payment', 'completed', 'cancelled', 'expired')),
  CONSTRAINT chk_prices CHECK (buyout_price IS NULL OR buyout_price > start_price),
  CONSTRAINT chk_start_price CHECK (start_price >= 0.01)
);

CREATE INDEX IF NOT EXISTS idx_auctions_status_end ON auctions(status, end_at ASC);
CREATE INDEX IF NOT EXISTS idx_auctions_seller ON auctions(seller_id);
CREATE INDEX IF NOT EXISTS idx_auctions_user_card ON auctions(user_card_id);

-- 2. Auction Bids
CREATE TABLE IF NOT EXISTS auction_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT chk_bid_amount CHECK (amount >= 0.01)
);

CREATE INDEX IF NOT EXISTS idx_auction_bids_auction ON auction_bids(auction_id, amount DESC);
CREATE INDEX IF NOT EXISTS idx_auction_bids_bidder ON auction_bids(bidder_id);

-- 3. Auction Reports
CREATE TABLE IF NOT EXISTS auction_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  auction_id UUID REFERENCES auctions(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  resolved BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auction_reports_unresolved ON auction_reports(resolved, created_at DESC);

-- SQL Database Migration: Daily Quest System
CREATE TABLE IF NOT EXISTS user_quests (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest_id TEXT NOT NULL,
  progress INTEGER DEFAULT 0 NOT NULL,
  target INTEGER DEFAULT 1 NOT NULL,
  claimed BOOLEAN DEFAULT FALSE NOT NULL,
  day DATE NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (user_id, quest_id, day)
);

CREATE INDEX IF NOT EXISTS idx_user_quests_user_day ON user_quests(user_id, day);

-- SQL Database Migration: On-Chain Pack Opening Logs
CREATE TABLE IF NOT EXISTS pack_openings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  set_id TEXT NOT NULL,
  tx_hash TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pack_openings_hash ON pack_openings(tx_hash);

-- SQL Database Migration: Add listing_tx_hash column to auctions
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS listing_tx_hash TEXT UNIQUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- SQL Database Migration: PokePoints Off-Chain Loyalty System
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add PokePoints columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS pokepoints BIGINT DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lifetime_points BIGINT DEFAULT 0 NOT NULL;

-- 2. Create points history log table
CREATE TABLE IF NOT EXISTS user_points_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  -- action_type values: pack_open, card_pull, set_completion, achievement,
  --                     login_day1, login_day7, login_day30, trade, listing,
  --                     marketplace_buy, share
  points INTEGER NOT NULL,
  reference_id TEXT,    -- card id, achievement id, tx hash, auction id, etc.
  metadata JSONB,       -- e.g. { "rarity": "Hyper Rare", "setId": "sv8pt5" }
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_points_history_user    ON user_points_history(user_id);
CREATE INDEX IF NOT EXISTS idx_points_history_action  ON user_points_history(action_type);
CREATE INDEX IF NOT EXISTS idx_points_history_created ON user_points_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_points_history_ref     ON user_points_history(reference_id);

-- SQL Database Migration: Ticket Purchases
CREATE TABLE IF NOT EXISTS ticket_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tx_hash TEXT UNIQUE NOT NULL,
  amount INTEGER NOT NULL DEFAULT 10,
  cost_usd NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_purchases_user ON ticket_purchases(user_id);

-- SQL Database Migration: Referral Program
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referrer_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_referrals INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS successful_referrals INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_tickets_earned INTEGER DEFAULT 0 NOT NULL;

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_fid TEXT NOT NULL,
  referral_code TEXT NOT NULL,
  source_url TEXT,
  rewarded_first_pack BOOLEAN DEFAULT FALSE NOT NULL,
  rewarded_50_cards BOOLEAN DEFAULT FALSE NOT NULL,
  rewarded_100_cards BOOLEAN DEFAULT FALSE NOT NULL,
  rewarded_trade_complete BOOLEAN DEFAULT FALSE NOT NULL,
  last_reward_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (referee_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals(referee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);

CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  reward_amount INTEGER NOT NULL DEFAULT 0,
  reward_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referral ON referral_rewards(referral_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON referral_rewards(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referee ON referral_rewards(referee_id);
CREATE INDEX IF NOT EXISTS idx_ticket_purchases_hash ON ticket_purchases(tx_hash);


