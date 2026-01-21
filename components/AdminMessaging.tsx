
import React, { useEffect, useMemo, useState } from 'react';
import { Send, Image as ImageIcon, Link as LinkIcon, Gift, Rocket, Info, Sparkles, X, CheckCircle, Bell, Loader2 } from 'lucide-react';
import { User, InternalMessage } from '../types';
import { sendMessage } from '../services/internalChat';
import { sendPushNotification } from '../services/pushService';
import { listUsers } from '../services/auth';

interface AdminMessagingProps {
    currentUser: User;
    darkMode: boolean;
}

const TEMPLATES = [
    {
        id: 'welcome',
        label: 'Boas-vindas',
        icon: <Sparkles size={16} />,
        content: `Seja bem-vindo ao Gestor360.
Explore os modulos de vendas e financas para otimizar sua rotina.`,
        image: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJndXIzcHgzeHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/l0MYC0LajbaPoEADu/giphy.gif'
    },
    {
        id: 'update',
        label: 'Nova versao',
        icon: <Rocket size={16} />,
        content: `Novidades no ar.
Acabamos de liberar uma versao com melhorias no financeiro e notificacoes mais rapidas.`,
        image: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3B4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7TKMGpxfO0P5D7mE/giphy.gif'
    },
    {
        id: 'tip',
        label: 'Dica do dia',
        icon: <Info size={16} />,
        content: `Dica rapida.
Unifique clientes duplicados em Configuracoes > Gestao de Clientes para limpar seus relatorios.`,
        image: ''
    }
];

const PERMISSION_GROUPS = [
    { key: 'sales', label: 'Vendas' },
    { key: 'finance', label: 'Financas' },
    { key: 'settings', label: 'Configuracoes' },
    { key: 'chat', label: 'Chat' },
    { key: 'logs', label: 'Logs' },
    { key: 'dev', label: 'Dev' }
];


