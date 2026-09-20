import React, { useState } from 'react';
import { Lock, Mail, AlertCircle, Loader2, ArrowLeft, Eye, EyeOff, KeyRound, Shield, Users } from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types';

interface LoginProps {
  onLoginSuccess: (user: User, token: string) => void;
  onBack?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, onBack }) => {
  const [email, setEmail] = useState('head.kapurthala@srims.gov.in');
  const [password, setPassword] = useState('SRIMS@2026');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loginRole, setLoginRole] = useState<'ADMIN' | 'INSPECTOR' | 'PUBLIC'>('ADMIN');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(email.trim(), password);
      localStorage.setItem('srims_token', res.token);
      onLoginSuccess(res.user, res.token);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please verify login details.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoAccess = (demoEmail: string, roleType: 'ADMIN' | 'INSPECTOR' | 'PUBLIC') => {
    setEmail(demoEmail);
    setPassword('SRIMS@2026');
    setLoginRole(roleType);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#F6F8FA] text-[#172B3A] flex flex-col justify-between font-sans">
      
      {/* Top Header Strip */}
      <div className="bg-[#08243D] text-white py-2 px-4 md:px-8 flex justify-between items-center border-b border-[#F2A900]/40">
        <div className="flex items-center space-x-2 text-xs">
          <span className="font-semibold text-gray-200">SRIMS | Public Infrastructure Intelligence</span>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="text-xs text-gray-300 hover:text-white flex items-center space-x-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Main Platform</span>
          </button>
        )}
      </div>

      {/* Main Centered Login Box */}
      <div className="flex-1 flex items-center justify-center p-4 my-8">
        <div className="w-full max-w-md bg-white rounded-lg border border-[#D8E0E8] shadow-md overflow-hidden">
          
          {/* Card Title Banner */}
          <div className="bg-[#0B3558] text-white p-6 text-center border-b border-[#F2A900]">
            <div className="w-10 h-10 rounded-lg bg-white/10 text-white flex items-center justify-center mx-auto mb-2 border border-white/20">
              <Eye className="w-5 h-5 text-[#F2A900]" />
            </div>

            <h1 className="text-xl font-black tracking-tight uppercase">SRIMS</h1>
            <p className="text-xs text-gray-200 mt-0.5">Road Infrastructure Intelligence Platform</p>
          </div>

          {/* Role Selector */}
          <div className="grid grid-cols-3 bg-[#EAF4FB] border-b border-[#D8E0E8] text-xs font-bold text-center">
            <button
              type="button"
              onClick={() => handleDemoAccess('head.kapurthala@srims.gov.in', 'ADMIN')}
              className={`py-2.5 border-b-2 transition ${loginRole === 'ADMIN' ? 'border-[#0B3558] text-[#0B3558] bg-white' : 'border-transparent text-[#667788]'}`}
            >
              Administrator
            </button>
            <button
              type="button"
              onClick={() => handleDemoAccess('inspector.rajesh@nhai.gov.in', 'INSPECTOR')}
              className={`py-2.5 border-b-2 transition ${loginRole === 'INSPECTOR' ? 'border-[#0B3558] text-[#0B3558] bg-white' : 'border-transparent text-[#667788]'}`}
            >
              Field Inspector
            </button>
            <button
              type="button"
              onClick={() => handleDemoAccess('citizen@srims.gov.in', 'PUBLIC')}
              className={`py-2.5 border-b-2 transition ${loginRole === 'PUBLIC' ? 'border-[#0B3558] text-[#0B3558] bg-white' : 'border-transparent text-[#667788]'}`}
            >
              Public / Citizen
            </button>
          </div>

          <div className="p-6 space-y-4">

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-[#C62828] rounded text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#172B3A] uppercase tracking-wider mb-1">
                  Email / Username
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#667788] absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@srims.platform"
                    className="w-full pl-9 pr-3 py-2 border border-[#D8E0E8] rounded text-sm text-[#172B3A] bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172B3A] uppercase tracking-wider mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#667788] absolute left-3 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-9 py-2 border border-[#D8E0E8] rounded text-sm text-[#172B3A] bg-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-[#667788] hover:text-[#172B3A]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <a href="#forgot" onClick={(e) => e.preventDefault()} className="text-xs text-[#1769AA] hover:underline">
                  Forgot Password?
                </a>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-[#0B3558] hover:bg-[#08243D] text-white font-bold text-xs rounded transition flex items-center justify-center space-x-2 uppercase tracking-wider shadow-xs"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4 text-[#F2A900]" />
                    <span>Sign In</span>
                  </>
                )}
              </button>
            </form>

            {/* Clearly Labeled Demo Access Section */}
            <div className="pt-3 border-t border-[#D8E0E8] space-y-2">
              <div className="text-[10px] font-bold text-[#667788] uppercase tracking-wider text-center">
                Demonstration Accounts
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleDemoAccess('head.kapurthala@srims.gov.in', 'ADMIN')}
                  className="py-1.5 px-2 bg-[#EAF4FB] border border-[#D8E0E8] rounded text-[10px] font-bold text-[#1769AA] hover:bg-blue-100 truncate"
                >
                  Demo Administrator
                </button>
                <button
                  type="button"
                  onClick={() => handleDemoAccess('inspector.rajesh@nhai.gov.in', 'INSPECTOR')}
                  className="py-1.5 px-2 bg-[#EAF4FB] border border-[#D8E0E8] rounded text-[10px] font-bold text-[#1769AA] hover:bg-blue-100 truncate"
                >
                  Demo Inspector
                </button>
                <button
                  type="button"
                  onClick={() => handleDemoAccess('citizen@srims.gov.in', 'PUBLIC')}
                  className="py-1.5 px-2 bg-[#EAF4FB] border border-[#D8E0E8] rounded text-[10px] font-bold text-[#1769AA] hover:bg-blue-100 truncate"
                >
                  Demo Citizen
                </button>
              </div>
            </div>

            <div className="text-[10px] text-[#667788] text-center pt-2">
              Authorized access only.
            </div>

          </div>

        </div>
      </div>

      {/* Footer strip */}
      <div className="bg-[#08243D] text-gray-300 text-[11px] py-2 px-4 text-center border-t border-[#F2A900]">
        SRIMS — Public Infrastructure Technology Prototype | © 2026 SRIMS
      </div>

    </div>
  );
};

export default Login;
