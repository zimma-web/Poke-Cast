import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Card {
  id: string;
  setId: string;
  name: string;
  number: string;
  rarity: string | null;
  hp: number | null;
  types: string[];
  pokedexNumber: number | null;
  smallImage: string;
  largeImage: string;
  tcgplayerUrl: string | null;
}

interface CollectionState {
  userId: string | null;
  fid: number | null;
  username: string | null;
  avatar: string | null;
  loading: boolean;
  ownedCards: Record<string, number>; // cardId -> quantity
  packsOpened: number;
  collectionScore: number;
  uniqueCards: number;
  packTickets: number;
  freePacksRemaining: number;
  lastDailyReset: string | null;
  wishlist: Record<string, boolean>; // cardId -> boolean
  achievements: any[]; // achievements with unlocked status
  walletAddress: string | null;
  usdcBalance: number;
  loginStreak: number;
  highestStreak: number;
  claimedToday: boolean;
  pokepoints: number;
  lifetimePoints: number;
  addCards: (cards: Card[]) => void;
  setAuth: (auth: { 
    userId: string; 
    fid: number; 
    username: string; 
    avatar: string; 
    walletAddress?: string | null;
    usdcBalance?: number;
    packTickets?: number; 
    freePacksRemaining?: number; 
    lastDailyReset?: string | null;
    wishlist?: string[];
    loginStreak?: number;
    highestStreak?: number;
    claimedToday?: boolean;
    pokepoints?: number;
    lifetimePoints?: number;
  }) => void;
  setCollection: (collection: { 
    ownedCards: Record<string, number>; 
    uniqueCards: number; 
    collectionScore: number; 
    packsOpened: number;
    walletAddress?: string | null;
    usdcBalance?: number;
    packTickets?: number;
    freePacksRemaining?: number;
    lastDailyReset?: string | null;
    wishlist?: string[];
    loginStreak?: number;
    highestStreak?: number;
    claimedToday?: boolean;
    pokepoints?: number;
    lifetimePoints?: number;
  }) => void;
  updateEconomy: (economy: { packTickets: number; freePacksRemaining: number; lastDailyReset: string | null }) => void;
  updateStreak: (streak: { loginStreak: number; highestStreak: number; claimedToday: boolean }) => void;
  updatePokePoints: (points: { pokepoints: number; lifetimePoints: number }) => void;
  toggleWishlist: (cardId: string) => void;
  setWishlist: (wishlist: Record<string, boolean>) => void;
  setAchievements: (achievements: any[]) => void;
  setLoading: (loading: boolean) => void;
}

const RARITY_SCORES: Record<string, number> = {
  'Common': 1,
  'Uncommon': 2,
  'Rare': 5,
  'Rare Holo': 10,
  'Rare Ultra': 25,
  'Rare Secret': 50,
  'Illustration Rare': 75,
  'Special Illustration Rare': 100,
  'Double Rare': 20,
  'Hyper Rare': 100,
};

export const getCardScore = (rarity: string | null | undefined) => {
  if (!rarity) return 1;
  return RARITY_SCORES[rarity] || 5;
};

