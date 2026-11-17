import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export interface PlaceholderSectionProps {
  icon: LucideIcon;
  title: string;
  description: string;
  chip: string;
  buttonLabel: string;
}

/**
 * Empty-state panel for planned capabilities. Deliberately non-interactive:
 * the action button is disabled and labelled with the milestone that will
 * unlock it.
 */
export function PlaceholderSection({
  icon: Icon,
  title,
  description,
  chip,
  buttonLabel,
}: PlaceholderSectionProps) {
  return (
    <Card className="mx-auto max-w-xl">
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-6" aria-hidden />
        </span>
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        <Badge variant="outline" className="text-muted-foreground">
          {chip}
        </Badge>
        <Button variant="outline" disabled className="h-11 px-6">
          {buttonLabel}
        </Button>
        <p className="text-xs text-muted-foreground">
          Not functional yet — this capability ships in a later milestone.
        </p>
      </CardContent>
    </Card>
  );
}
