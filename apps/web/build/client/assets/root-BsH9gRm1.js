import { w as e, j as s, M as a, L as n, S as o, a as i, O as r } from "./jsx-runtime-Cf_Cl9cf.js";
const l = "/assets/styles-DvSOt3TV.css",
  x = () => [{ rel: "stylesheet", href: l }];
function d({ children: t }) {
  return s.jsxs("html", {
    lang: "en",
    children: [
      s.jsxs("head", {
        children: [
          s.jsx("meta", { charSet: "utf-8" }),
          s.jsx("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }),
          s.jsx(a, {}),
          s.jsx(n, {}),
        ],
      }),
      s.jsxs("body", {
        style: {
          margin: 0,
          background: "var(--surface-page)",
          fontFamily: "var(--font-sans)",
          WebkitFontSmoothing: "antialiased",
        },
        children: [t, s.jsx(o, {}), s.jsx(i, {})],
      }),
    ],
  });
}
const h = e(function () {
  return s.jsx(r, {});
});
export { d as Layout, h as default, x as links };
