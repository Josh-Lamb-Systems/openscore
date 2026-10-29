import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "~/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  title,
  description,
  className,
  children,
  ...props
}: React.ComponentProps<typeof D.Content> & { title: React.ReactNode; description?: React.ReactNode }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-gray-900/40" />
      <D.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white shadow-xl focus:outline-none",
          className,
        )}
        {...props}
      >
        <div className="relative border-b border-gray-200 px-6 py-4 text-center">
          <D.Title className="text-base font-semibold text-gray-800">{title}</D.Title>
          <D.Close className="absolute right-4 top-4 rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Close">
            <X className="size-4" />
          </D.Close>
        </div>
        {description ? (
          <D.Description className="px-6 pt-4 text-center text-sm text-gray-700">{description}</D.Description>
        ) : (
          <D.Description className="sr-only">{title}</D.Description>
        )}
        {children}
      </D.Content>
    </D.Portal>
  );
}

export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 py-5", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex justify-end gap-3 rounded-b-lg border-t border-gray-200 bg-gray-50 px-6 py-4", className)}
      {...props}
    />
  );
}
