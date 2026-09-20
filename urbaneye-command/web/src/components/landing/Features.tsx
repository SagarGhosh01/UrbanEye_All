import { motion } from "framer-motion";
import { Sparkles, Activity, Video, GitBranch, Calculator, CheckCircle2 } from "lucide-react";

const features = [
  {
    title: "Road Defect Detection",
    body: "AI-powered computer vision identifies potholes, cracks, damaged road surfaces, missing dividers, faded crossings, and damaged signage, classifying each issue by type and severity.",
    icon: Sparkles,
  },
  {
    title: "Traffic Density Intelligence",
    body: "Fleet movement data is used to estimate traffic density and congestion, generating a live heatmap without requiring dedicated roadside sensors.",
    icon: Activity,
  },
  {
    title: "Automatic Incident Capture",
    body: "When an accident or collision is detected, SRIMS automatically captures relevant visual evidence and incident metadata for review and reporting.",
    icon: Video,
  },
  {
    title: "Intelligent Authority Routing",
    body: "Each verified detection is automatically routed through the state → district → ward/road authority hierarchy, ensuring the issue reaches the team responsible for that location.",
    icon: GitBranch,
  },
  {
    title: "Maintenance & Cost Intelligence",
    body: "Detected defects are converted into actionable maintenance records with recommended repair methods, estimated repair costs, priority levels, and work-order status.",
    icon: Calculator,
  },
  {
    title: "End-to-End Resolution Tracking",
    body: "Track every issue from Detection → Verification → Assignment → Repair → AI Verification → Closure, creating a transparent record of road maintenance.",
    icon: CheckCircle2,
  },
];

interface FeaturesProps {
  theme?: 'dark' | 'light';
}

export default function Features({ theme = 'dark' }: FeaturesProps) {
  const isDark = theme === 'dark';

  return (
    <section
      id="features"
      className={`border-b px-4 sm:px-6 py-14 sm:py-20 md:py-28 md:px-12 transition-colors duration-300 relative overflow-hidden ${
        isDark ? 'bg-[#0b1b36] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}
    >
      {/* Ambient background glow */}
      <div className="absolute top-1/3 -left-40 w-96 h-96 bg-[#1E7F73]/10 blur-[120px] rounded-full pointer-events-none" aria-hidden="true" />

      <div className="mx-auto max-w-6xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12 sm:mb-16"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-[#2dd4bf] mb-2 block">
            ● Comprehensive Platform Capabilities
          </span>
          <h2
            className={`font-display max-w-2xl text-3xl font-bold leading-tight md:text-4xl ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            What the fleet sees, SRIMS understands.
          </h2>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => {
            const IconComponent = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                className={`group rounded-2xl p-6 border transition-all duration-300 flex flex-col justify-between ${
                  isDark
                    ? 'bg-slate-900/50 border-slate-800 hover:border-[#1E7F73]/60 hover:bg-slate-900/80 hover:shadow-xl hover:shadow-[#1E7F73]/15 backdrop-blur-md'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:shadow-xl backdrop-blur-md'
                }`}
              >
                <div>
                  <div
                    className={`mb-4 inline-flex p-3 rounded-xl border transition-colors ${
                      isDark
                        ? 'bg-[#1E7F73]/15 border-[#1E7F73]/30 text-[#2dd4bf] group-hover:bg-[#1E7F73]/30 group-hover:text-white'
                        : 'bg-[#0f766e]/10 border-[#0f766e]/20 text-[#0f766e] group-hover:bg-[#0f766e]/20'
                    }`}
                  >
                    <IconComponent className="w-5 h-5" />
                  </div>

                  <h3
                    className={`font-display text-lg font-bold mb-2 transition-colors ${
                      isDark ? 'text-white group-hover:text-[#2dd4bf]' : 'text-slate-900 group-hover:text-[#0f766e]'
                    }`}
                  >
                    {f.title}
                  </h3>

                  <p
                    className={`text-xs sm:text-sm leading-relaxed ${
                      isDark ? 'text-slate-300' : 'text-slate-600'
                    }`}
                  >
                    {f.body}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs font-semibold text-[#2dd4bf] opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Explore module</span>
                  <span>→</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
