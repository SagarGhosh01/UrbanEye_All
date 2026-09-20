import React from 'react';

interface GovtEmblemProps {
  className?: string;
  size?: number;
}

export const GovtEmblem: React.FC<GovtEmblemProps> = ({ className = '', size = 52 }) => {
  return (
    <div 
      className={`relative flex items-center justify-center shrink-0 bg-white rounded-full p-0.5 border border-slate-200 shadow-sm ${className}`} 
      style={{ width: size, height: size }}
    >
      <img
        src="/srims-govt-seal.jpg"
        alt="Govt. of India SRIMS Official Seal"
        className="w-full h-full object-contain rounded-full"
      />
    </div>
  );
};

export default GovtEmblem;
