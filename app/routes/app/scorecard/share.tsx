import { Code2, ExternalLink, Link2, MonitorSmartphone } from "lucide-react";
import { Link, useFetcher } from "react-router";
import { CopyButton } from "~/components/admin/copy-button";
import { PageContainer } from "~/components/app/nav";
import { Button } from "~/components/ui/button";
import { SectionLabel } from "~/components/ui/input";
import { Alert, Card, PageHeader } from "~/components/ui/misc";
import { scorecardTitle } from "~/lib/admin/meta";
import { markSetupStepDone } from "~/server/admin-setup.server";
import { appUrl } from "~/server/env.server";
import type { Route } from "./+types/share";
import { useScorecard } from "./layout";

export function meta({ matches }: Route.MetaArgs) {
  return scorecardTitle("Share & Embed", matches);
}

export async function loader() {
  return { appUrl: appUrl() };
}

/** Copying the link or an embed code ticks the "Share & Embed" setup step. */
export async function action({ request, params }: Route.ActionArgs) {
  const form = await request.formData();
  if (form.get("intent") === "markShared") await markSetupStepDone(params.id, "share");
  return { ok: true };
}

function Snippet({ code, label, onCopied }: { code: string; label: string; onCopied?: () => void }) {
  return (
    <div className="relative">
      <pre className="whitespace-pre-wrap break-all rounded-md bg-ink p-4 pr-32 text-[13px] leading-relaxed text-gray-100">
        <code>{code}</code>
      </pre>
      <CopyButton value={code} label={label} onCopied={onCopied} className="absolute right-2 top-2" />
    </div>
  );
}

export default function Share({ loaderData }: Route.ComponentProps) {
  const { scorecard, status, publicUrl, progress } = useScorecard();
  const base = `/scorecards/${scorecard.id}`;
  const app = loaderData.appUrl;
  const fetcher = useFetcher();
  const shareStepDone = progress.steps.find((s) => s.id === "share")?.done;
  const onCopied = () => {
    if (!shareStepDone) fetcher.submit({ intent: "markShared" }, { method: "post" });
  };
  const embed = `<div data-openscore="${scorecard.slug}"></div>\n<script src="${app}/embed.js" async></script>`;
  const iframe = `<iframe src="${app}/embed/${scorecard.slug}" title="${scorecard.name.replace(/"/g, "&quot;")}" width="100%" height="700" style="border:0;max-width:100%" loading="lazy" allow="clipboard-write"></iframe>`;

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader title="Share & Embed" description="Share your scorecard link or put it on your own website." />

      {status !== "live" && (
        <Alert tone="warning" className="mb-6 flex items-center justify-between gap-4">
          <span>
            <strong className="font-semibold">This scorecard is in draft mode.</strong> The link and embeds below show a
            "not available" page until you publish.
          </span>
          <Button asChild size="sm">
            <Link to={`${base}/home`}>Go to publish</Link>
          </Button>
        </Alert>
      )}

      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
              <Link2 className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-ink">Public link</h2>
              <p className="text-sm text-gray-600">Share it in emails, social posts, QR codes or your link-in-bio.</p>
              <div className="mt-4 flex items-center gap-2">
                <div className="flex h-9 min-w-0 flex-1 items-center rounded-md border border-gray-300 bg-gray-50 px-3 text-sm text-ink">
                  <span className="truncate">{publicUrl}</span>
                </div>
                <CopyButton value={publicUrl} label="Copy link" size="md" onCopied={onCopied} />
                <Button variant="secondary" size="icon" asChild>
                  <a href={publicUrl} target="_blank" rel="noreferrer" aria-label="Open public link">
                    <ExternalLink />
                  </a>
                </Button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Change the link in{" "}
                <Link to={`${base}/settings/general`} className="text-brand-700 hover:underline">
                  Settings › General
                </Link>
                . Control how it looks when shared in{" "}
                <Link to={`${base}/settings/share-appearance`} className="text-brand-700 hover:underline">
                  Share Appearance
                </Link>
                .
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
              <MonitorSmartphone className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-ink">Embed on your website</h2>
              <p className="text-sm text-gray-600">
                Paste this where you want the scorecard to appear. It resizes automatically to fit its content.
              </p>
              <SectionLabel className="mb-2 mt-4">Recommended: auto-resizing embed</SectionLabel>
              <Snippet code={embed} label="Copy code" onCopied={onCopied} />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-700">
              <Code2 className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-ink">Plain iframe</h2>
              <p className="text-sm text-gray-600">
                For site builders that don't allow scripts. Fixed height: adjust{" "}
                <code className="text-[13px]">height</code> to suit your page.
              </p>
              <div className="mt-4">
                <Snippet code={iframe} label="Copy code" onCopied={onCopied} />
              </div>
            </div>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
