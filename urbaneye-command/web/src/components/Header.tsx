import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { 
  Home, LayoutDashboard, Eye, FileText, Map, AlertTriangle, 
  Info, LogOut, Phone, Shield, AlertCircle, Globe, Type, Menu, X, Sparkles
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { GovtEmblem } from './GovtEmblem';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <header className="w-full max-w-full flex flex-col z-50 bg-white border-b border-gray-200 shadow-xs font-sans text-gray-900 overflow-x-hidden">
      
      {/* 1. Top Announcement & Utility Bar */}
      <div className="bg-[#002244] text-white py-1 px-2.5 sm:px-4 flex items-center justify-between text-xs border-b border-amber-500/40 gap-2 max-w-full overflow-hidden">
        
        {/* Left: Announcement Marquee */}
        <div className="flex items-center space-x-1.5 overflow-hidden flex-1 min-w-0">
          <div className="bg-[#FF9933] text-black font-bold px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] tracking-wide flex items-center gap-1 shrink-0 uppercase">
            <AlertCircle className="w-3 h-3" /> <span className="hidden sm:inline">{t('announcement.title')}</span><span className="sm:hidden">NOTICE</span>
          </div>
          <div className="overflow-hidden whitespace-nowrap text-gray-200 text-[11px] sm:text-xs flex-1 min-w-0">
            <div className="inline-block animate-marquee truncate">
              🚨 {t('announcement.text')}
            </div>
          </div>
        </div>

        {/* Right: Language Switcher */}
        <div className="flex items-center space-x-1.5 shrink-0 text-xs">
          <span className="hidden lg:inline-flex items-center gap-1 bg-amber-400/20 text-amber-300 text-[9px] font-bold px-2 py-0.5 rounded border border-amber-400/30 uppercase tracking-wider">
            <Sparkles className="w-2.5 h-2.5 text-amber-400" /> Command Center Live
          </span>

          {/* Accessibility Font Size Resizer (Desktop) */}
          <div className="hidden sm:flex items-center bg-[#001730] px-1.5 py-0.5 rounded border border-blue-900/60 space-x-1 text-[10px]">
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

          {/* English / Hindi Switch Button */}
          <button
            onClick={toggleLanguage}
            className="bg-amber-500 hover:bg-amber-400 text-black font-black px-2 py-0.5 sm:px-2.5 sm:py-1 rounded flex items-center space-x-1 text-[10px] sm:text-xs transition shadow-xs border border-amber-300 shrink-0"
            title="Switch Language (English / हिन्दी)"
          >
            <Globe className="w-3 h-3 text-black" />
            <span className="font-sans font-bold text-[10px] sm:text-[11px]">{language === 'EN' ? 'EN' : 'HI'}</span>
          </button>
        </div>
      </div>

      {/* 2. Main Header Bar */}
      <div className="bg-white py-2.5 px-3 sm:px-6 md:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-full">
        
        {/* Left Side: Emblem + Integrated Brand & Title */}
        <div className="flex items-center justify-between sm:justify-start min-w-0 flex-1 space-x-3">
          {/* Emblem */}
          <div className="shrink-0">
            <GovtEmblem size={44} />
          </div>

          {/* Desktop Vertical Divider */}
          <div className="hidden sm:block h-10 w-px bg-gray-200 shrink-0"></div>

          {/* Brand Title & Subtitle Group */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-[#003366] tracking-tight leading-none">
                {t('gov.title')}
              </h1>
              <span className="bg-[#138808] text-white text-[8px] sm:text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                GOVT. OF INDIA
              </span>
            </div>
            
            {/* Desktop Subtitle & Ministry */}
            <div className="hidden sm:block mt-0.5">
              <h2 className="text-xs font-bold text-gray-900 leading-snug">
                {t('gov.subtitle')}
              </h2>
              <p className="text-[10px] text-gray-500 leading-tight truncate" style={hindiStyle}>
                {t('gov.ministry')}
              </p>
            </div>
          </div>

          {/* Mobile Right Controls: User Badge & Mobile Drawer Toggle */}
          <div className="flex items-center space-x-1.5 shrink-0 sm:hidden">
            <div className="text-right text-[10px] leading-tight max-w-[110px] truncate">
              <div className="font-bold text-[#003366] truncate">{user.name.split(' ')[0]}</div>
              <div className="text-[8px] text-gray-500 font-bold uppercase truncate">{user.role.replace('_', ' ')}</div>
            </div>
            <button
              onClick={onLogout}
              title="Logout"
              className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded border border-gray-200 bg-gray-50 shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 transition min-h-[36px] min-w-[36px] flex items-center justify-center"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile-Only Subtitle Row */}
        <div className="sm:hidden w-full text-[#002244] border-t border-gray-100 pt-1.5">
          <h2 className="text-[11px] font-bold text-gray-800 leading-snug">
            {t('gov.subtitle')}
          </h2>
          <p className="text-[9px] text-gray-500 leading-tight truncate mt-0.5" style={hindiStyle}>
            {t('gov.ministry')}
          </p>
        </div>

        {/* Right Side Cards for Tablet & Desktop */}
        <div className="hidden sm:flex items-center space-x-3 shrink-0">
          {/* Emergency Highway Helpline Pill Card */}
          <div className="hidden lg:flex items-center space-x-2.5 bg-blue-50/80 px-3 py-1.5 rounded-xl border border-blue-200 shadow-xs hover:border-blue-300 transition">
            <div className="w-7 h-7 rounded-full bg-blue-100 text-[#003366] flex items-center justify-center shrink-0">
              <Phone className="w-3.5 h-3.5 text-[#003366]" />
            </div>
            <div>
              <div className="text-[8px] uppercase font-bold text-gray-500 tracking-wider">Emergency Highway Helpline</div>
              <div className="text-xs font-black text-[#003366]">1033 (24x7 Toll Free)</div>
            </div>
          </div>

          {/* Security Standard Card */}
          <div className="hidden lg:flex items-center space-x-2.5 bg-emerald-50/80 px-3 py-1.5 rounded-xl border border-emerald-200 shadow-xs hover:border-emerald-300 transition">
            <div className="w-7 h-7 rounded-full bg-emerald-100 text-[#138808] flex items-center justify-center shrink-0">
              <Shield className="w-3.5 h-3.5 text-[#138808]" />
            </div>
            <div>
              <div className="text-[8px] uppercase font-bold text-gray-500 tracking-wider">Security Standard</div>
              <div className="text-xs font-black text-[#138808]">NIC Certified Portal</div>
            </div>
          </div>

          {/* User Account Controls */}
          <div className="flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 shadow-xs hover:bg-gray-100/80 transition">
            <div className="text-left text-xs min-w-0">
              <div className="font-bold text-[#003366] text-xs truncate">{user.name}</div>
              <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wide truncate">{user.role.replace('_', ' ')}</div>
            </div>
            <button
              onClick={onLogout}
              title="Logout"
              className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition border border-gray-200 bg-white shadow-xs shrink-0 flex items-center space-x-1 min-h-[36px]"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold">LOGOUT</span>
            </button>
          </div>
        </div>

      </div>

      {/* Mobile Drawer Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#001730] text-white px-4 py-3 border-t border-amber-500/40 space-y-2 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-blue-900/60">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
              OFFICIAL COMMAND PORTAL • {user.role.replace('_', ' ')}
            </span>
            <span className="text-[10px] text-gray-400">SRIMS v3.4</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="bg-blue-950/60 p-2 rounded border border-blue-800/40">
              <span className="text-[9px] text-gray-400 block">HELPLINE</span>
              <span className="font-bold text-white">1033 (24x7 Toll Free)</span>
            </div>
            <div className="bg-blue-950/60 p-2 rounded border border-blue-800/40">
              <span className="text-[9px] text-gray-400 block">SECURITY</span>
              <span className="font-bold text-emerald-400">NIC Compliant</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Horizontal Navigation Bar */}
      <nav className="bg-[#003366] text-white border-t border-amber-500 w-full max-w-full overflow-hidden">
        <div className="flex items-center px-2 sm:px-6 md:px-8 space-x-1 overflow-x-auto whitespace-nowrap py-1 scroll-smooth max-w-full scrollbar-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
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
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center space-x-1.5 px-3 py-2.5 text-xs font-semibold rounded-lg transition shrink-0 snap-start min-h-[40px] ${
                  isActive
                    ? 'bg-[#001730] text-white border-b-2 border-amber-400 font-bold shadow-xs'
                    : 'text-gray-200 hover:bg-[#001730]/60 hover:text-white'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-gray-300'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Breadcrumb / Scope Strip */}
      {currentBreadcrumbs && currentBreadcrumbs.length > 0 && (
        <div className="bg-blue-50/80 px-3 sm:px-6 md:px-8 py-1.5 text-[11px] sm:text-xs text-gray-600 flex items-center space-x-2 border-b border-gray-200 overflow-x-auto whitespace-nowrap scrollbar-none max-w-full">
          <span className="font-bold text-[#003366] uppercase tracking-wide shrink-0">Scope:</span>
          {currentBreadcrumbs.map((b, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-gray-400 shrink-0">/</span>}
              {b.onClick ? (
                <button onClick={b.onClick} className="text-[#003366] hover:underline font-bold transition shrink-0">
                  {b.label}
                </button>
              ) : (
                <span className="font-black text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-200 shadow-xs shrink-0">{b.label}</span>
              )}
            </React.Fragment>
          ))}
        </div>
      )}

    </header>
  );
};

export default Header;

