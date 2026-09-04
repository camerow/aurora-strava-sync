import { getAuth } from "@clerk/react-router/ssr.server";
import { redirect } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

type Args = LoaderFunctionArgs | ActionFunctionArgs;

export async function hasFeature(args: Args, feature: string): Promise<boolean> {
  const auth = await getAuth(args);
  if (!auth.isAuthenticated || auth.tokenType !== "session_token") return false;
  return auth.has({ feature });
}

export async function requireFeature(args: Args, feature: string): Promise<void> {
  if (!(await hasFeature(args, feature))) throw redirect("/app/membership");
}
