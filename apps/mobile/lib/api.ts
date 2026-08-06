import { useAuth } from "@clerk/clerk-expo";
import React from "react";
import { SendtallyApi } from "@sendtally/api-client";
import { API_URL } from "./config";

export function useApi(): SendtallyApi {
  const { getToken } = useAuth();
  return React.useMemo(() => new SendtallyApi(API_URL, () => getToken()), [getToken]);
}
