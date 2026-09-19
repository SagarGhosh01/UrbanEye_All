import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, Send, X, MessageSquare, AlertCircle, Phone, MapPin, 
  Sparkles, ShieldCheck, ChevronRight, HelpCircle, RefreshCw, Headset
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
  quickReplies?: { label: string; action: string }[];
}

export const RoadMitrChatbot: React.FC = () => {
  const { language, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const hindiStyle = { fontFamily: "'Noto Sans Devanagari', sans-serif" };

  const initialMessages: Message[] = [
    {
      id: 'msg-1',
      sender: 'bot',
      text: language === 'HI' 
        ? 'नमस्कार! मैं Road Mitr (सड़क मित्र) हूँ — भारत सरकार एवं NHAI का AI सड़क सहायता रोबोट। मैं आपकी क्या सहायता कर सकता हूँ?'
        : 'Namaste! I am Road Mitr — Official AI Road & Highway Infrastructure Assistant for Govt. of India / NHAI. How can I assist you today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      quickReplies: language === 'HI' ? [
        { label: '🚨 सड़क क्षति की रिपोर्ट करें', action: 'REPORT_DEFECT' },
        { label: '📞 हेल्पलाइन 1033 कनेक्ट करें', action: 'HELPLINE' },
        { label: '🗺️ राष्ट्रीय राजमार्ग स्थिति', action: 'ROAD_STATUS' },
        { label: '📋 शिकायत स्थिति देखें', action: 'TRACK_STATUS' },
      ] : [
        { label: '🚨 Report Pothole / Defect', action: 'REPORT_DEFECT' },
        { label: '📞 Emergency Helpline 1033', action: 'HELPLINE' },
        { label: '🗺️ Highway Road Health', action: 'ROAD_STATUS' },
        { label: '📋 Track Complaint Status', action: 'TRACK_STATUS' },
      ]
    }
  ];

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const generateBotReply = (userText: string, actionKey?: string): string => {
    const textLower = userText.toLowerCase();

    if (actionKey === 'REPORT_DEFECT' || textLower.includes('report') || textLower.includes('pothole') || textLower.includes('गड्ढा') || textLower.includes('रिर्पोट')) {
      return language === 'HI'
        ? 'सड़क क्षति रिपोर्ट दर्ज करने के लिए:\n1. ऊपरी मेनू में "नागरिक सेवा पोर्टल" पर क्लिक करें।\n2. अपनी फोटो/कैमरा सेंसर अपलोड करें।\n3. जीपीएस ऑटो-लोकेशन से स्थान दर्ज होगा और निकटतम एनएचएआई निरीक्षक को कार्य आदेश प्रेषित होगा।'
        : 'To report a road defect or pothole:\n1. Click "Citizen Portal" in the top navigation bar.\n2. Upload or stream live defect camera feed.\n3. Automatic GPS pinpointing assigns work orders to the nearest NHAI field inspector within 4 hours.';
    }

    if (actionKey === 'HELPLINE' || textLower.includes('1033') || textLower.includes('emergency') || textLower.includes('helpline') || textLower.includes('आपतकालीन')) {
      return language === 'HI'
        ? '🚨 राष्ट्रीय राजमार्ग 24x7 टोल-फ्री आपातकालीन हेल्पलाइन:\n📞 टोल फ्री कॉल: 1033\nदुर्घटना, एम्बुलेंस आवश्यकता या क्रेन सहायता के लिए 1033 पर तुरंत डायल करें।'
        : '🚨 National Highways Emergency Patrol Helpline:\n📞 Toll Free: 1033 (24x7 Active)\nCall 1033 for immediate highway ambulance dispatch, accident support, or vehicle towing assistance.';
    }

    if (actionKey === 'ROAD_STATUS' || textLower.includes('status') || textLower.includes('highway') || textLower.includes('राजमार्ग') || textLower.includes('स्वास्थ्य')) {
      return language === 'HI'
        ? '📊 SRIMS पोर्टल वर्तमान में 14,500+ किमी राष्ट्रीय राजमार्गों और शहरी गलियारों की 24x7 निरंतर निगरानी कर रहा है। औसत AI सटीकता दर 98.4% है।'
        : '📊 SRIMS Portal is actively monitoring 14,500+ KM of National Highways with 98.4% AI accuracy across 15 active state transit sectors.';
    }

    if (actionKey === 'TRACK_STATUS' || textLower.includes('track') || textLower.includes('complaint') || textLower.includes('स्थिति')) {
      return language === 'HI'
        ? 'अपनी शिकायत की स्थिति जाँचने के लिए अपनी शिकायत आईडी दर्ज करें (उदा. URB-2026-8891) या डैशबोर्ड के "मुद्दे एवं शिकायतें" टैब पर जाएं।'
        : 'To track complaint status, enter your Incident Reference ID (e.g. URB-2026-8891) or check the "Issues & Complaints" registry tab on the command dashboard.';
    }

    return language === 'HI'
      ? 'धन्यवाद! आपका संदेश SRIMS AI कंट्रोल सिस्टम में प्राप्त हुआ है। अधिक विवरण के लिए 1033 डायल करें या पोर्टल के विभिन्न मॉड्यूल का चयन करें।'
      : 'Thank you! Your query has been logged into SRIMS AI Surveillance System. For urgent assistance call Toll Free 1033 or select modules from the navigation bar.';
  };

  const handleSendMessage = (textToSend?: string, actionKey?: string) => {
    const text = (textToSend || input).trim();
    if (!text) return;

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const replyText = generateBotReply(text, actionKey);
      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickReplies: language === 'HI' ? [
          { label: '🚨 रिपोर्ट दर्ज करें', action: 'REPORT_DEFECT' },
          { label: '📞 1033 हेल्पलाइन', action: 'HELPLINE' }
        ] : [
          { label: '🚨 Report Defect', action: 'REPORT_DEFECT' },
          { label: '📞 Helpline 1033', action: 'HELPLINE' }
        ]
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 700);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      
      {/* 1. Floating Avatar Launcher Button (Exact match with user screenshot: "Road Mitr") */}
      {!isOpen && (
        <button
          onClick={() => setIsIsOpenTrue()}
          className="group relative flex flex-col items-center justify-center transition-all duration-300 transform hover:scale-105 active:scale-95 focus:outline-none"
          title="Open Road Mitr AI Assistant"
        >
          {/* Badge Halo Pulse Ring */}
          <div className="absolute -inset-1 bg-blue-500/30 rounded-full blur-sm group-hover:bg-blue-600/50 transition"></div>

          {/* Official Road Mitr Custom Shape Button */}
          <div className="relative bg-[#005F9E] text-white px-4 py-2.5 rounded-full shadow-2xl border-2 border-white flex flex-col items-center min-w-[110px]">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mb-1 text-white border border-white/30">
              <Headset className="w-6 h-6 text-white" />
            </div>
            <span className="text-sm font-black tracking-wide leading-none text-white font-sans">
              Road Mitr
            </span>
            <span className="text-[9px] text-amber-300 font-bold mt-0.5" style={hindiStyle}>
              सड़क मित्र (AI 24x7)
            </span>
          </div>
        </button>
      )}

      {/* Helper function toggle setter */}
      {/* 2. Interactive Chat Modal Window */}
      {isOpen && (
        <div className="w-[360px] sm:w-[400px] h-[520px] bg-white rounded-2xl shadow-2xl border border-blue-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          
          {/* Header */}
          <div className="bg-[#002244] text-white px-4 py-3 border-b border-amber-500/40 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-full bg-[#005F9E] border border-amber-400 text-white flex items-center justify-center shrink-0 shadow-inner">
                <Headset className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <h3 className="text-sm font-black text-white tracking-wide">Road Mitr</h3>
                  <span className="bg-emerald-500 w-2 h-2 rounded-full animate-pulse"></span>
                  <span className="text-[10px] bg-emerald-900/80 text-emerald-200 px-1.5 py-0.2 rounded font-mono">ONLINE</span>
                </div>
                <p className="text-[10px] text-gray-300" style={hindiStyle}>
                  सड़क मित्र | Govt. AI Virtual Assistant
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={() => setMessages(initialMessages)}
                className="p-1.5 text-gray-300 hover:text-amber-400 hover:bg-white/10 rounded transition"
                title="Reset Chat"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded transition"
                title="Close Chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-2xl shadow-xs whitespace-pre-wrap leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-[#003366] text-white rounded-br-none font-medium'
                      : 'bg-white text-gray-800 border border-slate-200 rounded-bl-none shadow-sm'
                  }`}
                >
                  {msg.text}
                </div>
                
                <span className="text-[9px] text-gray-400 mt-1 px-1">
                  {msg.timestamp}
                </span>

                {/* Quick Reply Actions */}
                {msg.quickReplies && (
                  <div className="flex flex-wrap gap-1.5 mt-2 max-w-[90%]">
                    {msg.quickReplies.map((qr, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(qr.label, qr.action)}
                        className="text-[11px] bg-blue-50 hover:bg-blue-100 text-[#003366] border border-blue-200 px-2.5 py-1 rounded-full font-semibold transition"
                      >
                        {qr.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex items-center space-x-1.5 bg-white border border-slate-200 p-2.5 rounded-2xl rounded-bl-none max-w-[100px]">
                <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Helper Pill Strip */}
          <div className="bg-slate-100 border-t border-slate-200 px-3 py-1.5 flex items-center space-x-2 overflow-x-auto text-[10px]">
            <button
              onClick={() => handleSendMessage('1033', 'HELPLINE')}
              className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold flex items-center space-x-1 shrink-0 border border-red-200"
            >
              <Phone className="w-3 h-3" />
              <span>Call 1033</span>
            </button>
            <button
              onClick={() => handleSendMessage('Report defect', 'REPORT_DEFECT')}
              className="bg-blue-100 text-[#003366] px-2 py-0.5 rounded-full font-bold flex items-center space-x-1 shrink-0 border border-blue-200"
            >
              <AlertCircle className="w-3 h-3" />
              <span>Report Defect</span>
            </button>
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white border-t border-slate-200 flex items-center space-x-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={language === 'HI' ? 'सड़क मित्र से प्रश्न पूछें...' : 'Ask Road Mitr anything...'}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#003366]"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="p-2 bg-[#003366] hover:bg-[#002244] disabled:opacity-50 text-white rounded-xl transition shadow-sm"
              title="Send Message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

        </div>
      )}

    </div>
  );

  function setIsIsOpenTrue() {
    setIsOpen(true);
  }
};

export default RoadMitrChatbot;
