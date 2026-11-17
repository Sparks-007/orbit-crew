import { Orbit } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground",
        className
      )}
    >
      <Orbit className="size-4" aria-hidden />
    </span>
  );
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <BrandIcon />
      <span className="text-sm font-semibold tracking-tight">Orbit Crew</span>
    </span>
  );
}
