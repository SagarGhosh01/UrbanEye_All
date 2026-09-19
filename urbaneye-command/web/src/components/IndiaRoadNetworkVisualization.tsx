import React from 'react';

export const IndiaRoadNetworkVisualization: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-25">
      {/* 1. Subtle Radial Grid Mesh */}
      <div 
        className="absolute inset-0" 
        style={{
          backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px), linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
          backgroundSize: '32px 32px, 32px 32px, 32px 32px'
        }}
      />

      {/* 2. Vector Map Representation of India's National Highway Network (Golden Quadrilateral & NH Corridors) */}
      <svg 
        className="w-full h-full object-cover" 
        viewBox="0 0 1000 600" 
        preserveAspectRatio="xMidYMid slice"
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="nhGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF9933" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#38BDF8" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#138808" stopOpacity="0.8" />
          </linearGradient>

          <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Major National Highway Lines (Golden Quadrilateral & North-South / East-West Corridors) */}
        <g stroke="url(#nhGlow)" strokeWidth="2" strokeDasharray="6 4" filter="url(#glowEffect)">
          {/* Delhi (280, 160) to Mumbai (220, 360) - NH-48 */}
          <path d="M280 160 Q240 260 220 360" />
          {/* Mumbai (220, 360) to Bengaluru (290, 470) to Chennai (360, 480) - NH-48 */}
          <path d="M220 360 Q250 420 290 470 T360 480" />
          {/* Chennai (360, 480) to Visakhapatnam (440, 380) to Kolkata (520, 270) - NH-16 */}
          <path d="M360 480 Q400 420 440 380 T520 270" />
          {/* Kolkata (520, 270) to Varanasi (410, 220) to Agra (320, 180) to Delhi (280, 160) - NH-19 */}
          <path d="M520 270 Q450 230 410 220 T320 180 T280 160" />

          {/* North-South Corridor: Jammu (240, 80) -> Ludhiana (255, 120) -> Delhi (280, 160) -> Nagpur (340, 310) -> Hyderabad (330, 410) -> Kanyakumari (320, 560) - NH-44 */}
          <path d="M240 80 L255 120 L280 160 Q320 230 340 310 T330 410 T320 560" stroke="#F4A900" strokeWidth="2.5" />

          {/* East-West Corridor: Porbandar (140, 300) -> Ahmedabad (190, 310) -> Jhansi (330, 210) -> Silchar (680, 210) */}
          <path d="M140 300 L190 310 Q260 250 330 210 T680 210" stroke="#38BDF8" strokeWidth="1.5" />
        </g>

        {/* Secondary Feeder Corridors */}
        <g stroke="rgba(255, 255, 255, 0.25)" strokeWidth="1" strokeDasharray="3 3">
          <line x1="280" y1="160" x2="360" y2="130" /> {/* Delhi - Lucknow */}
          <line x1="360" y1="130" x2="410" y2="220" /> {/* Lucknow - Varanasi */}
          <line x1="340" y1="310" x2="220" y2="360" /> {/* Nagpur - Mumbai */}
          <line x1="340" y1="310" x2="520" y2="270" /> {/* Nagpur - Kolkata */}
          <line x1="330" y1="410" x2="360" y2="480" /> {/* Hyderabad - Chennai */}
        </g>

        {/* Major Node Pulse Hubs (Cities & Command Control Centers) */}
        {/* Delhi Command Center Hub */}
        <g transform="translate(280, 160)">
          <circle r="12" fill="#F4A900" fillOpacity="0.2" className="animate-ping" />
          <circle r="6" fill="#F4A900" />
          <text x="12" y="4" fill="#F4A900" fontSize="10" fontWeight="bold" fontFamily="sans-serif">DELHI HQ</text>
        </g>

        {/* Ludhiana / Kapurthala Hub */}
        <g transform="translate(255, 120)">
          <circle r="8" fill="#38BDF8" fillOpacity="0.3" className="animate-ping" />
          <circle r="4" fill="#38BDF8" />
          <text x="8" y="3" fill="#E0F2FE" fontSize="9" fontWeight="bold" fontFamily="sans-serif">PUNJAB ZONE</text>
        </g>

        {/* Mumbai Hub */}
        <g transform="translate(220, 360)">
          <circle r="10" fill="#38BDF8" fillOpacity="0.2" className="animate-ping" />
          <circle r="5" fill="#38BDF8" />
          <text x="10" y="4" fill="#E0F2FE" fontSize="9" fontWeight="bold" fontFamily="sans-serif">MUMBAI</text>
        </g>

        {/* Bengaluru Hub */}
        <g transform="translate(290, 470)">
          <circle r="10" fill="#34D399" fillOpacity="0.2" className="animate-ping" />
          <circle r="5" fill="#34D399" />
          <text x="10" y="4" fill="#D1FAE5" fontSize="9" fontWeight="bold" fontFamily="sans-serif">BENGALURU</text>
        </g>

        {/* Kolkata Hub */}
        <g transform="translate(520, 270)">
          <circle r="10" fill="#F4A900" fillOpacity="0.2" className="animate-ping" />
          <circle r="5" fill="#F4A900" />
          <text x="10" y="4" fill="#FEF3C7" fontSize="9" fontWeight="bold" fontFamily="sans-serif">KOLKATA</text>
        </g>

        {/* Nagpur Central Hub */}
        <g transform="translate(340, 310)">
          <circle r="8" fill="#60A5FA" fillOpacity="0.3" className="animate-ping" />
          <circle r="4" fill="#60A5FA" />
          <text x="8" y="3" fill="#DBEAFE" fontSize="9" fontStyle="italic" fontFamily="sans-serif">CENTRAL HUB</text>
        </g>

        {/* Floating Telemetry Signal Wave Vectors */}
        <path d="M 280 160 L 340 310" stroke="#FF9933" strokeWidth="2" strokeDasharray="8 12" opacity="0.9">
          <animate attributeName="stroke-dashoffset" from="40" to="0" dur="2s" repeatCount="indefinite" />
        </path>
        <path d="M 220 360 L 290 470" stroke="#38BDF8" strokeWidth="2" strokeDasharray="8 12" opacity="0.9">
          <animate attributeName="stroke-dashoffset" from="40" to="0" dur="2.5s" repeatCount="indefinite" />
        </path>
      </svg>
    </div>
  );
};

export default IndiaRoadNetworkVisualization;
