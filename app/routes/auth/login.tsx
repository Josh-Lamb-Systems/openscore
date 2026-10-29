import { data, Form, Link, redirect, useNavigation, useSearchParams } from "react-router";
import { AuthShell } from "~/components/auth/auth-shell";
import { Button } from "~/components/ui/button";
import { Field, Input } from "~/components/ui/input";
import { Alert } from "~/components/ui/misc";
import {
  authErrorMessage,
  redirectWithAuthCookies,
  safeRedirect,
  signInWithPassword,
} from "~/server/auth-actions.server";
import { auth, getSessionUser, hasAnyUser } from "~/server/auth.server";
import type { Route } from "./+types/login";

export function meta() {
  return [{ title: "Sign in · OpenScore" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  if (await getSessionUser(request)) throw redirect("/scorecards");
  if (!(await hasAnyUser())) throw redirect("/setup");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = form.get("intent");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const redirectTo = safeRedirect(form.get("redirectTo"));

  if (!email) return data({ error: "Enter your email address.", sent: null }, { status: 400 });

  if (intent === "magic-link") {
    await auth.api.signInMagicLink({ body: { email, callbackURL: redirectTo }, headers: request.headers }).catch(() => {});
    // Same message whether or not the account exists.
    return { error: null, sent: "magic-link" as const };
  }

  if (intent === "reset") {
    await auth.api
      .requestPasswordReset({ body: { email, redirectTo: "/reset-password" }, headers: request.headers })
      .catch(() => {});
    return { error: null, sent: "reset" as const };
  }

  const password = String(form.get("password") ?? "");
  const res = await signInWithPassword(request, email, password);
  if (!res.ok) {
    return data({ error: await authErrorMessage(res, "Invalid email or password."), sent: null }, { status: 400 });
  }
  return redirectWithAuthCookies(res, redirectTo);
}

export default function Login({ actionData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const redirectTo = params.get("redirectTo") ?? "/scorecards";

  return (
    <AuthShell title="Sign in" subtitle="Welcome back to OpenScore.">
      {actionData?.error && <Alert className="mb-4">{actionData.error}</Alert>}
      {actionData?.sent === "magic-link" && (
        <Alert tone="success" className="mb-4">If that account exists, we've emailed you a sign-in link.</Alert>
      )}
      {actionData?.sent === "reset" && (
        <Alert tone="success" className="mb-4">If that account exists, we've emailed you a password reset link.</Alert>
      )}
      <Form method="post" className="space-y-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" />
        </Field>
        <Button type="submit" name="intent" value="password" className="w-full" disabled={busy}>
          Sign in
        </Button>
        <div className="flex items-center justify-between text-sm">
          <button type="submit" name="intent" value="magic-link" formNoValidate className="text-brand-700 hover:underline">
            Email me a sign-in link
          </button>
          <button type="submit" name="intent" value="reset" formNoValidate className="text-gray-600 hover:underline">
            Forgot password?
          </button>
        </div>
      </Form>
      <p className="mt-6 text-center text-xs text-gray-500">
        New here? Ask an admin for an invite. <Link to="/" className="sr-only">Home</Link>
      </p>
    </AuthShell>
  );
}
