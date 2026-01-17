import React, { useState } from 'react';
import { User } from '../types';
import { login } from '../services/auth';
import { Lock, Mail, AlertCircle, ArrowRight, Heart, KeyRound } from 'lucide-react';
import ShieldCheckIcon from './icons/ShieldCheckIcon';
import Logo from './Logo';
import BrazilFlag from './BrazilFlag';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
  onRequestReset: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onRequestReset }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!identifier || !password) {
        setError('Por favor, informe suas credenciais de acesso.');
        return;
    }

    setIsLoading(true);
    try {
        const { user, error: authError } = await login(identifier, password);
        if (user) {
            onLoginSuccess(user);
        } else {
            setError(authError || 'Falha na autenticação. Verifique seus dados.');
            setIsLoading(false);
        }
    } catch (e: any) {
        setError('Ocorreu um erro ao conectar com a plataforma cloud.');
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-[#020617] p-4 md:p-8 font-sans text-slate-200">
        
        {/* Background Gradients (Professional SaaS look) */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
        </div>

        <div className="w-full max-w-[420px] z-10 animate-in fade-in zoom-in duration-500">
            {/* Branding Header */}
            <div className="flex flex-col items-center mb-10">
                <div className="bg-white/5 p-4 rounded-3xl border border-white/10 shadow-2xl mb-4">
                    <Logo size="lg" variant="icon" />
                </div>
                <h1 className="text-3xl font-black text-white tracking-tighter">Gestor<span className="text-blue-500">360</span></h1>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em] mt-2">Plataforma de Inteligência Comercial</p>
            </div>

            {/* Professional Login Card */}
            <div className="bg-slate-900/50 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 md:p-10 shadow-2xl ring-1 ring-white/5">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                        <ShieldCheckIcon size={20} />
                    </div>
                    <h2 className="text-xl font-bold text-white">Login de Usuário</h2>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl text-xs flex items-center gap-3 mb-6 animate-in slide-in-from-top-2">
                        <AlertCircle size={18} className="shrink-0" /> 
                        <span className="font-semibold leading-relaxed">{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail Corporativo</label>
                        <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                            <input 
                                type="email"
                                value={identifier}
                                onChange={e => setIdentifier(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-slate-950/50 border border-white/5 rounded-2xl text-white outline-none focus:border-blue-500/50 focus:ring-4 ring-blue-500/5 transition-all text-sm font-medium"
                                placeholder="nome@empresa.com"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center ml-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Senha de Acesso</label>
                            <button 
                                type="button"
                                onClick={onRequestReset}
                                className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-widest"
                            >
                                Recuperar
                            </button>
                        </div>
                        <div className="relative group">
                            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                            <input 
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-slate-950/50 border border-white/5 rounded-2xl text-white outline-none focus:border-blue-500/50 focus:ring-4 ring-blue-500/5 transition-all text-sm font-medium"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button 
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-70 shadow-xl shadow-blue-900/20 border border-blue-400/20 mt-4 group"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>Acessar Plataforma <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
                        )}
                    </button>
                </form>

                <div className="mt-8 pt-8 border-t border-white/5 flex justify-between items-center">
                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Build v2.5.3 Stable</span>
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Sistemas OK</span>
                    </div>
                </div>
            </div>

            {/* Support Info */}
            <div className="mt-10 flex flex-col items-center gap-6">
                <BrazilFlag className="opacity-80 hover:opacity-100 transition-opacity" showSoundToggle={false} />
                
                <div className="text-center space-y-1">
                    <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">
                        <span>Powered by</span>
                        <Heart size={10} className="text-red-600/50 fill-red-600/50" />
                        <span><strong>Hypelab Engineering</strong></span>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default Login;