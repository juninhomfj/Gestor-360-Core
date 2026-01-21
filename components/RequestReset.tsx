
import React, { useState } from 'react';
import { Mail, ArrowLeft, Send, Sparkles, AlertCircle } from 'lucide-react';
import { requestPasswordReset } from '../services/auth';
import Logo from './Logo';

interface RequestResetProps {
  onBack: () => void;
}

const RequestReset: React.FC<RequestResetProps> = ({ onBack }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) {
        setMessage({ type: 'error', text: 'Insira um e-mail válido.' });
        return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
        await requestPasswordReset(email);
        setMessage({ type: 'success', text: 'Se este e-mail estiver cadastrado, você receberá instruções de redefinição em instantes.' });
    } catch (err: any) {
        setMessage({ type: 'error', text: 'Erro ao processar solicitação.' });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 animate-in fade-in">
        <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-[2rem] p-8 shadow-2xl">
            <div className="text-center mb-8">
                <Logo size="lg" variant="full" lightMode />
                <h2 className="text-xl font-bold text-white mt-6">Recuperar Senha</h2>
                <p className="text-slate-400 text-sm mt-2">Insira seu e-mail para receber o link de redefinição.</p>
            </div>

            {message && (
                <div className={`p-4 rounded-xl text-xs flex items-center gap-3 mb-6 animate-in fade-in ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-200' : 'bg-red-500/10 border border-red-500/20 text-red-200'}`}>
                    {message.type === 'success' ? <Sparkles size={16}/> : <AlertCircle size={16}/>}
                    <span className="font-medium">{message.text}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">E-mail Cadastrado</label>
                    <div className="relative">
                        <Mail className="absolute left-4 top-3.5 text-slate-500" size={18} />
                        <input 
                            type="email"
                            required
                            value={email}
                            onChange={e = /> setEmail(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 bg-black/20 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all text-sm"
                            placeholder="seu@email.com"
                        />
                    </div>
                </div>

                <button 
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 disabled:opacity-50"
                >
                    {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Send size={18}/>}
                    Enviar Link de Recuperação
                </button>

                <button 
                    type="button"
                    onClick={onBack}
                    className="w-full text-sm font-bold text-slate-400 hover:text-white flex items-center justify-center gap-2 transition-colors"
                >
                    <ArrowLeft size={16}/> Voltar ao Login
                </button>
            </form>
        </div>
    </div>
  );
};

export default RequestReset;
