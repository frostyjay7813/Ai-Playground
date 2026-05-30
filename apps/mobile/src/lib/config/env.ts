const DEFAULT_API_BASE_URL = "http://localhost:4000";

export const getApiBaseUrl = () => {
  const maybeFromProcess =
    typeof process !== "undefined" && process.env
      ? process.env.EXPO_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL
      : undefined;

  return maybeFromProcess && maybeFromProcess.length > 0 ? maybeFromProcess : DEFAULT_API_BASE_URL;
};
