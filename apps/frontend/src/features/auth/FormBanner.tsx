import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

interface FormBannerProps {
  tone: "error" | "success";
  children: ReactNode;
}

export function FormBanner({ tone, children }: FormBannerProps) {
  const isError = tone === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm ${
        isError ? "border-danger/30 bg-danger/10 text-danger" : "border-success/30 bg-success/10 text-success"
      }`}
    >
      {isError ? (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <span>{children}</span>
    </div>
  );
}
