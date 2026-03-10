interface LockSettingsResponse {
  lock_file?: string[];
  lock_folder?: string[];
}

const SETTINGS_API_URL_CANDIDATES = [
  "http://127.0.0.1:8000/api/settings",
  "http://localhost:8000/api/settings",
];

function ensureSuccess(response: Response, label: string): Response {
  if (!response.ok) {
    throw new Error(`${label}: ${response.status}`);
  }

  return response;
}

async function fetchFromCandidates<T>(
  candidates: string[],
  request: (baseUrl: string) => Promise<T>,
): Promise<T> {
  let lastError: unknown = null;

  for (const baseUrl of candidates) {
    try {
      return await request(baseUrl);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Worker API unavailable");
}

export const privacySettingsService = {
  async getLocks(): Promise<{ lockFile: string[]; lockFolder: string[] }> {
    return fetchFromCandidates(SETTINGS_API_URL_CANDIDATES, async (baseUrl) => {
      const response = ensureSuccess(
        await fetch(`${baseUrl}/locks`),
        "Failed to load lock settings",
      );
      const payload = (await response.json()) as LockSettingsResponse;
      return {
        lockFile: Array.isArray(payload.lock_file) ? payload.lock_file.map((item) => String(item)).filter(Boolean) : [],
        lockFolder: Array.isArray(payload.lock_folder) ? payload.lock_folder.map((item) => String(item)).filter(Boolean) : [],
      };
    });
  },

  async saveLocks(input: { lockFile: string[]; lockFolder: string[] }): Promise<void> {
    await fetchFromCandidates(SETTINGS_API_URL_CANDIDATES, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/locks`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lock_file: input.lockFile,
          lock_folder: input.lockFolder,
        }),
      });

      ensureSuccess(response, "Failed to save lock settings");
      return true;
    });
  },
};
