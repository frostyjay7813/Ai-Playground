const STORAGE_KEY = "ai_playground_mobile_session_token";

let memoryToken: string | null = null;

const tryLoadSecureStore = async () => {
  try {
    return await import("expo-secure-store");
  } catch {
    return null;
  }
};

export const getSessionToken = async (): Promise<string | null> => {
  const secureStore = await tryLoadSecureStore();
  if (secureStore) {
    return secureStore.getItemAsync(STORAGE_KEY);
  }
  return memoryToken;
};

export const setSessionToken = async (token: string): Promise<void> => {
  const secureStore = await tryLoadSecureStore();
  if (secureStore) {
    await secureStore.setItemAsync(STORAGE_KEY, token);
    return;
  }
  memoryToken = token;
};

export const clearSessionToken = async (): Promise<void> => {
  const secureStore = await tryLoadSecureStore();
  if (secureStore) {
    await secureStore.deleteItemAsync(STORAGE_KEY);
    return;
  }
  memoryToken = null;
};
