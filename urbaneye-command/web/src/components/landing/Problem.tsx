import { motion } from "framer-motion";
import { AlertTriangle, Clock, Radio } from "lucide-react";

const stats = [
  {
    value: "3,00,000+",
    title: "Road accidents reported annually in India",
    description: "Many incidents are associated with unsafe road conditions, infrastructure gaps, and delayed detection.",
    icon: AlertTriangle,
    accent: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  {
    value: "Weeks",
    title: "Potential reporting gap",
    description: "Road defects can remain unnoticed or unreported before reaching the responsible authority.",
    icon: Clock,
    accent: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  },
  {
    value: "0",
    title: "Additional roadside sensors required",
    description: "SRIMS leverages existing public-transport vehicles to collect road-condition data without deploying new sensor infrastructure.",
    icon: Radio,
    accent: "text-[#2dd4bf] bg-[#1E7F73]/20 border-[#1E7F73]/40",
  },
];

interface ProblemProps {
  theme?: 'dark' | 'light';
}

export default function Problem({ theme = 'dark' }: ProblemProps) {
  const isDark = theme === 'dark';

  return (
    <section
      className={`border-b px-4 sm:px-6 py-14 sm:py-20 md:py-28 md:px-12 transition-colors duration-300 relative overflow-hidden ${
        isDark ? 'bg-[#0b1b36] border-slate-800/80 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}
    >
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 -right-40 -translate-y-1/2 w-96 h-96 bg-[#1E7F73]/10 blur-[100px] rounded-full pointer-events-none" aria-hidden="true" />

      <div className="mx-auto max-w-6xl relative z-10">
        <div className="grid gap-12 md:grid-cols-[1fr_1.4fr] items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="text-xs font-bold uppercase tracking-wider text-[#2dd4bf] mb-2 block">
              ● Infrastructure Challenge
            </span>
            <h2
              className={`font-display text-3xl font-bold leading-tight md:text-4xl ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              Road conditions change every day.
              <br />
              <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Cities need to know where—and when.
              </span>
            </h2>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-3">
            {stats.map((s, i) => {
              const IconComponent = s.icon;
              return (
                <motion.div
                  key={s.value}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -5, transition: { duration: 0.2 } }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className={`relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 ${
                    isDark
                      ? 'bg-slate-900/60 border-slate-800 hover:border-[#1E7F73]/50 hover:shadow-xl hover:shadow-[#1E7F73]/10 backdrop-blur-md'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:shadow-lg backdrop-blur-md'
                  }`}
                >
                  {/* Top header row with icon */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400">
                      Metric 0{i + 1}
                    </span>
                    <div className={`p-2 rounded-xl border shrink-0 ${s.accent}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Big value on its own line */}
                  <div
                    className={`font-display text-2xl sm:text-3xl font-black tracking-tight mb-2 ${
                      isDark ? 'text-[#2dd4bf]' : 'text-[#0f766e]'
                    }`}
                  >
                    {s.value}
                  </div>
                  <div
                    className={`font-semibold text-xs sm:text-sm leading-snug ${
                      isDark ? 'text-slate-200' : 'text-slate-800'
                    }`}
                  >
                    {s.title}
                  </div>
                  <p
                    className={`mt-2 text-[11px] sm:text-xs leading-relaxed ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    {s.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
