import { Tabs as T } from "radix-ui";
import { cn } from "~/lib/utils";

export const Tabs = T.Root;
export const TabsContent = T.Content;

export function TabsList({ className, ...props }: React.ComponentProps<typeof T.List>) {
  return <T.List className={cn("flex gap-6 border-b border-gray-200", className)} {...props} />;
}

/** Small-caps tab trigger, as in the builder inspector ("QUESTION  ANSWERS"). */
export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        "-mb-px border-b-2 border-transparent pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 data-[state=active]:border-ink data-[state=active]:text-ink",
        className,
      )}
      {...props}
    />
  );
}
