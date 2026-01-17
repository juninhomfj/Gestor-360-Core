import React, { useState } from 'react';
import { X, Bug, AlertTriangle, CheckCircle, Loader2, Paperclip, MessageSquare } from 'lucide-react';
import { TicketAttachment, TicketPriority, User } from '../types';
import { sendMessage } from '../services/internalChat';
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
        
        const content = `[TICKET DE ERRO - Módulo: ${module}]\n\n${description}`;

        await createTicket({
            title: `Erro em ${module}`,
            description,
            module,
            priority,
            createdBy: currentUser,
            logs,
            attachments
        });
        
        await sendMessage(
            currentUser,
            content,
            'BUG_REPORT',
            'ADMIN',
            undefined,
            module.toLowerCase() as any
        );

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

  const bgClass = darkMode ? 'bg-slate-950 text-white' : 'bg-white text-gray-900';

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
        <div className={`w-full max-w-lg max-h-[90dvh] rounded-3xl shadow-2xl overflow-hidden border flex flex-col ${darkMode ? 'border-slate-800' : 'border-gray-200'} ${bgClass} animate-in zoom-in-95`}>
            
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
                    <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl">
                                <Bug size={24}/>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">Reportar Problema</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Notifica a engenharia e os administradores.</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-500 transition-colors"><X size={24}/></button>
                    </div>

                    <div className="p-8 space-y-6 flex-1 overflow-y-auto">
                        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 p-4 rounded-2xl flex gap-3 text-xs text-amber-700 dark:text-amber-400">
                            <AlertTriangle size={18} className="shrink-0"/>
                            <p>Ao reportar, o sistema enviará uma notificação Push prioritária para a equipe administrativa.</p>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Módulo Afetado</label>
                            <select 
                                className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 outline-none focus:ring-2 ring-red-500/50 font-bold"
                                value={module}
                                onChange={e => setModule(e.target.value)}
                            >
                                <option>Dashboard</option>
                                <option>Vendas (Cálculos)</option>
                                <option>Finanças (Extrato)</option>
                                <option>WhatsApp Marketing</option>
                                <option>Contas & Perfil</option>
                                <option>Outro</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Prioridade</label>
                            <select
                                className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 outline-none focus:ring-2 ring-red-500/50 font-bold"
                                value={priority}
                                onChange={e => setPriority(e.target.value as TicketPriority)}
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
                                className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 outline-none focus:ring-2 ring-red-500/50 h-32 resize-none text-sm leading-relaxed"
                                placeholder="Descreva o erro..."
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Anexos</label>
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-xs font-bold cursor-pointer">
                                    <Paperclip size={16} />
                                    Adicionar arquivo
                                    <input type="file" className="hidden" onChange={handleAttachmentUpload} />
                                </label>
                                {attachments.length > 0 && (
                                    <span className="text-[10px] font-black uppercase text-gray-400">{attachments.length} anexos</span>
                                )}
                            </div>
                            {attachments.length > 0 && (
                                <ul className="mt-3 space-y-2 text-xs text-gray-500">
                                    {attachments.map(att => (
                                        <li key={att.id} className="flex items-center justify-between bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-3 py-2">
                                            <span className="truncate">{att.name}</span>
                                            <span className="text-[10px] font-black uppercase">{Math.ceil(att.size / 1024)}kb</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    <div className="p-6 border-t border-gray-100 dark:border-slate-800 flex gap-4 bg-gray-50 dark:bg-slate-900/50 pb-[env(safe-area-inset-bottom)]">
                        <button onClick={onClose} className="flex-1 py-4 font-bold text-gray-500 hover:text-gray-700 transition-colors uppercase text-xs">Cancelar</button>
                        <button 
                            onClick={handleSendReport}
                            disabled={isSending}
                            className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-xl shadow-red-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-widest"
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
