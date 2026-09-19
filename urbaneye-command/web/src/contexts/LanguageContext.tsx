import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'EN' | 'HI';
export type FontSize = 'normal' | 'large' | 'xlarge';

interface LanguageContextType {
  language: Language;
  fontSize: FontSize;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
  setFontSize: (size: FontSize) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  EN: {
    // Top Bar & Marquee
    'announcement.title': 'OFFICIAL ANNOUNCEMENT',
    'announcement.text': 'SRIMS Portal v3.4 Active: Real-time AI road defect monitoring deployed across 14,500+ km National Highways & Urban Corridors | Emergency Helpline: 1033',
    'gov.title': 'SRIMS',
    'gov.subtitle': 'Smart Road Infrastructure Management System',
    'gov.ministry': 'Ministry of Road Transport & Highways | National Highways Authority of India',
    'gov.emblemText': 'Satyamev Jayate',
    'helpline.title': 'Emergency Highway Helpline',
    'helpline.number': '1033 (24x7 Toll Free)',
    'security.title': 'Security Standard',
    'security.certified': 'NIC Certified Portal',

    // Navigation
    'nav.defects': 'Defect Monitoring',
    'nav.map': 'Live Map',
    'nav.analytics': 'Analytics',
    'nav.traffic': 'Traffic Intelligence',
    'nav.incidents': 'Incident Response',
    'nav.safety': 'Safety Intelligence',
    'nav.predictive': 'Predictive AI',
    'nav.citizen': 'Citizen Portal',
    'nav.pairUnit': 'Pair Mobile Unit',
    'nav.liveCamera': 'Live Stream',

    // Hero / Landing
    'hero.badge': 'National AI Infrastructure Surveillance Platform',
    'hero.title': 'AI-Powered Real-Time Highway Infrastructure Surveillance',
    'hero.desc': 'SRIMS integrates computer vision, IoT telemetry, and predictive AI analytics to continuously monitor road health, detect potholes, automate work order assignments, and manage multi-modal traffic across India.',
    'hero.highlights': 'Project Highlights | परियोजना की झलक',
    'hero.stat1.val': '14,500+',
    'hero.stat1.lbl': 'KM Highways Covered',
    'hero.stat1.sub': 'Total Length (KM)',
    'hero.stat2.val': '98.4%',
    'hero.stat2.lbl': 'AI Detection Accuracy',
    'hero.stat2.sub': 'Precision Rate',
    'hero.stat3.val': '24/7',
    'hero.stat3.lbl': 'Automated Surveillance',
    'hero.stat3.sub': 'Active Coverage',
    
    // Auth & Login
    'login.portalTitle': 'SRIMS SSO Portal Access',
    'login.subtitle': 'Government of India Single Sign-On Access',
    'login.email': 'Official Email / Government ID',
    'login.password': 'Password / Passcode',
    'login.role': 'Portal Role / User Type',
    'login.btn': 'Sign In to Portal',
    'login.quickDemo': 'Quick Access Presets',
    'login.officer': 'Transport Commissioner',
    'login.inspector': 'Road Inspector',
    'login.citizen': 'Citizen Reporter',

    // Dashboard & Table
    'table.search': 'Search defects by ID, road, city or status...',
    'table.id': 'Incident ID',
    'table.type': 'Defect Type',
    'table.severity': 'Severity',
    'table.location': 'Location',
    'table.time': 'Reported Time',
    'table.status': 'Status',
    'table.actions': 'Actions',
    'table.export': 'Export Report (PDF/CSV)',

    // Statuses
    'status.new': 'NEW REPORTED',
    'status.reviewed': 'UNDER REVIEW',
    'status.assigned': 'WORK ORDER ASSIGNED',
    'status.resolved': 'REPAIRED & VERIFIED',

    // Footer
    'footer.disclaimer': 'Official Portal of Ministry of Road Transport and Highways (MoRTH), Government of India.',
    'footer.copyright': '© 2026 National Highways Authority of India (NHAI) / SRIMS. All rights reserved.',
    'footer.lastUpdated': 'Last Updated: September 20, 2026',
    'footer.privacy': 'Privacy Policy',
    'footer.terms': 'Terms of Service',
    'footer.helpdesk': 'Helpdesk Support'
  },
  HI: {
    // Top Bar & Marquee
    'announcement.title': 'आधिकारिक घोषणा',
    'announcement.text': 'SRIMS पोर्टल v3.4 सक्रिय: 14,500+ किमी राष्ट्रीय राजमार्गों पर रीयल-टाइम AI सड़क दोष निगरानी | आपातकालीन हेल्पलाइन: 1033',
    'gov.title': 'SRIMS',
    'gov.subtitle': 'स्मार्ट सड़क अवसंरचना प्रबंधन प्रणाली',
    'gov.ministry': 'सड़क परिवहन एवं राजमार्ग मंत्रालय | भारतीय राष्ट्रीय राजमार्ग प्राधिकरण',
    'gov.emblemText': 'सत्यमेव जयते',
    'helpline.title': 'आपतकालीन राजमार्ग हेल्पलाइन',
    'helpline.number': '1033 (24x7 टोल फ्री)',
    'security.title': 'सुरक्षा मानक',
    'security.certified': 'एनआईसी प्रमाणित पोर्टल',

    // Navigation
    'nav.defects': 'सड़क दोष निगरानी',
    'nav.map': 'लाइव मानचित्र',
    'nav.analytics': 'विश्लेषण डेटा',
    'nav.traffic': 'यातायात आसूचना',
    'nav.incidents': 'दुर्घटना त्वरित कार्रवाई',
    'nav.safety': 'सड़क सुरक्षा विश्लेषण',
    'nav.predictive': 'पूर्वानुमानित AI',
    'nav.citizen': 'नागरिक सेवा पोर्टल',
    'nav.pairUnit': 'मोबाइल यूनिट जोड़ें',
    'nav.liveCamera': 'लाइव कैमरा स्ट्रीम',

    // Hero / Landing
    'hero.badge': 'राष्ट्रीय AI सड़क निगरानी मंच',
    'hero.title': 'AI-संचालित रीयल-टाइम राजमार्ग अवसंरचना निगरानी प्रणाली',
    'hero.desc': 'SRIMS कंप्यूटर विज़न, IoT टेलीमेट्री और AI विश्लेषण को एकीकृत करता है ताकि सड़क स्वास्थ्य की निरंतर निगरानी की जा सके, गड्ढों का पता लगाया जा सके और मरम्मत कार्यों को स्वचालित किया जा सके।',
    'hero.highlights': 'परियोजना की झलक | Project Highlights',
    'hero.stat1.val': '77,618',
    'hero.stat1.lbl': 'कुल लंबाई (किमी)',
    'hero.stat1.sub': 'कुल राजमार्ग नेटवर्क',
    'hero.stat2.val': '65,773',
    'hero.stat2.lbl': 'पूर्ण लंबाई (किमी)',
    'hero.stat2.sub': 'डिजिटल रूप से निगरानी',
    'hero.stat3.val': '8,010',
    'hero.stat3.lbl': 'निर्माणाधीन (किमी)',
    'hero.stat3.sub': 'चल रहे मरम्मत कार्य',

    // Auth & Login
    'login.portalTitle': 'SRIMS सिंगल साइन-ऑन (SSO) लॉगिन',
    'login.subtitle': 'भारत सरकार आधिकारिक एसएसओ पोर्टल पहुँच',
    'login.email': 'आधिकारिक ईमेल / भारत सरकार आईडी',
    'login.password': 'पासवर्ड / पासकोड',
    'login.role': 'पोर्टल उपयोगकर्ता पद',
    'login.btn': 'पोर्टल में प्रवेश करें',
    'login.quickDemo': 'त्वरित प्रवेश विकल्प',
    'login.officer': 'परिवहन आयुक्त',
    'login.inspector': 'सड़क निरीक्षक',
    'login.citizen': 'नागरिक रिपोर्टर',

    // Dashboard & Table
    'table.search': 'आईडी, सड़क, शहर या स्थिति द्वारा खोजें...',
    'table.id': 'घटना आईडी',
    'table.type': 'दोष प्रकार',
    'table.severity': 'गंभीरता स्तर',
    'table.location': 'स्थान विवरण',
    'table.time': 'रिपोर्ट का समय',
    'table.status': 'स्थिति',
    'table.actions': 'कार्रवाई',
    'table.export': 'रिपोर्ट डाउनलोड करें (PDF/CSV)',

    // Statuses
    'status.new': 'नई रिपोर्ट',
    'status.reviewed': 'समीक्षाधीन',
    'status.assigned': 'कार्य आदेश जारी',
    'status.resolved': 'मरम्मत पूर्ण एवं सत्यापित',

    // Footer
    'footer.disclaimer': 'सड़क परिवहन और राजमार्ग मंत्रालय (MoRTH), भारत सरकार का आधिकारिक पोर्टल।',
    'footer.copyright': '© 2026 भारतीय राष्ट्रीय राजमार्ग प्राधिकरण (NHAI) / SRIMS। सर्वाधिकार सुरक्षित।',
    'footer.lastUpdated': 'अंतिम अद्यतन: 20 सितंबर 2026',
    'footer.privacy': 'गोपनीयता नीति',
    'footer.terms': 'सेवा की शर्तें',
    'footer.helpdesk': 'हेल्पडेस्क सहायता'
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('srims_lang') as Language) || 'EN';
  });

  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    return (localStorage.getItem('srims_fontsize') as FontSize) || 'normal';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('srims_lang', lang);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'EN' ? 'HI' : 'EN');
  };

  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
    localStorage.setItem('srims_fontsize', size);
  };

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('text-size-normal', 'text-size-large', 'text-size-xlarge');
    root.classList.add(`text-size-${fontSize}`);
  }, [fontSize]);

  const t = (key: string): string => {
    return translations[language][key] || translations['EN'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, fontSize, toggleLanguage, setLanguage, setFontSize, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
