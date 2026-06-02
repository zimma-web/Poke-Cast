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

