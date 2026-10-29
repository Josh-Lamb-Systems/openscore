import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  index("routes/index.tsx"),

  // Auth
  route("login", "routes/auth/login.tsx"),
  route("setup", "routes/auth/setup.tsx"),
  route("invite/:token", "routes/auth/invite.tsx"),
  route("logout", "routes/auth/logout.tsx"),
  route("reset-password", "routes/auth/reset-password.tsx"),
  route("api/auth/*", "routes/api.auth.ts"),

  // Public, respondent-facing (frameable)
  route("s/:slug", "routes/public/scorecard.tsx"),
  route("embed/:slug", "routes/public/scorecard.tsx", { id: "embed-scorecard" }),
  route("s/:slug/r/:token", "routes/public/result.tsx"),
  route("embed.js", "routes/public/embed-js.ts"),
  route("api/respond", "routes/public/api.respond.ts"),

  // Signed-in app with top bar
  layout("routes/app/layout.tsx", [
    layout("routes/app/global-layout.tsx", [
      route("scorecards", "routes/app/scorecards.tsx"),
      route("brand-kits", "routes/app/brand-kits.tsx"),
      route("brand-kits/:kitId", "routes/app/brand-kit.tsx"),
      route("settings/organisation", "routes/app/settings.organisation.tsx"),
      route("settings/members", "routes/app/settings.members.tsx"),
      route("account", "routes/app/account.tsx"),
    ]),
    route("scorecards/:id", "routes/app/scorecard/layout.tsx", [
      index("routes/app/scorecard/setup.tsx"),
      route("home", "routes/app/scorecard/home.tsx"),
      route("responses", "routes/app/scorecard/responses.tsx"),
      route("responses/:responseId", "routes/app/scorecard/response.tsx"),
      route("theme", "routes/app/scorecard/theme.tsx"),
      route("share", "routes/app/scorecard/share.tsx"),
      route("integrate", "routes/app/scorecard/integrate.tsx"),
      route("settings/general", "routes/app/scorecard/settings.general.tsx"),
      route("settings/lead-form", "routes/app/scorecard/settings.lead-form.tsx"),
      route("settings/tiers", "routes/app/scorecard/settings.tiers.tsx"),
      route("settings/share-appearance", "routes/app/scorecard/settings.share-appearance.tsx"),
    ]),
  ]),

  // Signed-in, full screen (no app chrome)
  route("scorecards/:id/build", "routes/builder/layout.tsx", [
    route("questions", "routes/builder/questions.tsx"),
    route("results", "routes/builder/results.tsx"),
  ]),
  route("scorecards/:id/preview", "routes/public/preview.tsx"),
  route("scorecards/:id/responses.csv", "routes/app/scorecard/responses-csv.ts"),
] satisfies RouteConfig;
