import { redirect } from "react-router";

export function loader(): Response {
  return redirect("/app/setup");
}
