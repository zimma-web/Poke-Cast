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
  addCards: (cards: Card[]) => void;
  setAuth: (auth: { 
    userId: string; 
    fid: number; 
    username: string; 
    avatar: string; 
    packTickets?: number; 
    freePacksRemaining?: number; 
    lastDailyReset?: string | null;
  }) => void;
  setCollection: (collection: { 
    ownedCards: Record<string, number>; 
    uniqueCards: number; 
    collectionScore: number; 
    packsOpened: number;
    packTickets?: number;
    freePacksRemaining?: number;
    lastDailyReset?: string | null;
  }) => void;
  updateEconomy: (economy: { packTickets: number; freePacksRemaining: number; lastDailyReset: string | null }) => void;
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
      setAuth: (auth) => set(() => ({
        userId: auth.userId,
        fid: auth.fid,
        username: auth.username,
        avatar: auth.avatar,
        packTickets: auth.packTickets ?? 10,
        freePacksRemaining: auth.freePacksRemaining ?? 2,
        lastDailyReset: auth.lastDailyReset ?? null
      })),
      setCollection: (col) => set(() => ({
        ownedCards: col.ownedCards,
        uniqueCards: col.uniqueCards,
        collectionScore: col.collectionScore,
        packsOpened: col.packsOpened,
        ...(col.packTickets !== undefined ? { packTickets: col.packTickets } : {}),
        ...(col.freePacksRemaining !== undefined ? { freePacksRemaining: col.freePacksRemaining } : {}),
        ...(col.lastDailyReset !== undefined ? { lastDailyReset: col.lastDailyReset } : {}),
      })),
      updateEconomy: (economy) => set(() => ({
        packTickets: economy.packTickets,
        freePacksRemaining: economy.freePacksRemaining,
        lastDailyReset: economy.lastDailyReset
      })),
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
      }),
    }
  )
);