export const useCollectionStore = create<CollectionState>()(
  persist(
    (set) => ({
      userId: null,
      fid: null,
      username: null,
      avatar: null,
      loading: true,
      ownedCards: {},
      packsOpened: 0,
      collectionScore: 0,
      uniqueCards: 0,
      packTickets: 10,
      freePacksRemaining: 2,
      lastDailyReset: null,
      wishlist: {},
      achievements: [],
      walletAddress: null,
      usdcBalance: 0,
      loginStreak: 0,
      highestStreak: 0,
      claimedToday: false,
      pokepoints: 0,
      lifetimePoints: 0,
      setAuth: (auth) => set(() => {
        const wishlistRecord: Record<string, boolean> = {};
        if (auth.wishlist) {
          auth.wishlist.forEach(id => {
            wishlistRecord[id] = true;
          });
        }
        return {
          userId: auth.userId,
          fid: auth.fid,
          username: auth.username,
          avatar: auth.avatar,
          walletAddress: auth.walletAddress ?? null,
          usdcBalance: auth.usdcBalance ?? 0,
          packTickets: auth.packTickets ?? 10,
          freePacksRemaining: auth.freePacksRemaining ?? 2,
          lastDailyReset: auth.lastDailyReset ?? null,
          loginStreak: auth.loginStreak ?? 0,
          highestStreak: auth.highestStreak ?? 0,
          claimedToday: auth.claimedToday ?? false,
          pokepoints: auth.pokepoints ?? 0,
          lifetimePoints: auth.lifetimePoints ?? 0,
          ...(auth.wishlist !== undefined ? { wishlist: wishlistRecord } : {})
        };
      }),
      setCollection: (col) => set(() => {
        const wishlistRecord: Record<string, boolean> = {};
        if (col.wishlist) {
          col.wishlist.forEach(id => {
            wishlistRecord[id] = true;
          });
        }
        return {
          ownedCards: col.ownedCards,
          uniqueCards: col.uniqueCards,
          collectionScore: col.collectionScore,
          packsOpened: col.packsOpened,
          ...(col.walletAddress !== undefined ? { walletAddress: col.walletAddress } : {}),
          ...(col.usdcBalance !== undefined ? { usdcBalance: col.usdcBalance } : {}),
          ...(col.packTickets !== undefined ? { packTickets: col.packTickets } : {}),
          ...(col.freePacksRemaining !== undefined ? { freePacksRemaining: col.freePacksRemaining } : {}),
          ...(col.lastDailyReset !== undefined ? { lastDailyReset: col.lastDailyReset } : {}),
          ...(col.wishlist !== undefined ? { wishlist: wishlistRecord } : {}),
          ...(col.loginStreak !== undefined ? { loginStreak: col.loginStreak } : {}),
          ...(col.highestStreak !== undefined ? { highestStreak: col.highestStreak } : {}),
          ...(col.claimedToday !== undefined ? { claimedToday: col.claimedToday } : {}),
          ...(col.pokepoints !== undefined ? { pokepoints: col.pokepoints } : {}),
          ...(col.lifetimePoints !== undefined ? { lifetimePoints: col.lifetimePoints } : {}),
        };
      }),
      updateEconomy: (economy) => set(() => ({
        packTickets: economy.packTickets,
        freePacksRemaining: economy.freePacksRemaining,
        lastDailyReset: economy.lastDailyReset
      })),
      updateStreak: (streak) => set(() => ({
        loginStreak: streak.loginStreak,
        highestStreak: streak.highestStreak,
        claimedToday: streak.claimedToday
      })),
      updatePokePoints: (points) => set(() => ({
        pokepoints: points.pokepoints,
        lifetimePoints: points.lifetimePoints
      })),
      toggleWishlist: (cardId) => set((state) => {
        const nextWishlist = { ...state.wishlist };
        if (nextWishlist[cardId]) {
          delete nextWishlist[cardId];
        } else {
          nextWishlist[cardId] = true;
        }
        return { wishlist: nextWishlist };
      }),
      setWishlist: (wishlist) => set(() => ({ wishlist })),
      setAchievements: (achievements) => set(() => ({ achievements })),
      setLoading: (loading) => set(() => ({ loading })),
      addCards: (cards) => set((state) => {
        const newOwned = { ...state.ownedCards };
        let newScore = state.collectionScore;
        let newUnique = state.uniqueCards;
 
        cards.forEach(c => {
          if (!newOwned[c.id]) {
            newUnique += 1;
            newScore += getCardScore(c.rarity);
            newOwned[c.id] = 1;
          } else {
            newOwned[c.id] += 1;
          }
        });
        return {
          ownedCards: newOwned,
          packsOpened: state.packsOpened + 1,
          collectionScore: newScore,
          uniqueCards: newUnique
        };
      }),
    }),
    {
      name: 'tcg-collection-storage',
      partialize: (state) => ({
        ownedCards: state.ownedCards,
        packsOpened: state.packsOpened,
        collectionScore: state.collectionScore,
        uniqueCards: state.uniqueCards,
        packTickets: state.packTickets,
        freePacksRemaining: state.freePacksRemaining,
        lastDailyReset: state.lastDailyReset,
        wishlist: state.wishlist,
        achievements: state.achievements,
        loginStreak: state.loginStreak,
        highestStreak: state.highestStreak,
        claimedToday: state.claimedToday,
        walletAddress: state.walletAddress,
        usdcBalance: state.usdcBalance,
        pokepoints: state.pokepoints,
        lifetimePoints: state.lifetimePoints,
      }),
    }
  )
);
