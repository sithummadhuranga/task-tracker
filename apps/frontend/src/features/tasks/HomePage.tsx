import { motion } from "framer-motion";

export function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="space-y-2 text-center"
      >
        <h1 className="text-3xl font-semibold">Task Tracker</h1>
        <p className="text-slate-400">The task board lands with the tasks feature commit.</p>
      </motion.div>
    </div>
  );
}
