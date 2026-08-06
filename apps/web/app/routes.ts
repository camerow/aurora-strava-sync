import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("sign-in", "routes/sign-in.tsx"),
  route("sign-in/verify", "routes/sign-in.verify.tsx"),
  route("connected/strava", "routes/connected.strava.tsx"),
  route("app", "routes/app.tsx", [
    index("routes/app._index.tsx"),
    route("setup", "routes/app.setup.tsx"),
  ]),
] satisfies RouteConfig;
