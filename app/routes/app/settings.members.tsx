import { Mail, Trash2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { CopyButton } from "~/components/admin/copy-button";
import { ResultError } from "~/components/admin/feedback";
import { DateTime } from "~/components/admin/date-time";
import { PageContainer } from "~/components/app/nav";
import { Button } from "~/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "~/components/ui/dialog";
import { Field, Input, Select } from "~/components/ui/input";
import { Alert, Card, PageHeader } from "~/components/ui/misc";
import type { ActionResult } from "~/lib/admin/action-result";
import { INVITE_TTL_DAYS } from "~/lib/admin/members";
import { cn } from "~/lib/utils";
import { fail, ok, str } from "~/server/admin-actions.server";
import {
  changeMemberRole,
  inviteMember,
  inviteUrl,
  isRole,
  listMembers,
  listPendingInvitations,
  removeMember,
  revokeInvitation,
} from "~/server/admin-org.server";
import { requireAdmin, userContext } from "~/server/auth.server";
import type { Route } from "./+types/settings.members";

export function meta() {
  return [{ title: "Members · OpenScore" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext)!;
  const isAdmin = user.role === "admin";
  const [members, invitations] = await Promise.all([listMembers(), isAdmin ? listPendingInvitations() : []]);
  return {
    currentUserId: user.id,
    isAdmin,
    members,
    invitations: invitations.map((i) => ({ ...i, url: inviteUrl(i.token), token: undefined })),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext)!;
  requireAdmin(user);
  const form = await request.formData();
  const intent = str(form, "intent");

  switch (intent) {
    case "invite": {
      const email = str(form, "email").trim().toLowerCase();
      const role = str(form, "role");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return fail(intent, "Check the highlighted fields.", { email: "Enter a valid email address." });
      }
      if (!isRole(role)) return fail(intent, "Choose a role.");
      const error = await inviteMember(email, role, user);
      if (error) return fail(intent, error, { email: error });
      return ok(intent, `Invitation sent to ${email}`);
    }
    case "role": {
      const role = str(form, "role");
      if (!isRole(role)) return fail(intent, "Choose a role.");
      const error = await changeMemberRole(str(form, "id"), role);
      return error ? fail(intent, error) : ok(intent, "Role updated");
    }
    case "remove": {
      const error = await removeMember(str(form, "id"), user.id);
      return error ? fail(intent, error) : ok(intent, "Member removed");
    }
    case "revoke":
      await revokeInvitation(str(form, "id"));
      return ok(intent, "Invitation revoked");
  }
  return fail(intent, "Unknown action.");
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function InviteDialog({
  open,
  onOpenChange,
  onSent,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSent: (message: string) => void;
}) {
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) {
      onOpenChange(false);
      onSent(fetcher.data.message ?? "Invitation sent");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.state, fetcher.data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Invite a teammate"
        description={`We'll email them a link to create their account. The link expires in ${INVITE_TTL_DAYS} days.`}
      >
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="invite" />
          <DialogBody className="space-y-4">
            <Field label="Email" htmlFor="invite-email" error={result?.fieldErrors?.email}>
              <Input id="invite-email" name="email" type="email" required autoFocus placeholder="name@company.com" />
            </Field>
            <Field
              label="Role"
              htmlFor="invite-role"
              hint="Editors can build and publish scorecards. Admins can also manage members and organisation settings."
            >
              <Select id="invite-role" name="role" defaultValue="editor">
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </Select>
            </Field>
            {result && !result.ok && !result.fieldErrors?.email && <Alert>{result.error}</Alert>}
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              <Mail /> {busy ? "Sending…" : "Send invitation"}
            </Button>
          </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}

type Member = Route.ComponentProps["loaderData"]["members"][number];

function MemberRow({ member, isSelf, isAdmin }: { member: Member; isSelf: boolean; isAdmin: boolean }) {
  const fetcher = useFetcher<ActionResult>();
  const role = (fetcher.formData?.get("intent") === "role" && (fetcher.formData.get("role") as string)) || member.role;
  const removing = fetcher.formData?.get("intent") === "remove";
  return (
    <tr className={cn(removing && "opacity-50")}>
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gray-200 text-sm font-medium text-gray-700">
            {initials(member.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">
              {member.name}
              {isSelf && <span className="ml-2 text-xs font-normal text-gray-500">(you)</span>}
            </p>
            <p className="truncate text-sm text-gray-600">{member.email}</p>
            <ResultError
              result={fetcher.state === "idle" ? fetcher.data : undefined}
              className="mt-1 px-2 py-1 text-xs"
            />
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        {isAdmin ? (
          <Select
            value={role}
            onChange={(e) =>
              fetcher.submit({ intent: "role", id: member.id, role: e.target.value }, { method: "post" })
            }
            className="h-8 w-32"
            aria-label={`Role for ${member.name}`}
          >
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
          </Select>
        ) : (
          <span className="capitalize text-gray-700">{role}</span>
        )}
      </td>
      <td className="px-3 py-3 text-sm text-gray-600">
        <DateTime value={member.createdAt} />
      </td>
      <td className="px-5 py-3 text-right">
        {isAdmin && !isSelf && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="hover:text-red-600"
            aria-label={`Remove ${member.name}`}
            disabled={removing}
            onClick={() => {
              if (
                confirm(
                  `Remove ${member.name} from the organisation? They'll be signed out and lose access immediately.`,
                )
              ) {
                fetcher.submit({ intent: "remove", id: member.id }, { method: "post" });
              }
            }}
          >
            <Trash2 />
          </Button>
        )}
      </td>
    </tr>
  );
}

type Invitation = Route.ComponentProps["loaderData"]["invitations"][number];

function InvitationRow({ invite }: { invite: Invitation }) {
  const fetcher = useFetcher<ActionResult>();
  return (
    <tr className={cn(fetcher.state !== "idle" && "opacity-50")}>
      <td className="px-5 py-3">
        <p className="font-medium text-ink">{invite.email}</p>
        <p className="text-xs text-gray-500">
          Invited {invite.invitedBy ? `by ${invite.invitedBy} ` : ""}· expires <DateTime value={invite.expiresAt} />
        </p>
      </td>
      <td className="px-3 py-3 capitalize text-gray-700">{invite.role}</td>
      <td className="px-5 py-3">
        <div className="flex justify-end gap-2">
          <CopyButton value={invite.url} label="Copy link" />
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:bg-red-50"
            onClick={() => {
              if (confirm(`Revoke the invitation for ${invite.email}?`)) {
                fetcher.submit({ intent: "revoke", id: invite.id }, { method: "post" });
              }
            }}
          >
            Revoke
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default function Members({ loaderData }: Route.ComponentProps) {
  const { members, invitations, isAdmin, currentUserId } = loaderData;
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <PageContainer>
      <PageHeader
        title="Members"
        description="Everyone who can sign in to this OpenScore workspace."
        actions={
          isAdmin && (
            <Button onClick={() => setOpen(true)}>
              <UserPlus /> Invite member
            </Button>
          )
        }
      />
      {!isAdmin && (
        <Alert tone="info" className="mb-6">
          Only admins can invite, remove or change the role of members.
        </Alert>
      )}
      {notice && (
        <Alert tone="success" className="mb-6">
          {notice}. They can also use the link under Pending invitations.
        </Alert>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-5 py-2.5 font-medium">Member</th>
              <th className="px-3 py-2.5 font-medium">Role</th>
              <th className="px-3 py-2.5 font-medium">Joined</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {members.map((m) => (
              <MemberRow key={m.id} member={m} isSelf={m.id === currentUserId} isAdmin={isAdmin} />
            ))}
          </tbody>
        </table>
      </Card>

      {isAdmin && (
        <>
          <h2 className="mb-3 mt-10 font-semibold text-ink">Pending invitations</h2>
          <Card className="overflow-hidden">
            {invitations.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-600">No pending invitations.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Email</th>
                    <th className="px-3 py-2.5 font-medium">Role</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invitations.map((i) => (
                    <InvitationRow key={i.id} invite={i} />
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <InviteDialog open={open} onOpenChange={setOpen} onSent={setNotice} />
        </>
      )}
    </PageContainer>
  );
}