const AdminMessaging: React.FC<AdminMessagingProps> = ({ currentUser, darkMode }) => {
    const [message, setMessage] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [searchUsers, setSearchUsers] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<User['role'][]>([]);
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
    const [newOnly, setNewOnly] = useState(false);
    const [newDays, setNewDays] = useState(7);
    const [useChat, setUseChat] = useState(true);
    const [useEmail, setUseEmail] = useState(false);
    const emailEnabled = false;
    const parseNumericInput = (value: string, fallback = 0) => (value === '' ? fallback : Number(value));

    useEffect(() => {
        setIsLoadingUsers(true);
        listUsers()
            .then(setUsers)
            .catch(() => setUsers([]))
            .finally(() => setIsLoadingUsers(false));
    }, []);

    const filteredUsers = useMemo(() => {
        const term = searchUsers.trim().toLowerCase();
        const cutoff = Date.now() - newDays * 24 * 60 * 60 * 1000;
        return users.filter((u) => {
            if (term) {
                const blob = `${u.name || ''} ${u.email || ''} ${u.username || ''}`.toLowerCase();
                if (!blob.includes(term)) return false;
            }
            if (selectedRoles.length && !selectedRoles.includes(u.role)) return false;
            if (selectedPermissions.length) {
                const hasAny = selectedPermissions.some((key) => (u.permissions as any)?.[key]);
                if (!hasAny) return false;
            }
            if (newOnly) {
                const createdAt = Date.parse(u.createdAt || '');
                if (!Number.isFinite(createdAt)) return false;
                if (createdAt < cutoff) return false;
            }
            return true;
        });
    }, [users, searchUsers, selectedRoles, selectedPermissions, newOnly, newDays]);

    const resolvedRecipients = useMemo(() => {
        if (selectedUserIds.length) {
            return users.filter((u) => selectedUserIds.includes(u.id));
        }
        if (selectedRoles.length || selectedPermissions.length || newOnly || searchUsers.trim()) {
            return filteredUsers;
        }
        return [];
    }, [users, selectedUserIds, selectedRoles, selectedPermissions, newOnly, searchUsers, filteredUsers]);

    const handleApplyTemplate = (t: any) => {
        setMessage(t.content);
        setImageUrl(t.image);
    };

    const handleBroadcast = async () => {
        if (!message.trim()) return;
        setIsSending(true);
        setStatus("Sincronizando com a Nuvem...");

        try {
            if (!useChat && !useEmail) {
                setStatus("Selecione um canal para envio.");
                setIsSending(false);
                return;
            }

            const hasTargeting = resolvedRecipients.length > 0;
            if (useChat) {
                if (hasTargeting) {
                    await Promise.all(
                        resolvedRecipients.map((recipient) =>
                            sendMessage(currentUser, message, 'BROADCAST', recipient.id, imageUrl)
                        )
                    );
                } else {
                    await sendMessage(currentUser, message, 'BROADCAST', 'BROADCAST', imageUrl);
                }
            }

            if (useEmail) {
                if (!emailEnabled) {
                    setStatus("Email nao configurado. Informe o provedor para ativar.");
                } else {
                    // Placeholder: email provider integration
                }
            }

            await sendPushNotification('ADMIN_GROUP', 'Comunicado Gestor360', message.substring(0, 100));

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
                    <p className="text-xs text-gray-500">Mantenha os usuarios atualizados com estilo.</p>
                </div>
            </div>

            <div className="space-y-6">
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Modelos Rapidos</label>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {TEMPLATES.map(t => (
                            <button key={t.id} onClick={() => handleApplyTemplate(t)} className="flex items-center gap-2 px-4 py-2 rounded-xl border transition-all whitespace-nowrap text-sm font-bold btn-soft">
                                {t.icon} {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border field-contrast space-y-3">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Canais</label>
                        <label className="flex items-center gap-2 text-xs font-bold">
                            <input type="checkbox" checked={useChat} onChange={(e) => setUseChat(e.target.checked)} />
                            Chat interno
                        </label>
                        <label className="flex items-center gap-2 text-xs font-bold">
                            <input type="checkbox" checked={useEmail} onChange={(e) => setUseEmail(e.target.checked)} />
                            Email
                        </label>
                        {!emailEnabled && useEmail && (
                            <p className="text-[10px] text-amber-500">Email nao configurado. Informe o provedor para ativar.</p>
                        )}
                    </div>

                    <div className="p-4 rounded-xl border field-contrast space-y-3">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Filtros</label>
                        <div className="flex flex-wrap gap-2">
                            {(['USER', 'ADMIN', 'DEV'] as User['role'][]).map((role) => (
                                <button
                                    key={role}
                                    onClick={() => setSelectedRoles((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role])}
                                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${selectedRoles.includes(role) ? 'bg-indigo-600 text-white' : 'bg-slate-800/50 text-slate-200'}`}
                                >
                                    {role}
                                </button>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {PERMISSION_GROUPS.map((perm) => (
                                <button
                                    key={perm.key}
                                    onClick={() => setSelectedPermissions((prev) => prev.includes(perm.key) ? prev.filter((p) => p !== perm.key) : [...prev, perm.key])}
                                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${selectedPermissions.includes(perm.key) ? 'bg-emerald-600 text-white' : 'bg-slate-800/50 text-slate-200'}`}
                                >
                                    {perm.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="flex items-center gap-2 text-xs font-bold">
                                <input type="checkbox" checked={newOnly} onChange={(e) => setNewOnly(e.target.checked)} />
                                Apenas novos
                            </label>
                            <input
                                type="number"
                                min={1}
                                value={newDays === 0 ? '' : newDays}
                                onChange={(e) => setNewDays(parseNumericInput(e.target.value, 1))}
                                className="w-16 px-2 py-1 rounded-lg border text-xs field-contrast"
                            />
                            <span className="text-[10px] text-slate-400">dias</span>
                        </div>
                    </div>
                </div>

                <div className="p-4 rounded-xl border field-contrast space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Destinatarios</label>
                        <span className="text-[10px] text-slate-400">Selecionados: {resolvedRecipients.length || users.length}</span>
                    </div>
                    <input
                        className="w-full p-2.5 rounded-lg outline-none text-sm field-contrast"
                        placeholder="Buscar usuarios por nome ou email" aria-label="Buscar usuarios por nome ou email"
                        value={searchUsers}
                        onChange={(e) => setSearchUsers(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setSelectedUserIds(filteredUsers.map((u) => u.id))}
                            className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-slate-800/60 text-white"
                        >
                            Selecionar filtrados
                        </button>
                        <button
                            onClick={() => setSelectedUserIds([])}
                            className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-slate-800/60 text-white"
                        >
                            Limpar selecao
                        </button>
                    </div>
                    <div className="max-h-40 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-2">
                        {isLoadingUsers ? (
                            <div className="text-xs text-slate-400">Carregando usuarios...</div>
                        ) : (
                            filteredUsers.map((u) => (
                                <label key={u.id} className="flex items-center gap-2 text-xs">
                                    <input
                                        type="checkbox"
                                        checked={selectedUserIds.includes(u.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedUserIds((prev) => [...prev, u.id]);
                                            } else {
                                                setSelectedUserIds((prev) => prev.filter((id) => id !== u.id));
                                            }
                                        }}
                                    />
                                    <span className="font-bold">{u.name || u.email}</span>
                                    <span className="text-[10px] text-slate-400">{u.role}</span>
                                </label>
                            ))
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Corpo do Comunicado (Markdown)</label>
                        <textarea 
                            className="w-full p-4 rounded-xl border outline-none focus:ring-2 ring-indigo-500 h-32 resize-none field-contrast"
                            placeholder="Escreva sua mensagem aqui..." aria-label="Escreva sua mensagem aqui..."
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">URL da Imagem ou GIF</label>
                        <div className="relative">
                            <ImageIcon className="absolute left-3 top-3 text-gray-500" size={18}/>
                            <input 
                                className="w-full pl-10 pr-4 py-3 rounded-xl border outline-none focus:ring-2 ring-indigo-500 field-contrast"
                                placeholder="https://..." aria-label="https://..."
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
                        className="px-10 py-4 btn-secondary text-xs disabled:opacity-50 flex items-center gap-3"
                    >
                        {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18}/>}
                        Disparar comunicado
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminMessaging;
