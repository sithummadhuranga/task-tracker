import { motion } from "framer-motion";
import { useAuth } from "../auth/AuthContext";

export function HomePage() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <span className="font-semibold">Task Tracker</span>
        <div className="flex items-center gap-4 text-sm text-slate-400">
          <span>{user?.name}</span>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-200 transition hover:border-slate-500"
          >
            Sign out
          </button>
        </div>
      </header>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-1 items-center justify-center"
      >
        <p className="text-slate-400">The task board lands with the tasks feature commit.</p>
      </motion.div>
    </div>
  );
}
