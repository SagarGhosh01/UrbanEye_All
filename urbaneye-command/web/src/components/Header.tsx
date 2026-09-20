import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { 
  Home, LayoutDashboard, Eye, FileText, Map, AlertTriangle, 
  BarChart2, Info, HelpCircle, LogOut, Video, Radio, Phone, Shield,
  AlertCircle, Globe, Type
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { GovtEmblem } from './GovtEmblem';
import { SrimsHeaderBrand } from './SrimsHeaderBrand';

export type ActiveTabType = 'HOME' | 'DEFECTS' | 'TRAFFIC' | 'INCIDENTS' | 'SAFETY' | 'PREDICTIVE' | 'REPORTS' | 'ANALYTICS' | 'WORK_ORDERS';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  onOpenPairing: () => void;
  onOpenLiveCamera?: () => void;
  onSwitchUser?: (email: string) => void;
  activeBusCount?: number;
  currentBreadcrumbs?: { label: string; onClick?: () => void }[];
  activeTab?: ActiveTabType;
  onTabChange?: (tab: ActiveTabType) => void;
  onNavigateHome?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onOpenPairing,
  onOpenLiveCamera,
  onSwitchUser,
  activeBusCount = 0,
  currentBreadcrumbs,
  activeTab = 'DEFECTS',
  onTabChange,
  onNavigateHome,
}) => {
  const { language, toggleLanguage, fontSize, setFontSize, t } = useLanguage();
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleString(language === 'HI' ? 'hi-IN' : 'en-IN', { 
        day: '2-digit', month: 'short', year: 'numeric', 
        hour: '2-digit', minute: '2-digit', second: '2-digit' 
      }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [language]);

  const hindiStyle = { fontFamily: "'Noto Sans Devanagari', sans-serif" };

  const NAV_ITEMS = [
    { id: 'HOME' as ActiveTabType, label: language === 'HI' ? 'मुख्य पृष्ठ' : 'Home', icon: Home, action: onNavigateHome },
    { id: 'DEFECTS' as ActiveTabType, label: t('nav.defects'), icon: LayoutDashboard },
    { id: 'INCIDENTS' as ActiveTabType, label: t('nav.map'), icon: Map },
    { id: 'TRAFFIC' as ActiveTabType, label: t('nav.traffic'), icon: Eye },
    { id: 'REPORTS' as ActiveTabType, label: language === 'HI' ? 'रिपोर्ट्स' : 'Reports', icon: FileText },
    { id: 'PREDICTIVE' as ActiveTabType, label: t('nav.predictive'), icon: Info },
    { id: 'WORK_ORDERS' as ActiveTabType, label: 'Work Orders', icon: AlertTriangle },
  ];

  return (
    <header className="w-full flex flex-col z-50 bg-white border-b border-gray-200 shadow-sm font-sans text-gray-900">
      
      {/* 1. Top Announcement & Utility Bar (With English/Hindi Switcher & Accessibility Controls) */}
      <div className="bg-[#002244] text-white py-1.5 px-4 flex flex-wrap justify-between items-center text-xs border-b border-amber-500/40 gap-2">
        
        {/* Left: Announcement Marquee */}
        <div className="flex items-center space-x-2 overflow-hidden flex-1 min-w-[280px]">
          <div className="bg-[#FF9933] text-black font-bold px-2 py-0.5 rounded text-[10px] tracking-wide flex items-center gap-1 shrink-0 uppercase">
            <AlertCircle className="w-3 h-3" /> {t('announcement.title')}
          </div>
          <div className="overflow-hidden whitespace-nowrap text-gray-200 text-xs flex-1">
            <div className="inline-block animate-marquee">
              🚨 {t('announcement.text')}
            </div>
          </div>
        </div>

        {/* Right: English / Hindi Language Switcher + Accessibility Font Controls */}
        <div className="flex items-center space-x-3 shrink-0 text-xs">
          
          {/* Accessibility Font Size Resizer (A- A A+) */}
          <div className="flex items-center bg-[#001730] px-2 py-0.5 rounded border border-blue-900/60 space-x-1 text-[11px]">
            <Type className="w-3 h-3 text-amber-400" />
            <button 
              onClick={() => setFontSize('normal')}
              className={`px-1 rounded font-bold ${fontSize === 'normal' ? 'bg-amber-400 text-black' : 'text-gray-300 hover:text-white'}`}
              title="Standard Font Size"
            >
              A
            </button>
            <button 
              onClick={() => setFontSize('large')}
              className={`px-1 rounded font-bold ${fontSize === 'large' ? 'bg-amber-400 text-black' : 'text-gray-300 hover:text-white'}`}
              title="Large Font Size"
            >
              A+
            </button>
          </div>

          {/* English / Hindi Translator Switch Button */}
          <button
            onClick={toggleLanguage}
            className="bg-amber-500 hover:bg-amber-400 text-black font-black px-3 py-1 rounded flex items-center space-x-1.5 text-xs transition shadow-sm border border-amber-300"
            title="Switch Language (English / हिन्दी)"
          >
            <Globe className="w-3.5 h-3.5 text-black" />
            <span className="font-sans font-bold">{language === 'EN' ? 'English' : 'हिन्दी'}</span>
            <span className="text-[10px] bg-black/20 px-1 py-0.2 rounded font-mono">
              {language === 'EN' ? 'HI' : 'EN'}
            </span>
          </button>

          {/* Current Live Time Display */}
          <div className="hidden xl:block font-mono text-[11px] text-amber-300/90 pl-2 border-l border-blue-900/60">
            {currentTime}
          </div>

        </div>
      </div>

      {/* 2. Main Header Bar (Exact match with user reference screenshot) */}
      <div className="bg-white py-3 px-4 md:px-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        
        {/* Left: Emblem + SRIMS Brand + Hindi Subtitle */}
        <div className="flex items-center space-x-4">
          <GovtEmblem size={52} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-[#003366] tracking-tight">{t('gov.title')}</h1>
              <span className="bg-[#138808] text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                GOVT. OF INDIA
              </span>
            </div>
            <h2 className="text-xs font-bold text-gray-900 leading-snug">{t('gov.subtitle')}</h2>
            <p className="text-[10px] text-gray-500 leading-tight" style={hindiStyle}>
              {t('gov.ministry')}
            </p>
          </div>
        </div>

        {/* Right: Emergency Helpline Box + Security Standard Box + User Control */}
        <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
          
          {/* Emergency Highway Helpline Pill Card */}
          <div className="hidden lg:flex items-center space-x-3 bg-blue-50/80 px-3.5 py-2 rounded-lg border border-blue-200">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-[#003366] flex items-center justify-center shrink-0">
              <Phone className="w-4 h-4 text-[#003366]" />
            </div>
            <div>
              <div className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">Emergency Highway Helpline</div>
              <div className="text-xs font-black text-[#003366]">1033 (24x7 Toll Free)</div>
            </div>
          </div>

          {/* Security Standard Card */}
          <div className="hidden lg:flex items-center space-x-3 bg-emerald-50/80 px-3.5 py-2 rounded-lg border border-emerald-200">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#138808] flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-[#138808]" />
            </div>
            <div>
              <div className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">Security Standard</div>
              <div className="text-xs font-black text-[#138808]">NIC Certified Portal</div>
            </div>
          </div>

          {/* User Account controls */}
          <div className="flex items-center space-x-2 w-full md:w-auto">

            {/* User Account Badge */}
            <div className="flex items-center justify-between w-full md:w-auto space-x-3 bg-gray-50 px-3 md:px-4 py-2 rounded-xl border border-gray-200 shadow-sm">
              <div className="text-left md:text-right text-xs flex-1">
                <div className="font-bold text-[#003366] truncate">{user.name}</div>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mt-0.5">{user.role.replace('_', ' ')}</div>
              </div>
              <button
                onClick={onLogout}
                title="Logout"
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition border border-gray-200 bg-white shadow-sm shrink-0 flex items-center space-x-1"
              >
                <span className="text-[10px] font-bold hidden md:inline mr-1">LOGOUT</span>
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* 3. Horizontal Navigation Bar */}
      <nav className="bg-[#003366] text-white border-t border-amber-500">
        <div className="flex items-center px-4 md:px-8 space-x-1 overflow-x-auto whitespace-nowrap py-1 scroll-smooth" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.action) {
                    item.action();
                  } else if (onTabChange) {
                    onTabChange(item.id);
                  }
                }}
                className={`flex items-center space-x-1.5 px-3 py-2.5 md:px-4 md:py-2.5 text-xs font-semibold rounded-lg transition shrink-0 snap-start ${
                  isActive
                    ? 'bg-[#001730] text-white border-b-2 border-amber-400'
                    : 'text-gray-200 hover:bg-[#001730]/60 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
          <div className="pr-4 md:pr-0"></div> {/* Spacer for scroll end */}
        </div>
      </nav>

      {/* Breadcrumb / Scope Strip */}
      {currentBreadcrumbs && currentBreadcrumbs.length > 0 && (
        <div className="bg-blue-50/80 px-4 md:px-8 py-2 text-[11px] md:text-xs text-gray-600 flex items-center space-x-2 border-b border-gray-200 overflow-x-auto whitespace-nowrap scrollbar-none">
          <span className="font-bold text-[#003366] uppercase tracking-wide">Scope:</span>
          {currentBreadcrumbs.map((b, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-gray-400">/</span>}
              {b.onClick ? (
                <button onClick={b.onClick} className="text-[#003366] hover:underline font-bold transition">
                  {b.label}
                </button>
              ) : (
                <span className="font-black text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-200 shadow-sm">{b.label}</span>
              )}
            </React.Fragment>
          ))}
        </div>
      )}

    </header>
  );
};

export default Header;
