import React, { useState, useEffect } from 'react';
// Fix: Added RefreshCw to lucide-react imports to resolve the "Cannot find name 'RefreshCw'" error
import { Mail, Bug, Download, Info, CheckCircle, AlertTriangle, MessageSquare, RefreshCw } from 'lucide-react';
import { getSystemConfig } from '../services/logic';
import { Logger } from '../services/logger';
import ReportBugModal from './ReportBugModal';
import { getSession } from '../services/auth';

const Help: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{type: 'success'|'error', text: string} | null>(null);
  const [bugModalOpen, setBugModalOpen] = useState(false);
  const currentUser = getSession();

  useEffect(() => {
      getSystemConfig().then(cfg => {
          setEmail(cfg.supportEmail || 'hypelab3@gmail.com');
      });
  }, []);

  const handleUploadLogs = async () => {
      setLoading(true);
      setStatusMsg(null);
      
      // Fix: Alterado de exportLogsToDrive para downloadLogs que é o método correto existente no Logger
      const success = await Logger.downloadLogs();
      
      if (success) {
          setStatusMsg({ type: 'success', text: 'Relatório baixado no seu dispositivo.' });
      } else {
          setStatusMsg({ type: 'error', text: 'Falha ao gerar relatório.' });
      }
      setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300 pb-20">
      
      {currentUser && (
          <ReportBugModal 
            isOpen={bugModalOpen} 
            onClose={() => setBugModalOpen(false)} 
            currentUser={currentUser} 
            darkMode={true} 
          />
      )}

      <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600 dark:text-blue-400">
              <Info size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Central de Ajuda</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
              Precisa de assistência ou encontrou um problema?
          </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* TICKET CARD (NEW) */}
          <div className="bg-gradient-to-br from-red-600 to-rose-700 p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center text-white md:col-span-2 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-125 transition-transform duration-700">
                <Bug size={200}/>
              </div>
              <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                  <Bug size={32} />
              </div>
              <h3 className="text-2xl font-black mb-2">Encontrou um Bug?</h3>
              <p className="text-red-100 text-sm max-w-md mx-auto mb-8 leading-relaxed font-medium">
                  Abra um ticket agora. O sistema enviará um diagnóstico completo para nossa equipe técnica resolver o problema rapidamente.
              </p>
              <button 
                onClick={() => setBugModalOpen(true)}
                className="px-10 py-4 bg-white text-red-600 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                  <MessageSquare size={18}/> Abrir Chamado de Suporte
              </button>
          </div>

          {/* EMAIL CARD */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col items-center text-center hover:border-blue-300 transition-colors dark:text-slate-100">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 text-red-500 rounded-lg flex items-center justify-center mb-4">
                  <Mail size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">Suporte via E-mail</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Envie detalhes do seu problema ou sugestão.
              </p>
              <a 
                href={`mailto:${email}`} 
                className="text-blue-600 dark:text-blue-400 font-bold hover:underline break-all"
              >
                  {email}
              </a>
          </div>
      </div>

      {/* DIAGNOSTICS & LOGS */}
      <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 dark:text-slate-100">
          <div className="flex items-center gap-3 mb-4">
              <RefreshCw className="text-amber-500" size={24} />
              <div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white">Ferramentas de Diagnóstico</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                      Caso solicitado pelo suporte, baixe os arquivos de log.
                  </p>
              </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-gray-200 dark:border-slate-700 mb-4 dark:text-slate-100">
              {statusMsg && (
                  <div className={`p-3 rounded-lg text-sm flex items-start gap-2 mb-3 ${statusMsg.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                      {statusMsg.type === 'success' ? <CheckCircle size={16} className="mt-0.5"/> : <AlertTriangle size={16} className="mt-0.5"/>}
                      {statusMsg.text}
                  </div>
              )}

              <button 
                onClick={handleUploadLogs}
                disabled={loading}
                className="w-full sm:w-auto bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 dark:text-slate-100"
              >
                  {loading ? <span className="animate-spin">⏳</span> : <Download size={18} />}
                  {loading ? 'Gerando...' : 'Baixar Relatório de Logs'}
              </button>
          </div>
          
          <p className="text-[10px] text-gray-400 text-center uppercase tracking-widest font-bold opacity-60">
              ID do Dispositivo: <span className="font-mono">{localStorage.getItem('device_id') || 'ROOT_SYNC_ACTIVE'}</span>
          </p>
      </div>
    </div>
  );
};

export default Help;