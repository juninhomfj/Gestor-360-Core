
import React, { useState } from 'react';
import { Send, Image as ImageIcon, Link as LinkIcon, Gift, Rocket, Info, Sparkles, X, CheckCircle, Bell, Loader2 } from 'lucide-react';
import { User, InternalMessage } from '../types';
import { sendMessage } from '../services/internalChat';
import { sendPushNotification } from '../services/pushService';

interface AdminMessagingProps {
    currentUser: User;
    darkMode: boolean;
}

const TEMPLATES = [
    { id: 'welcome', label: 'Boas-vindas', icon: <Sparkles size={16}/>, content: 'Seja bem-vindo ao Gestor360! 🚀\nEstamos felizes em ter você conosco. Explore os módulos de vendas e finanças para otimizar sua rotina.', image: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJndXIzcHgzeHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/l0MYC0LajbaPoEADu/giphy.gif' },
    { id: 'update', label: 'Nova Versão', icon: <Rocket size={16}/>, content: 'Novidades no Ar! 🛠️\nAcabamos de liberar a v2.5.2 com melhorias no módulo financeiro e notificações push mais rápidas.', image: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3B4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7TKMGpxfO0P5D7mE/giphy.gif' },
    { id: 'tip', label: 'Dica do Dia', icon: <Info size={16}/>, content: 'Você sabia? 💡\nVocê pode unificar clientes duplicados na aba Configurações > Gestão de Clientes para limpar seus relatórios.', image: '' }
];

const AdminMessaging: React.FC<AdminMessagingProps> = ({ currentUser, darkMode }) => {
    const [message, setMessage] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    const handleApplyTemplate = (t: any) => {
        setMessage(t.content);
        setImageUrl(t.image);
    };

    const handleBroadcast = async () => {
        if (!message.trim()) return;
        setIsSending(true);
        setStatus("Sincronizando com a Nuvem...");

        try {
            // 1. Envia Broadcast no Chat Interno
            await sendMessage(currentUser, message, 'BROADCAST', 'BROADCAST', imageUrl);

            // 2. Dispara Push Geral (Simulado para todos que possuem token)
            await sendPushNotification('ADMIN_GROUP', '📢 Comunicado Gestor360', message.substring(0, 100));

            setStatus("Mensagem enviada com sucesso!");
            setTimeout(() => setStatus(null), 3000);
            setMessage('');
            setImageUrl('');
        } catch (e) {
            setStatus("Erro ao disparar mensagens.");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className={`p-6 rounded-2xl border shadow-xl ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-xl">
                    <Bell size={24}/>
                </div>
                <div>
                    <h3 className="text-xl font-black">Central de Comunicados</h3>
                    <p className="text-xs text-gray-500">Mantenha os usuários atualizados com estilo.</p>
                </div>
            </div>

            <div className="space-y-6">
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Modelos Rápidos</label>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {TEMPLATES.map(t => (
                            <button key={t.id} onClick={() => handleApplyTemplate(t)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 border dark:border-slate-700 hover:border-indigo-500 transition-all whitespace-nowrap text-sm font-bold">
                                {t.icon} {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Corpo do Comunicado (Markdown)</label>
                        <textarea 
                            className={`w-full p-4 rounded-xl border outline-none focus:ring-2 ring-indigo-500 h-32 resize-none ${darkMode ? 'bg-black/40 border-slate-700 text-white' : 'bg-gray-50 border-gray-200'}`}
                            placeholder="Escreva sua mensagem aqui..."
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">URL da Imagem ou GIF</label>
                        <div className="relative">
                            <ImageIcon className="absolute left-3 top-3 text-gray-500" size={18}/>
                            <input 
                                className={`w-full pl-10 pr-4 py-3 rounded-xl border outline-none focus:ring-2 ring-indigo-500 ${darkMode ? 'bg-black/40 border-slate-700 text-white' : 'bg-gray-50 border-gray-200'}`}
                                placeholder="https://..."
                                value={imageUrl}
                                onChange={e => setImageUrl(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {imageUrl && (
                    <div className="rounded-xl overflow-hidden border border-indigo-500/30 max-h-40 bg-black">
                        <img src={imageUrl} alt="Preview" className="w-full h-full object-contain" />
                    </div>
                )}

                <div className="pt-4 flex items-center justify-between">
                    <div className="text-xs font-bold text-indigo-500">
                        {status && <span className="flex items-center gap-2 animate-pulse"><CheckCircle size={14}/> {status}</span>}
                    </div>
                    <button 
                        onClick={handleBroadcast}
                        disabled={isSending || !message.trim()}
                        className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3 uppercase text-xs tracking-widest"
                    >
                        {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18}/>}
                        Disparar para Todos
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminMessaging;
