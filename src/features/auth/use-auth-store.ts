import { create } from "zustand";
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

export const useAuthStore = create<AuthState>((set, get) => ({
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

    if (!googleClientId) {
      set({
        initialized: true,
        status: "error",
        error: "Missing VITE_GOOGLE_CLIENT_ID",
      });
      return;
    }

    try {
      await googleAuthService.initialize(googleClientId);
      set({ initialized: true, status: "idle", error: null });
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

    try {
      const result = await googleAuthService.requestAccessToken(googleClientId, "consent");
      set({
        status: "authenticated",
        accessToken: result.accessToken,
        expiresAt: result.expiresAt,
        profile: result.profile,
        error: null,
      });
    } catch (error) {
      set({
        status: "error",
        error: error instanceof Error ? error.message : "Google login failed",
      });
    }
  },

  ensureValidToken: async () => {
    const state = get();

    if (!state.accessToken || !state.expiresAt) {
      return null;
    }

    if (!googleAuthService.isExpired(state.expiresAt)) {
      return state.accessToken;
    }

    if (!googleClientId) {
      set({ status: "error", error: "Missing VITE_GOOGLE_CLIENT_ID" });
      return null;
    }

    try {
      const refreshed = await googleAuthService.requestAccessToken(googleClientId, "");
      set({
        status: "authenticated",
        accessToken: refreshed.accessToken,
        expiresAt: refreshed.expiresAt,
        profile: refreshed.profile,
        error: null,
      });
      return refreshed.accessToken;
    } catch {
      set({
        status: "idle",
        accessToken: null,
        expiresAt: null,
        profile: null,
        error: "Session expired. Please sign in again.",
      });
      return null;
    }
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
}));
