import { getAuth } from "@clerk/react-router/ssr.server";
import { redirect } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { SendtallyApi } from "@sendtally/api-client";
import { cloudflareContext } from "./cloudflare-context";

type Args = LoaderFunctionArgs | ActionFunctionArgs;

export async function requireApi(args: Args): Promise<SendtallyApi> {
  const { env } = args.context.get(cloudflareContext);
  const auth = await getAuth(args);
  if (!auth.isAuthenticated || auth.tokenType !== "session_token") throw redirect("/sign-in");
  return new SendtallyApi(env.API_URL, () => auth.getToken());
}
