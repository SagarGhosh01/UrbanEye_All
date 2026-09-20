import { motion } from "framer-motion";
import { Camera, Eye, MapPin, ShieldAlert, Layers, Wrench } from "lucide-react";

const steps = [
  {
    n: "01",
    phase: "Capture",
    title: "Continuous Road Monitoring",
    body: "Public-transport cameras capture road conditions as vehicles travel across the city.",
    icon: Camera,
  },
  {
    n: "02",
    phase: "Detect",
    title: "AI-Powered Detection",
    body: "Computer vision identifies potholes, surface damage, waterlogging, damaged infrastructure, and road-safety hazards.",
    icon: Eye,
  },
  {
    n: "03",
    phase: "Locate",
    title: "Automatic Geotagging",
    body: "Every detected issue is tagged with GPS location, route, timestamp, and visual evidence.",
    icon: MapPin,
  },
  {
    n: "04",
    phase: "Verify & Prioritize",
    title: "Severity & Confidence Analysis",
    body: "AI assigns confidence and severity scores to prioritize incidents requiring immediate attention.",
    icon: ShieldAlert,
  },
  {
    n: "05",
    phase: "Map & Monitor",
    title: "Centralized Road Intelligence",
    body: "Verified incidents are mapped with location, images, severity, status, and district-level insights.",
    icon: Layers,
  },
  {
    n: "06",
    phase: "Estimate & Dispatch",
    title: "Repair Cost & Work Order",
    body: "SRIMS estimates repair requirements and costs using defect dimensions, severity, repair method, and applicable local rates, then generates a maintenance task.",
    icon: Wrench,
  },
];

interface HowItWorksProps {
  theme?: 'dark' | 'light';
}

export default function HowItWorks({ theme = 'dark' }: HowItWorksProps) {
  const isDark = theme === 'dark';

  return (
    <section
      id="how-it-works"
      className={`border-b px-4 sm:px-6 py-14 sm:py-20 md:py-28 md:px-12 transition-colors duration-300 relative ${
        isDark ? 'bg-[#081325] border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
      }`}
    >
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12 sm:mb-16"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-[#2dd4bf] mb-2 block">
            ● Automated Pipeline
          </span>
          <h2
            className={`font-display max-w-2xl text-3xl font-bold leading-tight md:text-4xl ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            One route, six handoffs, zero manual reporting.
          </h2>
        </motion.div>

        <div className="flex flex-col space-y-4">
          {steps.map((step) => {
            const IconComponent = step.icon;
            return (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ x: 6, transition: { duration: 0.2 } }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className={`group grid grid-cols-1 gap-4 rounded-2xl p-5 sm:p-6 border transition-all duration-300 md:grid-cols-[220px_1fr_1.4fr] md:gap-8 items-center ${
                  isDark
                    ? 'bg-slate-900/40 border-slate-800/80 hover:border-[#1E7F73]/50 hover:bg-slate-900/70 hover:shadow-xl hover:shadow-[#1E7F73]/10 backdrop-blur-md'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-lg backdrop-blur-md'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`p-2.5 rounded-xl border shrink-0 transition-colors ${
                      isDark
                        ? 'bg-[#1E7F73]/15 border-[#1E7F73]/30 text-[#2dd4bf] group-hover:bg-[#1E7F73]/30'
                        : 'bg-[#0f766e]/10 border-[#0f766e]/20 text-[#0f766e] group-hover:bg-[#0f766e]/20'
                    }`}
                  >
                    <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span
                    className={`font-display text-xs sm:text-sm font-bold tracking-tight px-2.5 py-1 rounded-md ${
                      isDark
                        ? 'bg-[#1E7F73]/20 text-[#2dd4bf] border border-[#1E7F73]/30'
                        : 'bg-[#0f766e]/10 text-[#0f766e] border border-[#0f766e]/20'
                    }`}
                  >
                    {step.n} — {step.phase}
                  </span>
                </div>

                <h3
                  className={`font-display text-base sm:text-lg font-bold md:text-xl transition-colors ${
                    isDark ? 'text-white group-hover:text-[#2dd4bf]' : 'text-slate-900 group-hover:text-[#0f766e]'
                  }`}
                >
                  {step.title}
                </h3>

                <p
                  className={`max-w-prose text-xs sm:text-sm leading-relaxed ${
                    isDark ? 'text-slate-300' : 'text-slate-600'
                  }`}
                >
                  {step.body}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
