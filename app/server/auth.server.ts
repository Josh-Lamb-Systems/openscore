import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { and, count, eq, gt, isNull } from "drizzle-orm";
import { createContext, redirect } from "react-router";
import { db, schema } from "./db.server";
import { sendEmail } from "./email.server";
import { appUrl, env } from "./env.server";

/**
 * Sign-up policy: accounts can only be created when (a) no users exist yet
 * (first-run setup creates the admin) or (b) there is a pending, unexpired
 * invitation for the email. Enforced in a database hook so it applies to every
 * sign-up path.
 */
async function signupRoleFor(email: string): Promise<{ role: string; inviteId?: string } | null> {
  const [{ n }] = await db.select({ n: count() }).from(schema.user);
  if (n === 0) return { role: "admin" };
  const [invite] = await db
    .select()
    .from(schema.invitations)
    .where(
      and(
        eq(schema.invitations.email, email.toLowerCase()),
        isNull(schema.invitations.acceptedAt),
        gt(schema.invitations.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return invite ? { role: invite.role, inviteId: invite.id } : null;
}

export const auth = betterAuth({
  baseURL: env().APP_URL,
  secret: env().AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "editor", input: false },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your OpenScore password",
        text: `Someone requested a password reset for your OpenScore account.\n\nReset it here: ${url}\n\nIf this wasn't you, ignore this email.`,
      });
    },
  },
  plugins: [
    magicLink({
      disableSignUp: true,
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({
          to: email,
          subject: "Your OpenScore sign-in link",
          text: `Sign in to OpenScore: ${url}\n\nThis link expires in 5 minutes.`,
        });
      },
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const allowed = await signupRoleFor(user.email);
          if (!allowed) return false;
          return { data: { ...user, email: user.email.toLowerCase(), role: allowed.role } };
        },
        after: async (user) => {
          await db
            .update(schema.invitations)
            .set({ acceptedAt: new Date() })
            .where(
              and(eq(schema.invitations.email, user.email.toLowerCase()), isNull(schema.invitations.acceptedAt)),
            );
        },
      },
    },
  },
});

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "editor";
};

export const userContext = createContext<SessionUser | null>(null);

export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;
  const u = session.user as typeof session.user & { role?: string };
  return { id: u.id, name: u.name, email: u.email, role: u.role === "admin" ? "admin" : "editor" };
}

export async function hasAnyUser(): Promise<boolean> {
  const [{ n }] = await db.select({ n: count() }).from(schema.user);
  return n > 0;
}

/** Throws a redirect to /login (or /setup on a fresh install) if not signed in. */
export async function requireUser(request: Request): Promise<SessionUser> {
  const user = await getSessionUser(request);
  if (user) return user;
  if (!(await hasAnyUser())) throw redirect("/setup");
  const url = new URL(request.url);
  throw redirect(`/login?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);
}

export function requireAdmin(user: SessionUser): void {
  if (user.role !== "admin") throw new Response("Only admins can do that.", { status: 403 });
}

export { appUrl };

/**
 * Route middleware: requires a signed-in user and exposes it via `userContext`.
 * Usage in a route module: `export const middleware = [authMiddleware];`
 * then `context.get(userContext)!` in loaders/actions.
 */
export async function authMiddleware({ request, context }: { request: Request; context: { set: (ctx: typeof userContext, v: SessionUser) => void } }) {
  const user = await requireUser(request);
  context.set(userContext, user);
}
