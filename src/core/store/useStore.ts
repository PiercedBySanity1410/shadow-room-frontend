import { create } from "zustand";

export interface User {
  id: string;
  codename: string;
  incognitoId: string;
}

export interface ActiveChat {
  id: string;
  codename: string;
  incognitoId: string;
  time?: string;
  activeNow?: boolean;
  hasUnread?: boolean;
  unreadCount?: number;
  publicKey?: JsonWebKey;
  publicKeyDsa?: JsonWebKey;
  lastMessageText?: string;
  lastMessageTimestamp?: number;
  isRoom?: boolean;
  passphrase?: string;
}

export interface StoreState {
  user: User | null; // Current logged-in application user
  activeChats: ActiveChat[]; // The list of ongoing conversations
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setIsLoading: (loading: boolean) => void;
  setActiveChats: (chats: ActiveChat[]) => void;
  addActiveChat: (chat: ActiveChat) => void;
  updateChatStatus: (id: string, activeNow: boolean) => void;
  markAsRead: (id: string) => void;
  incrementUnread: (id: string) => void;
  updateLastMessage: (id: string, lastMessageText: string, time: string, timestamp?: number) => void;
}

export const useStore = create<StoreState>((set) => ({
  user: null,
  isLoading: true,
  activeChats: [],

  setUser: (user) => set({ user }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setActiveChats: (activeChats) => set({ activeChats }),

  // Helper action to safely add a new user to the conversation sidebar if they aren't already there
  addActiveChat: (newChat) =>
    set((state) => {
      const exists = state.activeChats.some(
        (chat) => chat.id === newChat.id,
      );
      if (exists) {
        return {
          activeChats: state.activeChats.map((c) =>
            c.id === newChat.id ? {
              ...c,
              ...newChat,
              time: newChat.time || c.time,
              lastMessageText: newChat.lastMessageText || c.lastMessageText,
            } : c
          )
        };
      }
      return { activeChats: [newChat, ...state.activeChats] };
    }),

  updateChatStatus: (id, activeNow) =>
    set((state) => ({
      activeChats: state.activeChats.map((chat) =>
        chat.id === id ? { ...chat, activeNow } : chat
      ),
    })),
  markAsRead: (id) =>
    set((state) => ({
      activeChats: state.activeChats.map((chat) =>
        chat.id === id ? { ...chat, hasUnread: false, unreadCount: 0 } : chat
      ),
    })),
  incrementUnread: (id) =>
    set((state) => ({
      activeChats: state.activeChats.map((chat) =>
        chat.id === id
          ? { ...chat, hasUnread: true, unreadCount: (chat.unreadCount || 0) + 1 }
          : chat
      ),
    })),
  updateLastMessage: (id, lastMessageText, time, timestamp?: number) =>
    set((state) => {
      const targetIndex = state.activeChats.findIndex((chat) => chat.id === id);
      if (targetIndex === -1) return state;
      const targetChat = {
        ...state.activeChats[targetIndex],
        lastMessageText,
        time,
        lastMessageTimestamp: timestamp ?? Date.now(),
      };
      const remaining = state.activeChats.filter((chat) => chat.id !== id);
      return {
        activeChats: [targetChat, ...remaining],
      };
    }),
}));
