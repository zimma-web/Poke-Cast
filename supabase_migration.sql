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


