
import React, { useState, useEffect } from 'react';
import { Lock, Download, Upload, Trash2, X, AlertTriangle, CheckCircle, RefreshCw, Loader2 } from 'lucide-react';
// Fix: Added missing backup exports from services/logic
import { exportEncryptedBackup, importEncryptedBackup, clearAllSales } from '../services/logic';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'BACKUP' | 'RESTORE' | 'CLEAR'; 
  onSuccess: () => void; 
  onRestoreSuccess?: () => void; 
}

const BackupModal: React.FC<BackupModalProps> = ({ isOpen, onClose, mode, onSuccess, onRestoreSuccess }) => {
  const [passphrase, setPassphrase] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [restoreComplete, setRestoreComplete] = useState(false);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
      if (isOpen) {
          setProgress(0);
          setIsProcessing(false);
          setError('');
          setStep(1);
          setPassphrase('');
      }
  }, [isOpen]);

  if (!isOpen) return null;

  const simulateProgress = () => {
      return new Promise<void>((resolve) => {
          let p = 0;
          const interval = setInterval(() => {
              p += Math.random() * 15;
              if (p > 90) {
                  clearInterval(interval);
                  resolve();
              } else {
                  setProgress(p);
              }
          }, 150);
      });
  };

  const handleBackup = async () => {
    if (!passphrase || passphrase.length < 4) {
      setError('A chave deve ter pelo menos 4 caracteres.');
      return;
    }
    
    setIsProcessing(true);
    await simulateProgress(); 
    setProgress(100);

    setTimeout(async () => {
        try {
            await exportEncryptedBackup(passphrase);
            onSuccess();
            onClose();
        } catch (e) {
            setError('Erro ao gerar backup.');
        } finally {
            setIsProcessing(false);
        }
    }, 500);
  };

  const handleRestore = async () => {
    if (!file) {
      setError('Selecione um arquivo de backup (.v360).');
      return;
    }
    if (!passphrase) {
      setError('Informe a chave de segurança.');
      return;
    }

    setIsProcessing(true);
    await simulateProgress();
    setProgress(100);

    setTimeout(async () => {
        try {
            await importEncryptedBackup(file, passphrase);
            setRestoreComplete(true);
        } catch (e) {
            setError('Falha na restauração. Verifique a chave e o arquivo.');
        } finally {
            setIsProcessing(false);
        }
    }, 500);
  };

  const handleFinalizeRestore = () => {
      if (onRestoreSuccess) {
          onRestoreSuccess();
      } else {
          window.location.reload();
      }
      onClose(); 
  };

  const handleClearFlow = async () => {
    if (confirm('Tem certeza absoluta?')) {
        setIsProcessing(true);
        await new Promise(resolve => setTimeout(resolve, 1500)); 
        await clearAllSales();
        
        if (onRestoreSuccess) onRestoreSuccess();
        else window.location.reload();
        
        onClose();
    }
  };

  const ProgressBar = ({ label }: { label: string }) => (
      <div className="w-full space-y-2 text-center animate-in fade-in">
          <div className="flex justify-between text-xs text-gray-500 font-bold uppercase px-1">
              <span>{label}</span>
              <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
              <div 
                className="h-full bg-blue-600 transition-all duration-300 ease-out flex items-center justify-center" 
                style={{ width: `${progress}%` }}
              >
                  <div className="w-full h-full bg-white/20 animate-[pulse_1s_infinite]"></div>
              </div>
          </div>
          <p className="text-xs text-gray-400">Por favor, aguarde...</p>
      </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative">
        {!restoreComplete && !isProcessing && (
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                <X size={24} />
            </button>
        )}

        {restoreComplete && (
            <div className="p-8 text-center flex flex-col items-center animate-in zoom-in-95">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle size={40} className="text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Backup Restaurado!</h2>
                <p className="text-gray-600 mb-8">
                    Seus dados foram recuperados com sucesso.
                </p>
                <button 
                    onClick={handleFinalizeRestore}
                    className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-lg"
                >
                    <RefreshCw size={20} />
                    Atualizar Dados
                </button>
            </div>
        )}

        {isProcessing && !restoreComplete && (
            <div className="p-10 flex flex-col items-center justify-center min-h-[300px]">
                <div className="mb-6 relative">
                    <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full"></div>
                    <Loader2 size={48} className="text-blue-600 animate-spin relative z-10" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">
                    {mode === 'BACKUP' ? 'Criptografando Dados...' : (mode === 'RESTORE' ? 'Restaurando Base...' : 'Limpando Dados...')}
                </h3>
                <ProgressBar label="Progresso" />
            </div>
        )}

        {!restoreComplete && !isProcessing && mode === 'CLEAR' && (
            <div className="p-6">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="bg-red-100 p-4 rounded-full mb-4">
                        <Trash2 size={40} className="text-red-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">Limpar Base</h2>
                    <p className="text-gray-500 mt-2">Isso apagará todos os dados locais.</p>
                </div>

                <div className="space-y-3">
                    <button 
                        className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700"
                        onClick={() => setStep(2)}
                    >
                        <Download size={20} className="mr-2 inline" />
                        Fazer Backup Antes (Recomendado)
                    </button>
                    <button 
                        onClick={handleClearFlow}
                        className="w-full py-3 bg-white border-2 border-red-100 text-red-600 rounded-lg font-bold hover:bg-red-50"
                    >
                        Limpar Tudo Agora
                    </button>
                </div>
                
                 {step === 2 && (
                    <div className="absolute inset-0 bg-white p-6 flex flex-col animate-in slide-in-from-right">
                        <h3 className="text-lg font-bold mb-4">Proteger Backup</h3>
                        <input type="password" placeholder="Crie uma chave (senha)" className="w-full border p-3 rounded-lg mb-4" value={passphrase} onChange={e => setPassphrase(e.target.value)} />
                        <button onClick={() => { if(passphrase) { handleBackup().then(() => setTimeout(handleClearFlow, 1000)); } }} className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold">Baixar & Apagar</button>
                        <button onClick={() => setStep(1)} className="mt-2 text-gray-400 text-sm underline text-center w-full">Voltar</button>
                    </div>
                )}
            </div>
        )}

        {!restoreComplete && !isProcessing && mode === 'RESTORE' && (
            <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-emerald-100 p-2 rounded-lg"><Upload className="text-emerald-600" size={24}/></div>
                    <h2 className="text-xl font-bold text-gray-800">Restaurar Dados</h2>
                </div>
                <div className="space-y-4">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors relative">
                        <input type="file" accept=".v360" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setFile(e.target.files ? e.target.files[0] : null)} />
                        {file ? (
                            <div className="flex flex-col items-center text-emerald-600">
                                <FileTextIcon />
                                <span className="font-bold mt-2">{file.name}</span>
                            </div>
                        ) : (
                            <div className="text-gray-400 flex flex-col items-center">
                                <Upload size={32} className="mb-2"/>
                                <span className="text-sm">Clique para selecionar o arquivo .v360</span>
                            </div>
                        )}
                    </div>

                    <input type="password" className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Digite a chave de segurança..." value={passphrase} onChange={e => setPassphrase(e.target.value)} />
                    
                    {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded font-medium flex items-center justify-center gap-2"><AlertTriangle size={16}/> {error}</p>}
                    
                    <button onClick={handleRestore} className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 flex items-center justify-center shadow-lg transform active:scale-95 transition-all">
                        <CheckCircle size={20} className="mr-2" /> Iniciar Restauração
                    </button>
                </div>
            </div>
        )}

        {!restoreComplete && !isProcessing && mode === 'BACKUP' && (
             <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-blue-100 p-2 rounded-lg"><Lock className="text-blue-600" size={24}/></div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Criar Backup Local</h2>
                        <p className="text-sm text-gray-500">Salve seus dados em um arquivo seguro.</p>
                    </div>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
                    <label className="text-xs font-bold text-blue-800 uppercase mb-1 block">Chave de Segurança</label>
                    <input type="password" className="w-full border border-blue-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none bg-white" placeholder="Crie uma senha para este arquivo..." value={passphrase} onChange={e => setPassphrase(e.target.value)} />
                    <p className="text-[10px] text-blue-600 mt-1">Você precisará desta senha para restaurar.</p>
                </div>

                {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
                
                <button onClick={handleBackup} className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center shadow-lg transform active:scale-95 transition-all">
                    <Download size={20} className="mr-2" /> Baixar Arquivo .v360
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

const FileTextIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
);

export default BackupModal;
