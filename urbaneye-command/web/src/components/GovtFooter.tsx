import React from 'react';
import { Eye } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export const GovtFooter: React.FC = () => {
  const { language, t } = useLanguage();
  const currentDate = new Date().toLocaleDateString(language === 'HI' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <footer className="bg-[#08243D] text-white pt-10 font-sans border-t-4 border-[#F2A900]">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8 text-xs">
          
          {/* Column 1: Identity */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded bg-[#0B3558] text-white flex items-center justify-center font-bold">
                <Eye className="w-4 h-4 text-[#F2A900]" />
              </div>
              <span className="text-base font-black tracking-tight text-white uppercase">SRIMS / SRIMS</span>
            </div>
            <p className="text-gray-300 leading-relaxed text-xs">
              {t('footer.disclaimer')}
            </p>
          </div>

          {/* Column 2: Platform */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold border-b border-gray-700 pb-2 text-gray-200 uppercase tracking-wider">
              Platform Modules
            </h3>
            <ul className="space-y-2 text-gray-300 text-xs">
              <li><a href="#monitoring" className="hover:text-[#F2A900] transition">Defect Monitoring</a></li>
              <li><a href="#map" className="hover:text-[#F2A900] transition">Road Intelligence Map</a></li>
              <li><a href="#issues" className="hover:text-[#F2A900] transition">Issue Register</a></li>
              <li><a href="#analytics" className="hover:text-[#F2A900] transition">Analytics Engine</a></li>
              <li><a href="#reports" className="hover:text-[#F2A900] transition">Infrastructure Reports</a></li>
            </ul>
          </div>

          {/* Column 3: Resources */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold border-b border-gray-700 pb-2 text-gray-200 uppercase tracking-wider">
              Resources
            </h3>
            <ul className="space-y-2 text-gray-300 text-xs">
              <li><a href="#docs" className="hover:text-[#F2A900] transition">Documentation</a></li>
              <li><a href="#help" className="hover:text-[#F2A900] transition">Help Center</a></li>
              <li><a href="#accessibility" className="hover:text-[#F2A900] transition">Accessibility</a></li>
              <li><a href="#privacy" className="hover:text-[#F2A900] transition">Privacy Policy</a></li>
              <li><a href="#terms" className="hover:text-[#F2A900] transition">Terms of Use</a></li>
            </ul>
          </div>

          {/* Column 4: Project */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold border-b border-gray-700 pb-2 text-gray-200 uppercase tracking-wider">
              Project Info
            </h3>
            <ul className="space-y-2 text-gray-300 text-xs">
              <li><a href="#about" className="hover:text-[#F2A900] transition">About SRIMS</a></li>
              <li><a href="#tech" className="hover:text-[#F2A900] transition">Computer Vision Tech</a></li>
              <li><a href="#contact" className="hover:text-[#F2A900] transition">Contact &amp; Feedback</a></li>
            </ul>
            <div className="pt-2 text-gray-400 text-[11px]">
              Public Infrastructure Technology Prototype
            </div>
          </div>

        </div>
      </div>

      {/* Bottom Bar */}
      <div className="bg-[#0B3558] py-3 border-t border-gray-800 text-xs text-gray-300">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center space-y-2 md:space-y-0">
          <p>SRIMS — Public Infrastructure Technology Prototype | © 2026 SRIMS</p>
          <div className="flex space-x-6 text-[11px] text-gray-400">
            <span>Last Updated: {currentDate}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default GovtFooter;
