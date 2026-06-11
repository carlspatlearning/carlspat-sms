import * as React from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const styles = {
  info: "border-primary/30 bg-primary/5 text-foreground",
  success: "border-green-600/30 bg-green-600/10 text-foreground",
  warning: "border-amber-500/40 bg-amber-500/10 text-foreground",
  destructive: "border-destructive/40 bg-destructive/10 text-foreground",
} as const;

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: AlertTriangle,
} as const;

export function Alert({
  variant = "info",
  title,
  children,
  className,
}: {
  variant?: keyof typeof styles;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = icons[variant];
  return (
    <div className={cn("flex gap-3 rounded-lg border p-4 text-sm", styles[variant], className)} role="alert">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        {title && <p className="mb-0.5 font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
