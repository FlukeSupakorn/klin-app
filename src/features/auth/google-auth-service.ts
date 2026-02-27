const GOOGLE_IDENTITY_SCRIPT_URL = "https://accounts.google.com/gsi/client";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

export interface GoogleProfile {
  id: string;
  name: string;
  email: string;
  picture?: string;
}

export interface GoogleAccessTokenResult {
  accessToken: string;
  expiresAt: number;
  profile: GoogleProfile;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  callback: (response: GoogleTokenResponse) => void;
  requestAccessToken: (options?: { prompt?: string }) => void;
}

interface PeopleApiProfileResponse {
  names?: Array<{ displayName?: string }>;
  emailAddresses?: Array<{ value?: string }>;
  photos?: Array<{ url?: string; default?: boolean }>;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GoogleTokenResponse) => void;
            error_callback?: (error: unknown) => void;
          }) => GoogleTokenClient;
          revoke: (token: string, callback?: () => void) => void;
        };
      };
    };
  }
}

class GoogleAuthService {
  private scriptPromise: Promise<void> | null = null;
  private tokenClient: GoogleTokenClient | null = null;
  private activeErrorHandler: ((error: unknown) => void) | null = null;

  private async loadScript(): Promise<void> {
    if (window.google?.accounts?.oauth2) {
      return;
    }

    if (this.scriptPromise) {
      return this.scriptPromise;
    }

    this.scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GOOGLE_IDENTITY_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
      document.head.appendChild(script);
    });

    return this.scriptPromise;
  }

  private ensureTokenClient(clientId: string): GoogleTokenClient {
    if (!window.google?.accounts?.oauth2) {
      throw new Error("Google Identity Services is not available");
    }

    if (!this.tokenClient) {
      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_CALENDAR_SCOPES.join(" "),
        callback: (response: GoogleTokenResponse) => {
          console.log("Google Auth Callback (default)", response);
        },
        error_callback: (err: unknown) => {
          console.error("Google Auth Error", err);
          this.activeErrorHandler?.(err);
        }
      });
    }

    return this.tokenClient;
  }

  async initialize(clientId: string): Promise<void> {
    if (!clientId) {
      throw new Error("Missing VITE_GOOGLE_CLIENT_ID");
    }

    await this.loadScript();
    this.ensureTokenClient(clientId);
  }

  async requestAccessToken(clientId: string, prompt: "consent" | "" = "consent"): Promise<GoogleAccessTokenResult> {
    await this.initialize(clientId);
    const tokenClient = this.ensureTokenClient(clientId);

    const tokenResponse = await new Promise<GoogleTokenResponse>((resolve, reject) => {
      let settled = false;

      const settleReject = (error: unknown) => {
        if (settled) {
          return;
        }

        settled = true;
        this.activeErrorHandler = null;
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      const settleResolve = (response: GoogleTokenResponse) => {
        if (settled) {
          return;
        }

        settled = true;
        this.activeErrorHandler = null;
        resolve(response);
      };

      const timeout = setTimeout(() => {
        settleReject(new Error("Google login timed out. Please check if a popup was blocked by your browser/system."));
      }, 60000);

      this.activeErrorHandler = (err: unknown) => {
        clearTimeout(timeout);
        settleReject(err ?? new Error("Google sign-in failed"));
      };

      tokenClient.callback = (response) => {
        clearTimeout(timeout);
        console.log("Google Auth Response received", response);
        
        if (response.error) {
          settleReject(new Error(response.error_description ?? response.error ?? "Google sign-in failed"));
          return;
        }
        
        if (!response.access_token) {
          settleReject(new Error("No access token received from Google"));
          return;
        }
        
        settleResolve(response);
      };

      try {
        console.log("Opening Google Auth popup...");
        tokenClient.requestAccessToken({ prompt });
      } catch (error) {
        clearTimeout(timeout);
        console.error("Failed to trigger Google Auth popup", error);
        settleReject(error instanceof Error ? error : new Error("Failed to request access token"));
      }
    });

    const profile = await this.fetchProfile(tokenResponse.access_token);

    return {
      accessToken: tokenResponse.access_token,
      expiresAt: Date.now() + tokenResponse.expires_in * 1000,
      profile,
    };
  }

  async fetchProfile(accessToken: string): Promise<GoogleProfile> {
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userInfoResponse.ok) {
      throw new Error("Failed to fetch Google profile");
    }

    const userInfo = (await userInfoResponse.json()) as {
      sub: string;
      name: string;
      email?: string;
      picture?: string;
    };

    let peoplePhoto: string | undefined;
    let peopleName: string | undefined;
    let peopleEmail: string | undefined;

    try {
      const peopleResponse = await fetch(
        "https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses,photos",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (peopleResponse.ok) {
        const peopleData = (await peopleResponse.json()) as PeopleApiProfileResponse;
        peoplePhoto = peopleData.photos?.[0]?.url;
        peopleName = peopleData.names?.[0]?.displayName;
        peopleEmail = peopleData.emailAddresses?.[0]?.value;
      }
    } catch {
      peoplePhoto = undefined;
    }

    return {
      id: userInfo.sub,
      name: peopleName ?? userInfo.name,
      email: peopleEmail ?? userInfo.email ?? "",
      picture: peoplePhoto ?? userInfo.picture,
    };
  }

  revoke(accessToken: string): Promise<void> {
    return new Promise((resolve) => {
      if (!window.google?.accounts?.oauth2 || !accessToken) {
        resolve();
        return;
      }

      window.google.accounts.oauth2.revoke(accessToken, () => resolve());
    });
  }

  isExpired(expiresAt: number | null): boolean {
    if (!expiresAt) {
      return true;
    }

    return Date.now() >= expiresAt - 30_000;
  }

  getManualAuthUrl(clientId: string): string {
    const redirectUri = window.location.origin.endsWith("/")
      ? window.location.origin
      : `${window.location.origin}/`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "token",
      scope: GOOGLE_CALENDAR_SCOPES.join(" "),
      prompt: "consent",
      include_granted_scopes: "true",
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  parseTokenFromUrl(url?: string): { accessToken: string; expiresAt: number } | null {
    const targetUrl = url ?? window.location.hash;
    
    if (!targetUrl) return null;

    const hashIndex = targetUrl.indexOf("#");
    if (hashIndex === -1) return null;

    const hash = targetUrl.substring(hashIndex + 1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const expiresIn = params.get("expires_in");

    if (accessToken && expiresIn) {
      return {
        accessToken,
        expiresAt: Date.now() + parseInt(expiresIn) * 1000,
      };
    }

    return null;
  }
}

export const googleAuthService = new GoogleAuthService();
