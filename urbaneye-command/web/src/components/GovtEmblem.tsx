import React from 'react';

interface GovtEmblemProps {
  className?: string;
  size?: number;
}

export const GovtEmblem: React.FC<GovtEmblemProps> = ({ className = '', size = 56 }) => {
  return (
    <div 
      className={`relative flex items-center justify-center shrink-0 bg-white rounded-full p-0.5 border border-slate-300 shadow-sm ${className}`} 
      style={{ width: size, height: size }}
    >
      <img
        src="/srims_seal_logo.png?v=3"
        alt="SRIMS Official Government Seal"
        className="w-full h-full object-contain rounded-full mix-blend-multiply"
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/emblem.svg';
        }}
      />
    </div>
  );
};

export default GovtEmblem;
