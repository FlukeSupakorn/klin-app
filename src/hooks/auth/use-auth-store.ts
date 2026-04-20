import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  googleAuthService,
  type GoogleProfile,
} from "@/features/auth/google-auth-service";
import { tauriClient } from "@/services/tauri-client";
import { listen } from "@tauri-apps/api/event";

let deepLinkListenerReady = false;
let deepLinkListenerPromise: Promise<void> | null = null;
let initializeInFlight: Promise<void> | null = null;

async function ensureDeepLinkListener(handler: (url: string) => Promise<void>): Promise<void> {
  if (deepLinkListenerReady) {
    return;
  }

  if (!deepLinkListenerPromise) {
    deepLinkListenerPromise = (async () => {
      await listen<string>("deep-link://oauth-callback", (event) => {
        console.log("Deep link OAuth callback received:", event.payload);
        void handler(event.payload);
      });
      deepLinkListenerReady = true;
    })().catch((error) => {
      deepLinkListenerPromise = null;
      throw error;
    });
  }

  await deepLinkListenerPromise;
}

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
  handleDeepLinkCallback: (url: string) => Promise<void>;
}

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const googleClientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET as string | undefined;

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

    if (initializeInFlight) {
      await initializeInFlight;
      return;
    }

    initializeInFlight = (async () => {
      try {
        await ensureDeepLinkListener((url) => get().handleDeepLinkCallback(url));
      } catch (error) {
        console.error("Failed to set up deep link listener:", error);
      }

      const restoredToken = get().accessToken;
      const restoredExpiry = get().expiresAt;
      const restoredProfile = get().profile;

      if (restoredToken && restoredExpiry) {
        if (!googleAuthService.isExpired(restoredExpiry)) {
          try {
            const profile = await googleAuthService.fetchProfile(restoredToken);
            set({
              initialized: true,
              status: "authenticated",
              profile,
              error: null,
            });
          } catch {
            set({
              initialized: true,
              status: "authenticated",
              profile: restoredProfile,
              error: null,
            });
          }
          return;
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
        if (!("__TAURI_INTERNALS__" in window)) {
          await googleAuthService.initialize(googleClientId);
        }
        set({ initialized: true, error: null });
      } catch (error) {
        set({
          initialized: true,
          status: "error",
          error: error instanceof Error ? error.message : "Failed to initialize Google auth",
        });
      }
    })();

    try {
      await initializeInFlight;
    } finally {
      initializeInFlight = null;
    }
  },

  login: async () => {
    if (!googleClientId) {
      set({ status: "error", error: "Missing VITE_GOOGLE_CLIENT_ID" });
      return;
    }

    set({ status: "loading", error: null });

    const isDesktop = "__TAURI_INTERNALS__" in window;

    if (isDesktop) {
      try {
        const { codeVerifier, codeChallenge } = await googleAuthService.createPkcePair();
        const redirectUri = "http://127.0.0.1:17920/callback";

        await tauriClient.startOAuthListener();

        const unlisten = await listen<string>("oauth-callback-code", async (event) => {
          unlisten();
          const code = event.payload;

          if (!code) {
            set({ status: "error", error: "Google sign-in cancelled or failed" });
            return;
          }

          try {
            const tokenResult = await googleAuthService.exchangeCodeForToken({
              clientId: googleClientId!,
              code,
              codeVerifier,
              redirectUri,
              clientSecret: googleClientSecret,
            });
            const profile = await googleAuthService.fetchProfile(tokenResult.accessToken);
            set({
              status: "authenticated",
              accessToken: tokenResult.accessToken,
              expiresAt: tokenResult.expiresAt,
              profile,
              error: null,
            });
          } catch (err) {
            set({
              status: "error",
              error: err instanceof Error ? err.message : "Failed to complete Google sign-in",
            });
          }
        });

        const authUrl = googleAuthService.buildDesktopAuthUrl({
          clientId: googleClientId,
          redirectUri,
          codeChallenge,
          prompt: "consent",
        });

        await tauriClient.openExternalUrl(authUrl);
      } catch (error) {
        set({
          status: "error",
          error: error instanceof Error ? error.message : "Google sign-in failed",
        });
      }
      return;
    }

    try {
      const token = await googleAuthService.requestAccessToken(googleClientId, "consent");
      set({
        status: "authenticated",
        accessToken: token.accessToken,
        expiresAt: token.expiresAt,
        profile: token.profile,
        error: null,
      });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google sign-in failed";
      const authUrl = googleAuthService.getManualAuthUrl(googleClientId);
      try {
        await tauriClient.openExternalUrl(authUrl);
        set({ status: "loading", error: null });
        return;
      } catch {
        window.location.href = authUrl;
        set({ status: "error", error: message });
      }
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

  handleDeepLinkCallback: async (url: string) => {
    console.log("Processing deep link callback...", url);

    const callbackData = googleAuthService.parseTokenFromUrl(url);
    if (!callbackData) {
      set({
        status: "error",
        error: "Invalid OAuth callback - no token found",
      });
      return;
    }

    set({ status: "loading", error: null });

    try {
      const profile = await googleAuthService.fetchProfile(callbackData.accessToken);
      set({
        status: "authenticated",
        accessToken: callbackData.accessToken,
        expiresAt: callbackData.expiresAt,
        profile,
        error: null,
      });
      console.log("Successfully authenticated via deep link!");
    } catch (error) {
      set({
        status: "error",
        error: error instanceof Error ? error.message : "Failed to fetch profile after OAuth callback",
      });
    }
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
