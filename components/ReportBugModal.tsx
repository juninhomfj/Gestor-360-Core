import React, { useState } from 'react';
import { X, Bug, AlertTriangle, CheckCircle, Loader2, Paperclip, MessageSquare } from 'lucide-react';
import { TicketAttachment, TicketPriority, User } from '../types';
import { Logger } from '../services/logger';
import { sendPushNotification } from '../services/pushService';
import { createTicket } from '../services/tickets';
import { fileToBase64 } from '../utils/fileHelper';

interface ReportBugModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  darkMode?: boolean;
}

const ReportBugModal: React.FC<ReportBugModalProps> = ({ isOpen, onClose, currentUser, darkMode }) => {
  const [description, setDescription] = useState('');
  const [module, setModule] = useState('Geral');
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);

  if (!isOpen) return null;

  const handleSendReport = async () => {
    if (!description.trim()) return alert("Descreva o que aconteceu.");
    
    setIsSending(true);
    try {
        // Captura logs recentes para anexar ao ticket
        const logs = await Logger.getLogs(200);
        const displayMode = window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser';
        const snapshot = {
            url: window.location.href,
            pathname: window.location.pathname,
            appMode: localStorage.getItem('sys_last_mode') || 'unknown',
            activeTab: localStorage.getItem('sys_last_tab') || 'unknown',
            theme: localStorage.getItem('sys_theme') || 'unknown',
            screen: `${window.innerWidth}x${window.innerHeight}`,
            devicePixelRatio: window.devicePixelRatio,
            isOnline: navigator.onLine,
            language: navigator.language,
            platform: navigator.platform,
            displayMode,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            userId: currentUser?.id || currentUser?.uid,
            role: currentUser?.role || 'unknown'
        };
        logs.unshift({
            timestamp: Date.now(),
            level: 'INFO',
            message: 'Ticket snapshot',
            details: snapshot,
            userAgent: navigator.userAgent,
            userId: currentUser?.id || currentUser?.uid,
            userName: currentUser?.name
        });
        
        const content = `[TICKET DE ERRO - Modulo: ${module}]\n\n${description}`;

        await createTicket({
            title: `Erro em ${module}`,
            description,
            module,
            priority,
            createdBy: currentUser,
            logs,
            attachments
        });
        
        // Chat desativado - bugs agora vão apenas para tickets na área DEV
        // await sendMessage(
        //     currentUser,
        //     content,
        //     'BUG_REPORT',
        //     'ADMIN',
        //     undefined,
        //     module.toLowerCase() as any
        // );

        // Dispara PUSH para os administradores
        // Safe check for substring
        const safeDesc = (description || "").substring(0, 50);
        await sendPushNotification(
            'ADMIN_GROUP',
            `🚨 Novo Ticket: ${module}`,
            `${currentUser?.name || "Usuário"} reportou um problema: ${safeDesc}...`,
            { moduleId: module.toLowerCase(), sender: currentUser?.name || "???" }
        );

        setSent(true);
        setTimeout(() => {
            setSent(false);
            onClose();
            setDescription('');
            setAttachments([]);
        }, 3000);
    } catch (e) {
        alert("Falha ao enviar ticket. Verifique sua conexão.");
    } finally {
        setIsSending(false);
    }
  };

  const bgClass = darkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-gray-900';

  const handleAttachmentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
        const dataUrl = await fileToBase64(file);
        const attachment: TicketAttachment = {
            id: crypto.randomUUID(),
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
            dataUrl
        };
        setAttachments(prev => [...prev, attachment]);
    } catch (e) {
        alert("Não foi possível anexar o arquivo.");
    } finally {
        event.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in">
        <div className={`w-full max-w-lg max-h-[90dvh] rounded-3xl shadow-2xl overflow-hidden border flex flex-col modal-surface ${bgClass} animate-in zoom-in-95`}>
            
            {sent ? (
                <div className="p-12 text-center flex flex-col items-center justify-center space-y-4">
                    <div className="w-20 h-20 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center">
                        <CheckCircle size={48} />
                    </div>
                    <h3 className="text-2xl font-bold">Ticket Aberto!</h3>
                    <p className="text-gray-400 text-sm">Nossa engenharia recebeu seu reporte e os administradores foram notificados via Push.</p>
                </div>
            ) : (
                <>
                    <div className="p-6 flex justify-between items-center modal-header">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl">
                                <Bug size={24}/>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">Reportar Problema</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Notifica a engenharia e os administradores.</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-500 transition-colors" aria-label="Fechar" title="Fechar"><X size={24}/></button>
                    </div>

                    <div className="p-8 space-y-6 flex-1 overflow-y-auto">
                        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 p-4 rounded-2xl flex gap-3 text-xs text-amber-700 dark:text-amber-400">
                            <AlertTriangle size={18} className="shrink-0"/>
                            <p>Ao reportar, o sistema enviará uma notificação Push prioritária para a equipe administrativa.</p>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">MóModulo Afetado</label>
                            <select 
                                className="w-full p-4 rounded-2xl outline-none focus:ring-2 ring-red-500/50 font-bold field-contrast"
                                value={module}
                                onChange={e => setModule(e.target.value)}
                                aria-label="Selecionar"
                            >
                                <option>Home / Dashboard</option>
                                <option>Vendas</option>
                                <option>Financeiro</option>
                                <option>Recebiveis</option>
                                <option>Distribuicao</option>
                                <option>Importacoes</option>
                                <option>Chat Interno</option>
                                <option>Tickets</option>
                                <option>Configuracoes</option>
                                <option>Perfil e Usuarios</option>
                                <option>Notificacoes</option>
                                <option>Outro</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Prioridade</label>
                            <select
                                className="w-full p-4 rounded-2xl outline-none focus:ring-2 ring-red-500/50 font-bold field-contrast"
                                value={priority}
                                onChange={e => setPriority(e.target.value as TicketPriority)}
                                aria-label="Selecionar"
                            >
                                <option value="LOW">Baixa</option>
                                <option value="MEDIUM">Média</option>
                                <option value="HIGH">Alta</option>
                                <option value="URGENT">Crítica</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">O que aconteceu?</label>
                            <textarea 
                                className="w-full p-4 rounded-2xl outline-none focus:ring-2 ring-red-500/50 h-32 resize-none text-sm leading-relaxed field-contrast"
                                placeholder="Descreva o erro..." aria-label="Descreva o erro..."
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Anexos</label>
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 px-4 py-3 rounded-2xl border text-xs font-bold cursor-pointer btn-soft">
                                    <Paperclip size={16} />
                                    Adicionar arquivo
                                    <input type="file" className="hidden" onChange={handleAttachmentUpload} aria-label="Selecionar arquivo" />
                                </label>
                                {attachments.length > 0 && (
                                    <span className="text-[10px] font-black uppercase text-gray-400">{attachments.length} anexos</span>
                                )}
                            </div>
                            {attachments.length > 0 && (
                                <ul className="mt-3 space-y-2 text-xs text-gray-500">
                                    {attachments.map(att => (
                                        <li key={att.id} className="flex items-center justify-between rounded-xl px-3 py-2 field-contrast">
                                            <span className="truncate">{att.name}</span>
                                            <span className="text-[10px] font-black uppercase">{Math.ceil(att.size / 1024)}kb</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    <div className="p-6 flex gap-4 modal-footer pb-[env(safe-area-inset-bottom)]">
                        <button onClick={onClose} className="flex-1 py-4 btn-ghost text-xs">Cancelar</button>
                        <button 
                            onClick={handleSendReport}
                            disabled={isSending}
                            className="flex-1 py-4 btn-danger text-xs"
                        >
                            {isSending ? <Loader2 className="animate-spin" size={20}/> : <MessageSquare size={20}/>}
                            Enviar Ticket & Push
                        </button>
                    </div>
                </>
            )}
        </div>
    </div>
  );
};

export default ReportBugModal;
