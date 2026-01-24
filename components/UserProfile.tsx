import React, { useState, useRef } from 'react';
import { User, UserPermissions, SalesTargets } from '../types';
import { updateUser, updateUserSalesTargets, deactivateUser } from '../services/auth';
import { requestAndSaveToken } from '../services/pushService';
import { SYSTEM_MODULES } from '../config/modulesCatalog';
import { canAccess } from '../services/logic';
import { 
  Save, User as UserIcon, LogOut, Camera, CheckCircle, 
  AlertTriangle, Shield, Lock, UserX, ShieldAlert, Bell, BellRing, Loader2, Key, Info, Check, X, LayoutDashboard, Smartphone, Mail, Phone
} from 'lucide-react';
import ShieldCheckIcon from './icons/ShieldCheckIcon';
import { optimizeImage } from '../utils/fileHelper';
import { safeFirstChar } from '../utils/stringUtils';

interface UserProfileProps {
  user: User;
  onUpdate: (user: User) => void;
  onLogout: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ user: currentUser, onUpdate, onLogout }) => {
  const parseNumericInput = (value: string) => (value === '' ? 0 : Number(value));
  const [name, setName] = useState(currentUser?.name || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [tel, setTel] = useState(currentUser?.tel || '');
  const [profilePhoto, setProfilePhoto] = useState(currentUser?.profilePhoto || '');
  const [contactVisibility, setContactVisibility] = useState(currentUser?.contactVisibility || 'PRIVATE');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [hiddenModules, setHiddenModules] = useState<UserPermissions>({
    ...SYSTEM_MODULES.reduce((acc, mod) => ({ ...acc, [mod.key]: false }), {}),
    ...(currentUser.hiddenModules || {})
  } as UserPermissions);
  const [salesTargets, setSalesTargets] = useState<SalesTargets>(currentUser.salesTargets || { basic: 0, natal: 0 });
  
  // Preferência canônica (Etapa 1)
  const [defaultModule, setDefaultModule] = useState(currentUser?.prefs?.defaultModule || 'home');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    if (!currentUser?.id) return;
    setIsSaving(true);
    setMessage(null);

    try {
      // Update dados do usuário (nome, username, tel, etc)
      const updateData = {
        name: name.trim(),
        username: username.trim(),
        tel: tel.trim(),
        profilePhoto: profilePhoto,
        contactVisibility: contactVisibility,
        hiddenModules: hiddenModules,
        prefs: {
            ...currentUser.prefs,
            defaultModule: defaultModule
        }
      };

      await updateUser(currentUser.id, updateData);
      
      // Persistir metas APENAS se mudaram (update mínimo)
      const targetsChanged = 
        salesTargets.basic !== currentUser.salesTargets?.basic ||
        salesTargets.natal !== currentUser.salesTargets?.natal;
      
      if (targetsChanged) {
        await updateUserSalesTargets(currentUser.id, salesTargets);
      }
      
      const updatedUser: User = { 
        ...currentUser, 
        ...updateData,
        salesTargets: salesTargets
      } as User;

      localStorage.setItem('sys_session_v1', JSON.stringify(updatedUser));
      onUpdate(updatedUser);
      
      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      const msg = String(error?.message || '').toLowerCase();
      const isPermission = error?.code === 'permission-denied' || msg.includes('missing or insufficient permissions');
      console.error("Erro ao salvar perfil:", error);
      setMessage({
        type: 'error',
        text: isPermission ? 'Sem permiss?o para atualizar o perfil. Verifique regras/perfil.' : 'Erro ao salvar altera??es.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
          const optimized = await optimizeImage(file, 200, 0.8);
          setProfilePhoto(optimized);
      } catch (err) {
          alert("Erro ao processar imagem.");
      }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-in fade-in px-4 sm:px-0">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-8 md:p-12 text-white relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-6 sm:p-12 opacity-10">
              <ShieldCheckIcon size={100} className="sm:w-[200px] sm:h-[200px]"/>
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-4 sm:gap-8">
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl sm:rounded-[2.5rem] border-4 border-white/20 overflow-hidden bg-white/10 flex items-center justify-center backdrop-blur-md touch-target">
                      {profilePhoto ? (
                          <img src={profilePhoto} className="w-full h-full object-cover" alt="Avatar" />
                      ) : (
                          <span className="text-2xl sm:text-4xl font-black">{safeFirstChar(name)}</span>
                      )}
                  </div>
                  <div className="absolute inset-0 bg-black/40 rounded-2xl sm:rounded-[2.5rem] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                      <Camera size={20} className="sm:w-[24px] sm:h-[24px]"/>
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoSelect} aria-label="Selecionar arquivo" />
              </div>
              <div className="text-center md:text-left flex-1 min-w-0">
                  <h2 className="text-2xl sm:text-4xl font-black tracking-tighter break-words">{name || 'Seu Nome'}</h2>
                  <p className="text-indigo-100 opacity-70 font-bold uppercase tracking-[0.2em] text-xs mt-2 flex items-center justify-center md:justify-start gap-2 flex-wrap">
                      <Shield size={14}/> Nível: {currentUser.role}
                  </p>
                  <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-4 sm:mt-6">
                      <button onClick={() => requestAndSaveToken(currentUser.id)} className="button-responsive bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 flex items-center gap-2">
                          <BellRing size={16}/> <span className="hidden sm:inline">Notificações</span>
                      </button>
                      <button onClick={onLogout} className="button-responsive bg-red-500/20 hover:bg-red-500/40 backdrop-blur-md border border-red-500/30 flex items-center gap-2">
                          <LogOut size={16}/> <span className="hidden sm:inline">Sair</span>
                      </button>
                  </div>
              </div>
          </div>
      </div>

      {message && (
          <div className={`p-4 rounded-2xl border flex items-center gap-3 animate-in slide-in-from-top-4 ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-red-500/10 border-red-500/30 text-red-500'}`}>
              {message.type === 'success' ? <CheckCircle size={20}/> : <AlertTriangle size={20}/>}
              <span className="text-sm font-bold">{message.text}</span>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
          <div className="space-y-6">
             <div className="card-responsive dark:text-slate-100">
                <h3 className="font-black text-gray-700 dark:text-gray-300 mb-6 flex items-center gap-2 border-b dark:border-slate-800 pb-2 uppercase text-xs tracking-widest min-w-0">
                    <Smartphone className="text-indigo-500 flex-shrink-0" size={16} /> <span className="truncate">Contato</span>
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">WhatsApp</label>
                        <div className="relative">
                            <Phone size={16} className="absolute left-3 top-3.5 text-gray-500 flex-shrink-0" />
                            <input className="w-full pl-10 pr-4 py-2.5 md:py-3 bg-slate-100 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-xl outline-none text-gray-900 dark:text-slate-100 focus:ring focus:ring-indigo-400" value={tel} onChange={e => setTel(e.target.value)} placeholder="55..." />
                        </div>
                    </div>
                </div>
             </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="card-responsive dark:text-slate-100">
                <h3 className="font-black text-gray-700 dark:text-gray-300 mb-6 flex items-center gap-2 border-b dark:border-slate-800 pb-2 uppercase text-xs tracking-widest min-w-0">
                    <UserIcon className="text-indigo-500 flex-shrink-0" size={16} /> <span className="truncate">Identidade</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Nome Completo</label>
                        <input className="w-full p-2.5 md:p-3 bg-slate-100 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-xl outline-none text-gray-900 dark:text-slate-100 focus:ring focus:ring-indigo-400" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Usuário</label>
                        <input className="w-full p-2.5 md:p-3 bg-slate-100 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-xl outline-none font-mono text-gray-900 dark:text-slate-100 focus:ring focus:ring-indigo-400 break-all" value={username} onChange={e => setUsername(e.target.value)} />
                    </div>
                </div>
            </div>

            <div className="card-responsive dark:text-slate-100">
                <h3 className="font-black text-gray-700 dark:text-gray-300 mb-6 flex items-center gap-2 border-b dark:border-slate-800 pb-2 uppercase text-xs tracking-widest min-w-0">
                    <LayoutDashboard className="text-indigo-500 flex-shrink-0" size={16} /> <span className="truncate">Inicialização</span>
                </h3>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Módulo principal (Auto-open):</label>
                    <select 
                        className="w-full p-2.5 md:p-4 border rounded-2xl dark:bg-slate-950 dark:border-slate-700 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        value={defaultModule}
                        onChange={e => setDefaultModule(e.target.value)}
                    >
                        <option value="home">Dashboard Geral (Menu)</option>
                        {SYSTEM_MODULES.filter(m => canAccess(currentUser, m.key) && !hiddenModules[m.key]).map(m => (
                            <option key={m.key} value={m.route}>{m.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="card-responsive dark:text-slate-100">
                <h3 className="font-black text-gray-700 dark:text-gray-300 mb-6 flex items-center gap-2 border-b dark:border-slate-800 pb-2 uppercase text-xs tracking-widest min-w-0">
                    <LayoutDashboard className="text-indigo-500 flex-shrink-0" size={16} /> <span className="truncate">Metas</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-black text-gray-600 dark:text-gray-300 uppercase mb-1 tracking-widest">Cestas Básicas (Qtd)</label>
                        <input
                            type="number"
                            min={0}
                            className="w-full p-2.5 md:p-3 bg-slate-100 dark:bg-slate-950 border-2 border-gray-300 dark:border-slate-700 rounded-xl focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 text-gray-900 dark:text-slate-100 transition-all"
                            value={salesTargets.basic === 0 ? '' : salesTargets.basic}
                            onChange={e => setSalesTargets(prev => ({ ...prev, basic: parseNumericInput(e.target.value) }))}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-600 dark:text-gray-300 uppercase mb-1 tracking-widest">Cestas de Natal (Qtd)</label>
                        <input
                            type="number"
                            min={0}
                            className="w-full p-2.5 md:p-3 bg-slate-100 dark:bg-slate-950 border-2 border-gray-300 dark:border-slate-700 rounded-xl focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 text-gray-900 dark:text-slate-100 transition-all"
                            value={salesTargets.natal === 0 ? '' : salesTargets.natal}
                            onChange={e => setSalesTargets(prev => ({ ...prev, natal: parseNumericInput(e.target.value) }))}
                        />
                    </div>
                </div>
                <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-3">A meta de cestas básicas alimenta o indicador de campanha por margem baixa.</p>
            </div>

            <div className="card-responsive dark:text-slate-100">
                <h3 className="font-black text-gray-700 dark:text-gray-300 mb-6 flex items-center gap-2 border-b dark:border-slate-800 pb-2 uppercase text-xs tracking-widest min-w-0">
                    <ShieldAlert className="text-indigo-500 flex-shrink-0" size={16} /> <span className="truncate">Ocultar</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SYSTEM_MODULES.filter(m => canAccess(currentUser, m.key)).map(mod => {
                        const isHidden = hiddenModules[mod.key];
                        const Icon = mod.icon || LayoutDashboard;
                        return (
                            <button
                                key={mod.key}
                                type="button"
                                onClick={() => setHiddenModules(prev => ({ ...prev, [mod.key]: !prev[mod.key] }))}
                                className={`flex items-center gap-3 p-2.5 sm:p-3 rounded-xl border text-left transition-all active:scale-95 active:shadow-lg cursor-pointer hover:shadow-md touch-target ${isHidden ? 'bg-amber-50/30 border-amber-300 shadow-sm' : 'bg-slate-50 dark:bg-slate-950 border-gray-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            >
                                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-white transition-transform flex-shrink-0 ${isHidden ? 'bg-amber-500 scale-110' : mod.color}`}>
                                    <Icon size={14} className="sm:w-[16px] sm:h-[16px]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-[10px] font-black uppercase transition-colors truncate ${isHidden ? 'text-amber-600' : 'text-gray-500'}`}>{mod.label}</p>
                                    <p className={`text-[9px] transition-colors ${isHidden ? 'text-amber-500' : 'text-gray-400'}`}>{isHidden ? 'Oculto' : 'Visível'}</p>
                                </div>
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all flex-shrink-0 ${isHidden ? 'bg-amber-500 border-amber-500 text-white scale-100' : 'border-gray-300 scale-95'}`}>
                                    {isHidden && <Check size={12} />}
                                </div>
                            </button>
                        );
                    })}
                </div>
                <p className="text-[11px] text-gray-500 mt-3">Ocultar não altera segurança nem regras. Apenas remove do menu.</p>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
                <button onClick={handleSave} disabled={isSaving} className="button-responsive bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-xl shadow-indigo-900/20 flex items-center justify-center gap-2">
                    {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                    <span className="hidden sm:inline">Salvar Perfil</span>
                    <span className="sm:hidden">Salvar</span>
                </button>
            </div>
          </div>
      </div>
    </div>
  );
};

export default UserProfile;
