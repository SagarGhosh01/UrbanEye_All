import React from 'react';

export const NhaiCityRoadLandscape: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
      {/* Clean Sky Blue Gradient Background */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, #7DC6FB 0%, #A4D7FC 50%, #C4E5FC 80%, #D8EEFE 100%)'
        }}
      />

      {/* 3. Detailed Vector City Buildings, Buses, Road & Highway Overpass Landscape */}
      <svg
        className="absolute bottom-0 left-0 right-0 w-full h-48 md:h-64 object-cover"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="bldgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#87BEE8" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#A2D1F7" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="roadGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#5B93C4" />
            <stop offset="100%" stopColor="#4177A8" />
          </linearGradient>
        </defs>

        {/* Silhouetted City Skyline Buildings */}
        <g fill="url(#bldgGrad)">
          {/* Left Buildings */}
          <rect x="20" y="140" width="60" height="120" rx="2" />
          <rect x="90" y="100" width="80" height="160" rx="3" />
          <rect x="180" y="160" width="50" height="100" rx="2" />
          <rect x="240" y="120" width="70" height="140" rx="2" />
          
          {/* Center Heritage Building / Station Silhouette */}
          <path d="M400 260 V120 L440 80 L480 120 V260 Z" />
          <rect x="490" y="140" width="90" height="120" rx="2" />
          <rect x="590" y="110" width="75" height="150" rx="3" />
          
          {/* Right Modern Tower Block */}
          <rect x="800" y="130" width="65" height="130" rx="2" />
          <rect x="875" y="90" width="85" height="170" rx="3" />
          <rect x="970" y="150" width="55" height="110" rx="2" />
          <rect x="1035" y="110" width="75" height="150" rx="2" />
          <rect x="1120" y="160" width="60" height="100" rx="2" />
          <rect x="1200" y="130" width="80" height="130" rx="3" />
        </g>

        {/* Highway Flyover Curve */}
        <path
          d="M-50 270 Q400 230 900 250 T1500 230"
          stroke="#4177A8"
          strokeWidth="14"
          fill="none"
          opacity="0.85"
        />

        {/* Road Surface Base Bar */}
        <rect x="0" y="270" width="1440" height="50" fill="url(#roadGrad)" />

        {/* White Dashed Road Markings */}
        <line
          x1="0"
          y1="290"
          x2="1440"
          y2="290"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeDasharray="24 16"
        />

        {/* Silhouetted Vehicles: Buses & Trucks */}
        <g fill="#2B5A87">
          {/* Bus 1 */}
          <rect x="120" y="250" width="75" height="24" rx="4" />
          <circle cx="135" cy="274" r="5" fill="#173552" />
          <circle cx="180" cy="274" r="5" fill="#173552" />

          {/* Bus 2 */}
          <rect x="780" y="252" width="80" height="23" rx="4" />
          <circle cx="795" cy="275" r="5" fill="#173552" />
          <circle cx="845" cy="275" r="5" fill="#173552" />

          {/* Freight Truck */}
          <rect x="1220" y="244" width="95" height="30" rx="3" />
          <rect x="1315" y="252" width="30" height="22" rx="2" />
          <circle cx="1240" cy="275" r="6" fill="#173552" />
          <circle cx="1300" cy="275" r="6" fill="#173552" />
          <circle cx="1330" cy="275" r="6" fill="#173552" />
        </g>
      </svg>
    </div>
  );
};

export default NhaiCityRoadLandscape;
