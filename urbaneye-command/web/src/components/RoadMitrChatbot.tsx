import React, { useState, useRef, useEffect } from 'react';
import { Headset, Send, X, Phone, AlertCircle, RefreshCw, Globe, Check, Copy } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
  quickReplies?: { label: string; action: string }[];
}

export const RoadMitrChatbot: React.FC = () => {
  const { language, toggleLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const hindiStyle = { fontFamily: "'Noto Sans Devanagari', sans-serif" };

  const getInitialMessages = (lang: string): Message[] => [
    {
      id: 'msg-welcome',
      sender: 'bot',
      text: lang === 'HI'
        ? 'नमस्कार! मैं Road Mitr (सड़क मित्र) हूँ — NHAI का AI सहायक। मैं आपकी सहायता कैसे कर सकता हूँ?'
        : 'Namaste! I am Road Mitr — NHAI AI Assistant. How can I assist you today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      quickReplies: lang === 'HI' ? [
        { label: '🚨 रिपोर्ट दर्ज करें', action: 'REPORT_DEFECT' },
        { label: '📞 हेल्पलाइन 1033', action: 'HELPLINE' },
        { label: '📋 शिकायत स्थिति', action: 'TRACK_STATUS' },
      ] : [
        { label: '🚨 Report Defect', action: 'REPORT_DEFECT' },
        { label: '📞 Helpline 1033', action: 'HELPLINE' },
        { label: '📋 Track Status', action: 'TRACK_STATUS' },
      ]
    }
  ];

  const [messages, setMessages] = useState<Message[]>(() => getInitialMessages(language));
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isTyping]);

  const generateBotReply = (userText: string, actionKey?: string): string => {
    const textLower = userText.toLowerCase();

    if (actionKey === 'REPORT_DEFECT' || textLower.includes('report') || textLower.includes('pothole') || textLower.includes('गड्ढा') || textLower.includes('रिर्पोट')) {
      return language === 'HI'
        ? 'सड़क क्षति रिपोर्ट करने के लिए ऊपरी मेनू में "Citizen Reporter" पर जाएँ या फोटो अपलोड करें। GPS स्थान दर्ज कर निकटतम अधिकारी को सूचित किया जाएगा।'
        : 'To report a road defect or pothole, click "Citizen Reporter" in the top menu or upload a image. GPS location auto-assigns field inspectors.';
    }

    if (actionKey === 'HELPLINE' || textLower.includes('1033') || textLower.includes('emergency') || textLower.includes('helpline') || textLower.includes('आपातकाल')) {
      return language === 'HI'
        ? '📞 राष्ट्रीय राजमार्ग टोल-फ्री हेल्पलाइन: 1033 (24x7)। दुर्घटना या क्रेन सहायता के लिए डायल करें।'
        : '📞 National Highway Toll-Free Helpline: 1033 (24x7 Active). Call for accident or towing emergency.';
    }

    if (actionKey === 'TRACK_STATUS' || textLower.includes('track') || textLower.includes('complaint') || textLower.includes('स्थिति')) {
      return language === 'HI'
        ? 'शिकायत की स्थिति के लिए अपनी रेफरेंस आईडी दर्ज करें (उदा. URB-2026-9481) या डैशबोर्ड तालिका देखें।'
        : 'To track your complaint, enter your Reference ID (e.g. URB-2026-9481) or check the Defects Table on the dashboard.';
    }

    return language === 'HI'
      ? `आपका संदेश "${userText}" प्राप्त हुआ। त्वरित सहायता के लिए 1033 डायल करें।`
      : `Thank you for your message regarding "${userText}". For urgent help call Toll Free 1033.`;
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
      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: generateBotReply(text, actionKey),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickReplies: language === 'HI' ? [
          { label: '🚨 रिपोर्ट दर्ज करें', action: 'REPORT_DEFECT' },
          { label: '📞 हेल्पलाइन 1033', action: 'HELPLINE' }
        ] : [
          { label: '🚨 Report Defect', action: 'REPORT_DEFECT' },
          { label: '📞 Helpline 1033', action: 'HELPLINE' }
        ]
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 500);
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 font-sans select-none">
      
      {/* 1. CLEAN, SMALL & NORMAL FLOATING LAUNCHER BUTTON */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center space-x-2 bg-[#005F9E] hover:bg-[#004C8C] text-white px-3.5 py-2.5 rounded-full shadow-lg border border-white/30 transition-all duration-200 transform hover:scale-105 active:scale-95 cursor-pointer"
          title="Open Road Mitr Assistant"
        >
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Headset className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col text-left pr-1">
            <span className="text-xs font-bold leading-tight">Road Mitr</span>
            <span className="text-[10px] text-amber-300 font-semibold leading-none mt-0.5" style={hindiStyle}>
              सड़क मित्र (24x7)
            </span>
          </div>
        </button>
      )}

      {/* 2. CLEAN & NORMAL CHAT WINDOW */}
      {isOpen && (
        <div className="w-[330px] sm:w-[350px] h-[450px] sm:h-[470px] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          
          {/* Header */}
          <div className="bg-[#003366] text-white px-3.5 py-2.5 flex items-center justify-between shadow-sm">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0">
                <Headset className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <h3 className="text-xs font-bold tracking-wide">Road Mitr</h3>
                  <span className="text-[9px] bg-emerald-500/30 text-emerald-200 px-1.5 py-0.2 rounded font-mono">24x7 AI</span>
                </div>
                <p className="text-[10px] text-gray-300" style={hindiStyle}>सड़क मित्र</p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={toggleLanguage}
                className="px-1.5 py-0.5 bg-white/10 hover:bg-white/20 text-amber-300 rounded text-[10px] font-bold transition flex items-center space-x-1"
                title="Switch Language"
              >
                <Globe className="w-3 h-3" />
                <span>{language === 'EN' ? 'HI' : 'EN'}</span>
              </button>
              <button
                onClick={() => setMessages(getInitialMessages(language))}
                className="p-1 text-gray-300 hover:text-amber-300 rounded transition"
                title="Reset Chat"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-300 hover:text-white rounded transition"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat Messages Feed */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-slate-50 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] p-2.5 rounded-xl leading-normal text-xs ${
                    msg.sender === 'user'
                      ? 'bg-[#003366] text-white rounded-br-none font-medium'
                      : 'bg-white text-gray-800 border border-slate-200 rounded-bl-none shadow-2xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>

                <div className="flex items-center space-x-1 px-1 mt-0.5 text-[9px] text-gray-400">
                  <span>{msg.timestamp}</span>
                  {msg.sender === 'bot' && (
                    <button
                      onClick={() => handleCopyText(msg.id, msg.text)}
                      className="hover:text-gray-600 transition"
                      title="Copy text"
                    >
                      {copiedId === msg.id ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
                    </button>
                  )}
                </div>

                {/* Quick Reply Chips */}
                {msg.quickReplies && (
                  <div className="flex flex-wrap gap-1.5 mt-2 max-w-[95%]">
                    {msg.quickReplies.map((qr, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(qr.label, qr.action)}
                        className="text-[10px] bg-white hover:bg-blue-50 text-[#003366] border border-blue-200 px-2 py-1 rounded-md font-semibold transition shadow-2xs"
                      >
                        {qr.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Typing Dots */}
            {isTyping && (
              <div className="flex items-center space-x-1 bg-white border border-slate-200 p-2 rounded-xl rounded-bl-none max-w-[70px]">
                <span className="w-1.5 h-1.5 bg-[#003366] rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-[#003366] rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 bg-[#003366] rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Helper Pills */}
          <div className="bg-slate-100 border-t border-slate-200 px-2.5 py-1.5 flex items-center space-x-1.5 text-[10px] overflow-x-auto no-scrollbar">
            <button
              onClick={() => handleSendMessage('1033', 'HELPLINE')}
              className="bg-red-50 hover:bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold border border-red-200 flex items-center space-x-1 shrink-0"
            >
              <Phone className="w-3 h-3 text-red-600" />
              <span>Call 1033</span>
            </button>
            <button
              onClick={() => handleSendMessage('Report defect', 'REPORT_DEFECT')}
              className="bg-blue-50 hover:bg-blue-100 text-[#003366] px-2 py-0.5 rounded font-bold border border-blue-200 flex items-center space-x-1 shrink-0"
            >
              <AlertCircle className="w-3 h-3 text-[#003366]" />
              <span>Report Defect</span>
            </button>
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-2 bg-white border-t border-slate-200 flex items-center space-x-1.5"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={language === 'HI' ? 'सड़क मित्र से पूछें...' : 'Ask Road Mitr...'}
              className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#003366]"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="p-1.5 bg-[#003366] hover:bg-[#002244] disabled:opacity-40 text-white rounded-lg transition"
              title="Send"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

        </div>
      )}

    </div>
  );
};

export default RoadMitrChatbot;
