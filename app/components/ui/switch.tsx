import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "~/lib/utils";

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-brand-600 bg-white transition-colors data-[state=checked]:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-3 translate-x-0.5 rounded-full bg-brand-600 transition-transform data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-white" />
    </SwitchPrimitive.Root>
  );
}

/** Label on the left, switch on the right, as in the builder inspector. */
export function SwitchRow({
  label,
  checked,
  onCheckedChange,
  name,
  disabled,
}: {
  label: React.ReactNode;
  checked: boolean;
  onCheckedChange?: (v: boolean) => void;
  name?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1.5 text-sm text-gray-800">
      <span>{label}</span>
      <Switch name={name} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} value="on" />
    </label>
  );
}
