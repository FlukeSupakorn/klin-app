import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  googleAuthService,
  type GoogleProfile,
} from "@/features/auth/google-auth-service";

interface AuthState {
  initialized: boolean;
  status: "idle" | "loading" | "authenticated" | "error";
  accessToken: string | null;
  expiresAt: number | null;
  profile: GoogleProfile | null;
  error: string | null;
  initialize: () => Promise<void>;
  login: () => Promise<void>;
  ensureValidToken: () => Promise<string | null>;
  logout: () => Promise<void>;
}

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export const useAuthStore = create<AuthState>()(persist((set, get) => ({
  initialized: false,
  status: "idle",
  accessToken: null,
  expiresAt: null,
  profile: null,
  error: null,

  initialize: async () => {
    if (get().initialized) {
      return;
    }

    const restoredToken = get().accessToken;
    const restoredExpiry = get().expiresAt;

    if (restoredToken && restoredExpiry) {
      if (!googleAuthService.isExpired(restoredExpiry)) {
        set({
          initialized: true,
          status: "authenticated",
          error: null,
        });
      } else {
        set({
          accessToken: null,
          expiresAt: null,
          profile: null,
          status: "idle",
        });
      }
    }

    if (!googleClientId) {
      set({
        initialized: true,
        status: "error",
        error: "Missing VITE_GOOGLE_CLIENT_ID",
      });
      return;
    }

    const callbackData = googleAuthService.parseTokenFromUrl();
    if (callbackData) {
      set({ status: "loading", error: null });
      try {
        const profile = await googleAuthService.fetchProfile(callbackData.accessToken);
        set({
          initialized: true,
          status: "authenticated",
          accessToken: callbackData.accessToken,
          expiresAt: callbackData.expiresAt,
          profile,
          error: null,
        });
        window.history.replaceState(null, "", window.location.pathname);
        return;
      } catch (error) {
        set({
          initialized: true,
          status: "error",
          error: error instanceof Error ? error.message : "Failed to fetch profile",
        });
        return;
      }
    }

    try {
      await googleAuthService.initialize(googleClientId);
      set({ initialized: true, error: null });
    } catch (error) {
      set({
        initialized: true,
        status: "error",
        error: error instanceof Error ? error.message : "Failed to initialize Google auth",
      });
    }
  },

  login: async () => {
    if (!googleClientId) {
      set({ status: "error", error: "Missing VITE_GOOGLE_CLIENT_ID" });
      return;
    }

    set({ status: "loading", error: null });

    const authUrl = googleAuthService.getManualAuthUrl(googleClientId);
    window.location.href = authUrl;
  },

  ensureValidToken: async () => {
    const state = get();

    if (!state.accessToken || !state.expiresAt) {
      return null;
    }

    if (!googleAuthService.isExpired(state.expiresAt)) {
      return state.accessToken;
    }

    set({
      status: "idle",
      accessToken: null,
      expiresAt: null,
      profile: null,
      error: "Session expired. Please sign in again.",
    });
    return null;
  },

  logout: async () => {
    const token = get().accessToken;
    if (token) {
      await googleAuthService.revoke(token);
    }

    set({
      status: "idle",
      accessToken: null,
      expiresAt: null,
      profile: null,
      error: null,
    });
  },
}), {
  name: "google-auth-session",
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({
    accessToken: state.accessToken,
    expiresAt: state.expiresAt,
    profile: state.profile,
  }),
}));
