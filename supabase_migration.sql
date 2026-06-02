-- SQL Database Migration: Pack Economy System
-- Run these statements in your Supabase SQL Editor.

ALTER TABLE users ADD COLUMN IF NOT EXISTS pack_tickets INTEGER DEFAULT 10 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS free_packs_remaining INTEGER DEFAULT 2 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_daily_reset TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL;
