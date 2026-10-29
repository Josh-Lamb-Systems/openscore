import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, type ButtonProps } from "~/components/ui/button";

/** Copies `value` to the clipboard and briefly shows "Copied". */
export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  variant = "secondary",
  size = "sm",
  iconOnly,
  className,
  onCopied,
}: {
  value: string;
  /** Called after a successful copy. */
  onCopied?: () => void;
  label?: string;
  copiedLabel?: string;
  iconOnly?: boolean;
} & Pick<ButtonProps, "variant" | "size" | "className">) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Fallback for insecure contexts (e.g. http on a LAN IP).
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    onCopied?.();
  };

  return (
    <Button
      variant={variant}
      size={iconOnly ? "icon-sm" : size}
      onClick={copy}
      className={className}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
    >
      {copied ? <Check className="text-brand-600" /> : <Copy />}
      {!iconOnly && <span aria-live="polite">{copied ? copiedLabel : label}</span>}
    </Button>
  );
}
