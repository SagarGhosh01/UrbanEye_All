import { motion } from "framer-motion";

interface FooterProps {
  onLoginClick?: () => void;
}

export default function Footer({ onLoginClick }: FooterProps) {
  return (
    <footer className="px-4 sm:px-6 py-14 sm:py-20 md:px-12 bg-[#050d1a] text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="font-display max-w-2xl text-2xl sm:text-3xl md:text-4xl font-bold leading-tight text-white"
          >
            The fleet is already on the road.
            <br />
            Let it start reporting.
          </motion.h2>

          {onLoginClick && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <button
                type="button"
                onClick={onLoginClick}
                className="rounded-full bg-[#1E7F73] hover:bg-[#166c62] px-7 py-3 text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-[#1E7F73]/30 flex items-center space-x-2 min-h-[44px] active:scale-95"
              >
                <span>Officer Portal Login</span>
                <span>→</span>
              </button>
            </motion.div>
          )}
        </div>

        <div className="mt-16 flex flex-col justify-between gap-4 border-t border-slate-800 pt-8 text-xs text-slate-400 sm:flex-row sm:items-center">
          <p className="flex items-center space-x-2">
            <span className="font-semibold text-slate-300">SRIMS</span>
            <span>— Built for Bharat Electronics Limited</span>
          </p>
          <p className="font-medium text-slate-400">
            Ministry of Road Transport & Highways (MoRTH)
          </p>
        </div>
      </div>
    </footer>
  );
}
