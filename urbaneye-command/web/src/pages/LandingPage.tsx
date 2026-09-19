import React, { useState } from 'react';
import { 
  Shield, MapPin, Activity, Bus, TrendingUp, Lock, 
  UserCheck, ArrowRight, AlertCircle, FileText, CheckCircle2, 
  ExternalLink, Info, Phone, KeyRound, Server, Eye, Layers, Compass,
  Camera, Navigation, CheckSquare, BarChart2, ShieldAlert, Globe, Type
} from 'lucide-react';
import GovtFooter from '../components/GovtFooter';
import NhaiCityRoadLandscape from '../components/NhaiCityRoadLandscape';
import { useLanguage } from '../contexts/LanguageContext';
import { GovtEmblem } from '../components/GovtEmblem';
import { SrimsHeaderBrand } from '../components/SrimsHeaderBrand';

interface LandingPageProps {
  onLoginClick?: (userRole?: string) => void;
  onSelectDemoUser?: (userEmail: string, password?: string) => Promise<void> | void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick, onSelectDemoUser }) => {
  const { language, toggleLanguage, fontSize, setFontSize, t } = useLanguage();
  const [email, setEmail] = useState('commissioner@transport.gov.in');
  const [password, setPassword] = useState('••••••••••••');
  const [loginRole, setLoginRole] = useState<'OFFICER' | 'INSPECTOR' | 'CITIZEN'>('OFFICER');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hindiStyle = { fontFamily: "'Noto Sans Devanagari', sans-serif" };

  const handleQuickLogin = async (roleEmail: string) => {
    setError(null);
    setIsSubmitting(true);
    try {
      if (onSelectDemoUser) {
        await onSelectDemoUser(roleEmail, 'UrbanEye@2026');
      } else if (onLoginClick) {
        onLoginClick(roleEmail);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (onSelectDemoUser) {
        await onSelectDemoUser(email, password);
      } else if (onLoginClick) {
        onLoginClick(email);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      
      {/* 1. Official Top Marquee Banner with English / Hindi Switcher */}
      <div className="bg-[#002244] text-white py-1.5 px-4 flex flex-wrap justify-between items-center text-xs border-b border-amber-500/40 gap-2">
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

        {/* English / Hindi Language Switcher */}
        <div className="flex items-center space-x-3 shrink-0 text-xs">
          <div className="flex items-center bg-[#001730] px-2 py-0.5 rounded border border-blue-900/60 space-x-1 text-[11px]">
            <Type className="w-3 h-3 text-amber-400" />
            <button 
              onClick={() => setFontSize('normal')}
              className={`px-1 rounded font-bold ${fontSize === 'normal' ? 'bg-amber-400 text-black' : 'text-gray-300 hover:text-white'}`}
            >
              A
            </button>
            <button 
              onClick={() => setFontSize('large')}
              className={`px-1 rounded font-bold ${fontSize === 'large' ? 'bg-amber-400 text-black' : 'text-gray-300 hover:text-white'}`}
            >
              A+
            </button>
          </div>

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
        </div>
      </div>

      {/* 2. Main Portal Header */}
      <header className="bg-white border-b shadow-sm py-4 px-4 md:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          
          {/* Emblem & SRIMS Title */}
          <div className="flex items-center space-x-4">
            <GovtEmblem size={52} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-[#003366] tracking-tight">{t('gov.title')}</h1>
                <span className="bg-[#138808] text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                  GOVT. OF INDIA
                </span>
              </div>
              <h2 className="text-xs font-bold text-gray-900 leading-tight">{t('gov.subtitle')}</h2>
              <p className="text-[10px] text-gray-500 leading-tight mt-0.5" style={hindiStyle}>
                {t('gov.ministry')}
              </p>
            </div>
          </div>

          {/* Right Cards: Emergency Helpline & Security Standard */}
          <div className="flex items-center space-x-4 text-xs">
            <div className="hidden lg:flex items-center space-x-3 bg-blue-50/80 px-3.5 py-2 rounded-lg border border-blue-200">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-[#003366] flex items-center justify-center shrink-0">
                <Phone className="w-4 h-4 text-[#003366]" />
              </div>
              <div>
                <div className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">{t('helpline.title')}</div>
                <div className="text-xs font-black text-[#003366]">{t('helpline.number')}</div>
              </div>
            </div>

            <div className="hidden lg:flex items-center space-x-3 bg-emerald-50/80 px-3.5 py-2 rounded-lg border border-emerald-200">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#138808] flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4 text-[#138808]" />
              </div>
              <div>
                <div className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">{t('security.title')}</div>
                <div className="text-xs font-black text-[#138808]">{t('security.certified')}</div>
              </div>
            </div>
          </div>

        </div>
      </header>

      {/* 3. Hero Section with Official NHAI Light Sky Blue City Landscape Background */}
      <section className="relative text-gray-900 py-12 md:py-16 px-4 overflow-hidden min-h-[580px] flex items-center">
        
        {/* Official NHAI Light Blue City Landscape Background Component */}
        <NhaiCityRoadLandscape />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10 w-full">
          
          {/* Hero Left Text & Overview */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center space-x-2 bg-[#003366] text-white px-3.5 py-1 rounded-full text-xs font-semibold shadow-sm">
              <Server className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('hero.badge')}</span>
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black leading-tight text-[#003366] tracking-tight">
              {t('hero.title')}
            </h1>
            
            <p className="text-gray-800 text-sm md:text-base leading-relaxed font-medium">
              {t('hero.desc')}
            </p>

            {/* NHAI Style Floating Pointer Stat Cards ("परियोजना की झलक") */}
            <div className="pt-2">
              <div className="text-xs font-black text-[#003366] uppercase tracking-wider mb-3" style={hindiStyle}>
                {t('hero.highlights')}
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                {/* Pointer Card 1 */}
                <div className="relative bg-white p-3.5 rounded-xl border border-blue-200 shadow-lg text-center group hover:scale-105 transition">
                  <div className="text-2xl font-black text-[#003366]">{t('hero.stat1.val')}</div>
                  <div className="text-[11px] font-bold text-gray-600">{t('hero.stat1.lbl')}</div>
                  <div className="text-[9px] text-gray-400" style={hindiStyle}>{t('hero.stat1.sub')}</div>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-white"></div>
                </div>

                {/* Pointer Card 2 */}
                <div className="relative bg-white p-3.5 rounded-xl border border-blue-200 shadow-lg text-center group hover:scale-105 transition">
                  <div className="text-2xl font-black text-[#138808]">{t('hero.stat2.val')}</div>
                  <div className="text-[11px] font-bold text-gray-600">{t('hero.stat2.lbl')}</div>
                  <div className="text-[9px] text-gray-400" style={hindiStyle}>{t('hero.stat2.sub')}</div>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-white"></div>
                </div>

                {/* Pointer Card 3 */}
                <div className="relative bg-white p-3.5 rounded-xl border border-blue-200 shadow-lg text-center group hover:scale-105 transition">
                  <div className="text-2xl font-black text-[#FF9933]">{t('hero.stat3.val')}</div>
                  <div className="text-[11px] font-bold text-gray-600">{t('hero.stat3.lbl')}</div>
                  <div className="text-[9px] text-gray-400" style={hindiStyle}>{t('hero.stat3.sub')}</div>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-white"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Integrated Official Government Login Card */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-xl shadow-2xl border-2 border-blue-200 text-gray-800 overflow-hidden">
              
              {/* Header inside Login Card */}
              <div className="bg-[#002244] text-white px-6 py-4 border-b border-amber-500/40 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <KeyRound className="w-5 h-5 text-amber-400" />
                  <div>
                    <h2 className="text-base font-bold leading-tight">Official SRIMS Sign In</h2>
                    <p className="text-[10px] text-gray-300">Single Sign-On (SSO) for Authorized Personnel</p>
                  </div>
                </div>
                <span className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase">
                  SECURE
                </span>
              </div>

              {/* Login Role Selector Tabs */}
              <div className="grid grid-cols-3 border-b border-gray-200 bg-gray-100 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => { setLoginRole('OFFICER'); setEmail('commissioner@transport.gov.in'); }}
                  className={`py-2.5 text-center border-b-2 transition-colors ${
                    loginRole === 'OFFICER'
                      ? 'border-[#003366] text-[#003366] bg-white font-bold'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  MoRTH / Officer
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginRole('INSPECTOR'); setEmail('inspector.rajesh@nhai.gov.in'); }}
                  className={`py-2.5 text-center border-b-2 transition-colors ${
                    loginRole === 'INSPECTOR'
                      ? 'border-[#003366] text-[#003366] bg-white font-bold'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Field Inspector
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginRole('CITIZEN'); setEmail('citizen@urbaneye.gov.in'); }}
                  className={`py-2.5 text-center border-b-2 transition-colors ${
                    loginRole === 'CITIZEN'
                      ? 'border-[#003366] text-[#003366] bg-white font-bold'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Public / Citizen
                </button>
              </div>

              <div className="p-6 space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      {t('login.email')}
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#003366] focus:border-[#003366] outline-none"
                      placeholder="commissioner@transport.gov.in"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                        {t('login.password')}
                      </label>
                      <a href="#" onClick={(e) => e.preventDefault()} className="text-xs text-[#003366] hover:underline">
                        Forgot Password?
                      </a>
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#003366] focus:border-[#003366] outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 px-4 bg-[#003366] hover:bg-[#002244] disabled:opacity-75 text-white font-bold text-sm rounded-lg shadow-md transition duration-150 flex items-center justify-center space-x-2"
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <span>{t('login.btn')}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="relative my-3">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                  <div className="relative flex justify-center text-[10px] uppercase font-bold text-gray-400 bg-white px-2">
                    Or Quick One-Click Demo Access
                  </div>
                </div>

                {/* Quick Demo Login Preset Buttons */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('commissioner@transport.gov.in')}
                    className="py-1.5 px-2 bg-blue-50 border border-blue-200 rounded text-[11px] font-medium text-[#003366] hover:bg-blue-100 text-center truncate"
                  >
                    Commissioner
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('inspector.rajesh@nhai.gov.in')}
                    className="py-1.5 px-2 bg-emerald-50 border border-emerald-200 rounded text-[11px] font-medium text-emerald-900 hover:bg-emerald-100 text-center truncate"
                  >
                    NHAI Inspector
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('contractor.sharma@infra.com')}
                    className="py-1.5 px-2 bg-amber-50 border border-amber-200 rounded text-[11px] font-medium text-amber-900 hover:bg-amber-100 text-center truncate"
                  >
                    Contractor
                  </button>
                </div>

                <div className="text-[10px] text-gray-500 bg-gray-50 p-2 rounded border border-gray-200 flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>Protected under IT Act 2000. Unauthorized access is punishable by law.</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 4. Core Modules & System Features */}
      <section className="py-12 px-4 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <span className="text-xs font-bold text-[#003366] uppercase tracking-widest bg-blue-100 px-3 py-1 rounded-full">
            Core Operational Modules
          </span>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mt-2">
            Integrated Highway Surveillance System
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Standardized operational command frameworks for state highway departments, municipal authorities, and emergency response teams.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition group">
            <div className="w-12 h-12 rounded-lg bg-blue-50 text-[#003366] flex items-center justify-center mb-4 group-hover:bg-[#003366] group-hover:text-white transition">
              <MapPin className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-2">Automated Pothole &amp; Defect Detection</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              AI vision models detect potholes, cracks, and rutting from bus-mounted and drone cameras with severity categorization.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition group">
            <div className="w-12 h-12 rounded-lg bg-emerald-50 text-[#138808] flex items-center justify-center mb-4 group-hover:bg-[#138808] group-hover:text-white transition">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-2">Real-Time Traffic &amp; Density Intelligence</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Live traffic flow tracking, congestion bottleneck pinpointing, and automated signal timing adjustments.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition group">
            <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center mb-4 group-hover:bg-amber-700 group-hover:text-white transition">
              <Bus className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-2">Fleet &amp; Inspector Dispatch Tracker</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Live GPS tracking of government patrol vehicles, public transit sensor buses, and maintenance contractors.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition group">
            <div className="w-12 h-12 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center mb-4 group-hover:bg-purple-700 group-hover:text-white transition">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-2">Predictive Maintenance Engine</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Predict road degradation up to 90 days in advance based on rainfall data, traffic load, and historical wear.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Footer */}
      <GovtFooter />
    </div>
  );
};

export default LandingPage;
