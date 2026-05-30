declare module "expo-router" {
  export const Stack: any;
}

declare module "expo-status-bar" {
  export const StatusBar: any;
}

declare module "react-native-safe-area-context" {
  export const SafeAreaProvider: any;
}

declare module "expo-secure-store" {
  export function getItemAsync(key: string): Promise<string | null>;
  export function setItemAsync(key: string, value: string): Promise<void>;
  export function deleteItemAsync(key: string): Promise<void>;
}
