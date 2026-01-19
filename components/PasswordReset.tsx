
import React, { useState } from 'react';
import { Lock, CheckCircle, AlertTriangle } from 'lucide-react';
import { changePassword } from '../services/auth';
import Logo from './Logo';

interface PasswordResetProps {
  onSuccess: () => void;
  userId: string;
}

const PasswordReset: React.FC<PasswordResetProps> = ({ onSuccess, userId }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
        setError("A senha deve ter no mínimo 6 caracteres.");
        return;
    }
    if (password !== confirm) {
        setError("As senhas não conferem.");
        return;
    }

    setLoading(true);
    try {
        await changePassword(userId, password);
        onSuccess();
    } catch (e: any) {
        setError("Erro ao salvar senha. Tente novamente.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 animate-in fade-in">
        <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-8 border border-slate-700 dark:text-slate-100">
            <div className="text-center mb-8">
                <Logo size="xl" variant="full" lightMode />
                <h2 className="text-xl font-bold text-white mt-6">Definir Senha de Acesso</h2>
                <p className="text-slate-400 text-sm mt-2">Crie uma senha segura para entrar no sistema.</p>
            </div>

            {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-3 rounded-lg mb-6 flex items-center gap-2 text-sm">
                    <AlertTriangle size={16}/> {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Nova Senha</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3 text-slate-500" size={18} />
                        <input 
                            type="password" 
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg py-3 pl-10 text-white focus:border-emerald-500 outline-none transition-colors"
                            placeholder="Mínimo 6 caracteres"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Confirmar Senha</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3 text-slate-500" size={18} />
                        <input 
                            type="password" 
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg py-3 pl-10 text-white focus:border-emerald-500 outline-none transition-colors"
                            placeholder="Repita a senha"
                            value={confirm}
                            onChange={e => setConfirm(e.target.value)}
                        />
                    </div>
                </div>

                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 mt-4"
                >
                    {loading ? <span className="animate-spin">⏳</span> : <CheckCircle size={20}/>}
                    Salvar e Entrar
                </button>
            </form>
        </div>
    </div>
  );
};

export default PasswordReset;
