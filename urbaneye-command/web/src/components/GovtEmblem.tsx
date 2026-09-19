import React from 'react';

interface GovtEmblemProps {
  className?: string;
  size?: number;
}

export const GovtEmblem: React.FC<GovtEmblemProps> = ({ className = '', size = 52 }) => {
  return (
    <div 
      className={`relative flex items-center justify-center shrink-0 bg-white rounded-lg p-1 border border-amber-300 shadow-sm ${className}`} 
      style={{ width: size, height: size }}
    >
      <img
        src="/emblem.png?v=5"
        alt="State Emblem of India"
        className="w-full h-full object-contain mix-blend-multiply"
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/emblem.svg';
        }}
      />
    </div>
  );
};

export default GovtEmblem;
