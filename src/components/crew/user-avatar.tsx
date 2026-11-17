import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { initialsOf } from "./shared";

interface UserAvatarProps {
  name: string | null;
  email: string;
  className?: string;
}

export function UserAvatar({ name, email, className }: UserAvatarProps) {
  return (
    <Avatar className={cn("size-8", className)}>
      <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
        {initialsOf(name, email)}
      </AvatarFallback>
    </Avatar>
  );
}
