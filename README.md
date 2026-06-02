# 🎴 PokéCast

A premium **Farcaster Mini App** designed as a Pokémon collectible card game where players select expansion packs, rip them open to roll weighted rarities, track their collection stats, and sync progress securely using a Supabase PostgreSQL backend.

---

## ✨ Features

*   **🔒 Farcaster Native Authentication**:
    *   Automatically identifies user context (`FID`, `username`, `pfpUrl`).
    *   Lockout screen for regular browsers to enforce Farcaster-only access.
*   **🎁 Set-Restricted Booster Packs**:
    *   Select from **173 expansion sets** (Base Set, Crown Zenith, Scarlet & Violet, etc.).
    *   Pulls are strictly locked to cards belonging to the chosen set.
    *   Booster displays dynamically load corresponding expansion pack logos and set symbols.
*   **🎲 5-Card Pack Pull System**:
    *   Each booster contains **3 Commons**, **1 Uncommon**, and **1 Rare**.
    *   Rares use a custom weighted probability distribution based on rarity tiers (e.g., Secret, Hyper, Gold, Art Rare, Holo).
*   **📊 Synced Collection & Profile Stats**:
    *   Automatically migrates legacy local collection items to the database upon first launch.
    *   Track **Total Cards Owned**, **Unique Cards**, **Global Completion %**, and **Collection Score**.
    *   Profile screen displays Farcaster details, score ranks (Master, Ultra, Great, Beginner), and unlocked badges.
*   **⚡ Performance First**:
    *   Mobile-first layout with smooth fluid animations powered by Framer Motion.
    *   Infinite-scrolling card gallery with horizontal series and expansion selector chips.

---

## 🛠️ Tech Stack

*   **Framework**: [Next.js (App Router)](https://nextjs.org/)
*   **State Management**: [Zustand](https://github.com/pmndrs/zustand)
*   **Styling**: [TailwindCSS v4](https://tailwindcss.com/) & [Framer Motion](https://www.framer.com/motion/)
*   **SDK**: [@farcaster/frame-sdk v0.2.0](https://github.com/farcasterxyz/frames)
*   **Database**: [Supabase](https://supabase.com/) (PostgreSQL)

---

## 🚀 Getting Started

### 1. Environment Variables

Create a `.env.local` file in the root of the `miniapp` directory and configure the following credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

### 2. Database Schema

Execute the following DDL script in your Supabase SQL editor:

```sql
-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fid BIGINT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  avatar TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  packs_opened INTEGER DEFAULT 0 NOT NULL
);

-- Create user_cards table
CREATE TABLE IF NOT EXISTS user_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  obtained_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  source_set_id TEXT NOT NULL
);

-- Indexing for fast collection calculations
CREATE INDEX IF NOT EXISTS idx_user_cards_user_id ON user_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cards_user_card ON user_cards(user_id, card_id);
```

### 3. Installation & Dev Server

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will run locally at `http://localhost:3000`. Use the [Farcaster Frame Developer Tool](https://github.com/farcasterxyz/frame-toy) or test within a client shell to bypass the browser lockout screen.
