import React from 'react';
import { GovtEmblem } from './GovtEmblem';
import { useLanguage } from '../contexts/LanguageContext';

export const SrimsHeaderBrand: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useLanguage();
  const hindiStyle = { fontFamily: "'Noto Sans Devanagari', sans-serif" };

  return (
    <div className={`flex items-center space-x-3 select-none ${className}`}>
      {/* Official Ashoka Lion Capital Emblem */}
      <GovtEmblem size={54} />

      {/* Vertical Divider */}
      <div className="h-12 w-[1.5px] bg-slate-300"></div>

      {/* Brand Title & Subtitles */}
      <div className="flex flex-col justify-center">
        
        {/* Top Tag: GOVT. OF INDIA with Tricolor Flag Bar */}
        <div className="flex items-center space-x-1.5 mb-0.5">
          <span className="text-[10px] font-black text-[#003366] uppercase tracking-widest leading-none">
            GOVT. OF INDIA
          </span>
          <div className="flex h-1.5 w-6 rounded-xs overflow-hidden border border-slate-300">
            <div className="w-1/3 bg-[#FF9933]"></div>
            <div className="w-1/3 bg-white"></div>
            <div className="w-1/3 bg-[#138808]"></div>
          </div>
        </div>

        {/* Main SRIMS Brand Title */}
        <div className="flex items-baseline space-x-2">
          <h1 className="text-2xl md:text-3xl font-black text-[#003366] tracking-tighter leading-none">
            SRIMS
          </h1>
          <span className="text-[10px] font-bold text-[#138808] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 uppercase tracking-wider leading-none">
            Surveillance Portal
          </span>
        </div>

        {/* English Subtitle */}
        <h2 className="text-[11px] font-bold text-slate-800 leading-snug mt-0.5">
          {t('gov.subtitle')}
        </h2>

        {/* Hindi Subtitle */}
        <p className="text-[10px] font-medium text-slate-500 leading-tight" style={hindiStyle}>
          {t('gov.ministry')}
        </p>
      </div>
    </div>
  );
};

export default SrimsHeaderBrand;
