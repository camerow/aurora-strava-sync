import { useAuth } from "@clerk/clerk-expo";
import { WEB_APP_URL } from "./config";

export const INSIGHTS_FEATURE = "long-term-insights";

export const MEMBERSHIP_URL = `${WEB_APP_URL}/app/membership`;

export function useHasFeature(feature: string): boolean {
  const { isLoaded, has } = useAuth();
  if (!isLoaded || has === undefined) return false;
  return has({ feature });
}
