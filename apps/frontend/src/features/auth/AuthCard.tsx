import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm space-y-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl shadow-black/20"
      >
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-slate-400">{subtitle}</p>
        </div>
        {children}
      </motion.div>
    </div>
  );
}
