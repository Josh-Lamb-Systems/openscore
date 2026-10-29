import { DropdownMenu as M } from "radix-ui";
import { cn } from "~/lib/utils";

export const DropdownMenu = M.Root;
export const DropdownMenuTrigger = M.Trigger;

export function DropdownMenuContent({ className, align = "end", ...props }: React.ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={4}
        className={cn("z-50 min-w-44 rounded-md border border-gray-200 bg-white p-1 shadow-lg", className)}
        {...props}
      />
    </M.Portal>
  );
}

export function DropdownMenuItem({
  className,
  destructive,
  ...props
}: React.ComponentProps<typeof M.Item> & { destructive?: boolean }) {
  return (
    <M.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-gray-100 [&_svg]:size-4",
        destructive ? "text-red-600" : "text-gray-800",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator() {
  return <M.Separator className="my-1 h-px bg-gray-200" />;
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof M.Label>) {
  return <M.Label className={cn("px-2 py-1.5 text-xs font-medium text-gray-500", className)} {...props} />;
}
