import { useAuth } from "@clerk/react-router";
import React from "react";
import { SendtallyApi } from "@sendtally/api-client";

export function useClientApi(apiUrl: string): SendtallyApi {
  const { getToken } = useAuth();
  return React.useMemo(() => new SendtallyApi(apiUrl, () => getToken()), [apiUrl, getToken]);
}
