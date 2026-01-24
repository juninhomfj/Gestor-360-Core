import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Check, Edit2, Loader2, Plug, Plus, RefreshCw, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { WebhookConfig, WebhookEvent } from '../types';
import { listWebhooks, saveWebhook, sendWebhookTest, setWebhookActive } from '../services/webhooks';
import { safeShort } from '../utils/stringUtils';

interface AdminWebhooksProps {
    onNotify: (type: 'SUCCESS' | 'ERROR' | 'INFO', msg: string) => void;
    darkMode?: boolean;
}

const EVENT_OPTIONS: Array<{ value: WebhookEvent; label: string; description: string }> = [
    { value: 'transfer', label: 'Transferências', description: 'Movimentações e aprovações de clientes' },
    { value: 'ticket', label: 'Tickets', description: 'Criação e atualizações de chamados' },
    { value: 'message', label: 'Mensagens', description: 'Mensagens internas do chat' },
    { value: 'sale', label: 'Vendas', description: 'Criações e alterações em vendas' }
];

const AdminWebhooks: React.FC<AdminWebhooksProps> = ({ onNotify, darkMode }) => {
    const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testingId, setTestingId] = useState<string | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [endpoint, setEndpoint] = useState('');
    const [secret, setSecret] = useState('');
    const [events, setEvents] = useState<WebhookEvent[]>([]);
    const [active, setActive] = useState(true);

    const eventLabel = useMemo(() => new Map(EVENT_OPTIONS.map(opt => [opt.value, opt.label])), []);

    const loadWebhooks = async () => {
        setLoading(true);
        try {
            const data = await listWebhooks();
            setWebhooks(data);
        } catch (error) {
            console.error('[Webhooks] Falha ao carregar webhooks', error);
            onNotify('ERROR', 'Não foi possível carregar os webhooks.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadWebhooks();
    }, []);

    const resetForm = () => {
        setEditingId(null);
        setEndpoint('');
        setSecret('');
        setEvents([]);
        setActive(true);
        setIsFormOpen(false);
    };

    const handleEdit = (webhook: WebhookConfig) => {
        setEditingId(webhook.id);
        setEndpoint(webhook.endpoint || '');
        setSecret(webhook.secret || '');
        setEvents(webhook.events || []);
        setActive(webhook.active);
        setIsFormOpen(true);
    };

    const handleSave = async () => {
        if (!endpoint.trim()) {
            onNotify('ERROR', 'Informe o endpoint do webhook.');
            return;
        }
        if (!events.length) {
            onNotify('ERROR', 'Selecione ao menos um evento.');
            return;
        }
        setSaving(true);
        try {
            const existing = webhooks.find(item => item.id === editingId);
            await saveWebhook({
                id: editingId || '',
                endpoint: endpoint.trim(),
                secret: secret.trim(),
                events,
                active,
                createdAt: existing?.createdAt
            });
            onNotify('SUCCESS', editingId ? 'Webhook atualizado com sucesso.' : 'Webhook registrado com sucesso.');
            resetForm();
            await loadWebhooks();
        } catch (error) {
            console.error('[Webhooks] Falha ao salvar webhook', error);
            onNotify('ERROR', 'Falha ao salvar webhook.');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (id: string, nextActive: boolean) => {
        try {
            await setWebhookActive(id, nextActive);
            setWebhooks(prev => prev.map(item => item.id === id ? { ...item, active: nextActive } : item));
            onNotify('SUCCESS', nextActive ? 'Webhook ativado.' : 'Webhook desativado.');
        } catch (error) {
            console.error('[Webhooks] Falha ao alternar webhook', error);
            onNotify('ERROR', 'Não foi possível alterar o status.');
        }
    };

    const handleTest = async (webhook: WebhookConfig) => {
        const event = webhook.events[0] || 'sale';
        setTestingId(webhook.id);
        try {
            await sendWebhookTest(webhook.id, event);
            onNotify('SUCCESS', 'Evento de teste enviado com sucesso.');
        } catch (error) {
            console.error('[Webhooks] Falha no teste de webhook', error);
            onNotify('ERROR', 'Falha ao testar o webhook.');
        } finally {
            setTestingId(null);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black flex items-center gap-2">
                        <Plug className="text-indigo-500" /> Webhooks
                    </h2>
                    <p className="text-sm text-gray-500">Integrações externas para transferências, tickets, mensagens e vendas.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={loadWebhooks}
                        className="px-4 py-3 rounded-2xl border border-gray-200 dark:border-slate-800 text-gray-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                    >
                        <RefreshCw size={16}/> Atualizar
                    </button>
                    <button
                        onClick={() => { setIsFormOpen(true); setEditingId(null); }}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-900/20 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <Plus size={18}/> Novo Webhook
                    </button>
                </div>
            </div>

            {isFormOpen && (
                <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border-2 border-indigo-500/20 animate-in zoom-in-95 dark:text-slate-100">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-black">{editingId ? 'Editar Webhook' : 'Registrar Webhook'}</h3>
                        <button onClick={resetForm} className="text-gray-400 hover:text-gray-600" aria-label="Fechar" title="Fechar">
                            <X size={18} />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Endpoint</label>
                            <input
                                className="w-full p-4 rounded-2xl border bg-slate-100 dark:bg-slate-950 border-gray-300 dark:border-slate-800 text-gray-900 dark:text-slate-100 outline-none focus:ring-2 ring-indigo-500"
                                value={endpoint}
                                onChange={e => setEndpoint(e.target.value)}
                                placeholder="https://api.seu-dominio.com/webhooks"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Secret (opcional)</label>
                            <input
                                className="w-full p-4 rounded-2xl border bg-slate-100 dark:bg-slate-950 border-gray-300 dark:border-slate-800 text-gray-900 dark:text-slate-100 outline-none focus:ring-2 ring-indigo-500"
                                value={secret}
                                onChange={e => setSecret(e.target.value)}
                                placeholder="Assinatura HMAC"
                            />
                        </div>
                    </div>

                    <div className="p-6 rounded-2xl border border-dashed border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30 mb-6">
                        <div className="flex flex-col gap-4 text-xs text-gray-600 dark:text-gray-300">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-300">Formato do endpoint</p>
                                <p className="mt-2 leading-relaxed">
                                    Enviaremos um <span className="font-semibold">POST HTTPS</span> para o endereço configurado. Exemplo:
                                    <span className="font-mono bg-white/80 dark:bg-slate-900 px-2 py-1 rounded ml-2 dark:text-slate-100">https://seu-dominio.com/webhooks/gestor360</span>
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-300">Payload de exemplo</p>
                                <pre className="mt-2 bg-white/80 dark:bg-slate-900 rounded-xl p-3 text-[11px] leading-relaxed overflow-x-auto dark:text-slate-100">
{`{
  "event": "sale",
  "data": {
    "id": "sale_123",
    "status": "approved",
    "amount": 1500,
    "customer": {
      "id": "cust_456",
      "name": "Ana Souza"
    }
  },
  "sentAt": "2024-01-02T15:04:05Z"
}`}
                                </pre>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-300">Fluxo de autenticação</p>
                                <p className="mt-2 leading-relaxed">
                                    Se informar uma <span className="font-semibold">secret</span>, geramos uma assinatura HMAC-SHA256 no header
                                    <span className="font-mono bg-white/80 dark:bg-slate-900 px-2 py-1 rounded ml-2 dark:text-slate-100">X-Gestor360-Signature</span>.
                                    Valide a assinatura com o payload bruto para garantir a origem.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2 items-center">
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Eventos disponíveis</span>
                                {EVENT_OPTIONS.map(option => (
                                    <span
                                        key={option.value}
                                        title={option.description}
                                        className="px-3 py-1 rounded-full text-[9px] font-black tracking-widest border bg-white/80 text-indigo-700 border-indigo-100 dark:bg-slate-900 dark:text-indigo-300 dark:border-indigo-800"
                                    >
                                        {option.label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-gray-50 dark:bg-slate-950/50 rounded-2xl border dark:border-slate-800 mb-6 dark:text-slate-100">
                        <label className="block text-xs font-black text-gray-500 uppercase mb-4 tracking-widest">Eventos monitorados</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {EVENT_OPTIONS.map(option => {
                                const selected = events.includes(option.value);
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => {
                                            setEvents(prev => selected ? prev.filter(ev => ev !== option.value) : [...prev, option.value]);
                                        }}
                                        className={`p-4 rounded-2xl border text-left transition-all ${selected ? 'bg-indigo-600/10 border-indigo-500 text-indigo-700 dark:text-indigo-300' : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-gray-500'}`}
                                    >
                                        <p className="text-[10px] font-black uppercase tracking-widest">{option.label}</p>
                                        <p className="text-xs mt-2 leading-relaxed">{option.description}</p>
                                        <div className={`mt-3 inline-flex items-center gap-1 text-[10px] font-black uppercase ${selected ? 'text-emerald-600' : 'text-gray-400'}`}>
                                            {selected ? <Check size={12}/> : <ToggleLeft size={12}/>}
                                            {selected ? 'Ativo' : 'Inativo'}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <button
                            type="button"
                            onClick={() => setActive(prev => !prev)}
                            className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest ${active ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-100 border-gray-200 text-gray-500'}`}
                        >
                            {active ? <ToggleRight size={18}/> : <ToggleLeft size={18}/>}
                            {active ? 'Webhook ativo' : 'Webhook desativado'}
                        </button>
                        <div className="flex gap-3">
                            <button
                                onClick={resetForm}
                                className="px-6 py-3 text-gray-500 font-bold uppercase text-[10px] tracking-widest"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-8 py-3 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-900/20 active:scale-95 transition-all uppercase text-[10px] tracking-widest flex items-center gap-2 disabled:opacity-70"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin"/> : <Check size={16}/>}
                                {editingId ? 'Salvar Alterações' : 'Registrar Webhook'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-gray-200 dark:border-slate-800 overflow-hidden shadow-sm dark:text-slate-100">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[10px] font-black uppercase text-gray-400 tracking-widest bg-gray-50 dark:bg-slate-950/50 border-b dark:border-slate-800 dark:text-slate-100">
                            <tr>
                                <th className="p-6">Endpoint</th>
                                <th className="p-6">Eventos</th>
                                <th className="p-6">Status</th>
                                <th className="p-6 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-800">
                            {webhooks.map(webhook => (
                                <tr key={webhook.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-all">
                                    <td className="p-6">
                                        <p className="font-black text-gray-800 dark:text-white">{safeShort(webhook.endpoint, 46)}</p>
                                        <p className="text-[10px] text-gray-500 mt-1">{webhook.secret ? 'Secret configurado' : 'Sem secret'}</p>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex flex-wrap gap-2">
                                            {webhook.events.map(event => (
                                                <span key={event} className="px-3 py-1 rounded-full text-[9px] font-black tracking-widest border bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800">
                                                    {eventLabel.get(event) || event}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase ${webhook.active ? 'text-emerald-500' : 'text-gray-400'}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${webhook.active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                            {webhook.active ? 'ATIVO' : 'INATIVO'}
                                        </span>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex justify-center gap-2">
                                            <button
                                                onClick={() => handleEdit(webhook)}
                                                className="p-2 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                            >
                                                <Edit2 size={16}/>
                                            </button>
                                            <button
                                                onClick={() => handleToggleActive(webhook.id, !webhook.active)}
                                                className="p-2 text-emerald-500 hover:bg-emerald-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                            >
                                                {webhook.active ? <ToggleRight size={16}/> : <ToggleLeft size={16}/>}
                                            </button>
                                            <button
                                                onClick={() => handleTest(webhook)}
                                                disabled={testingId === webhook.id}
                                                className="p-2 text-amber-500 hover:bg-amber-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-60"
                                            >
                                                {testingId === webhook.id ? <Loader2 size={16} className="animate-spin"/> : <Activity size={16}/>}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {loading && (
                                <tr>
                                    <td colSpan={4} className="p-20 text-center">
                                        <Loader2 className="animate-spin mx-auto text-indigo-500" size={32}/>
                                    </td>
                                </tr>
                            )}
                            {!loading && webhooks.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center text-sm text-gray-500">
                                        Nenhum webhook registrado ainda.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminWebhooks;
