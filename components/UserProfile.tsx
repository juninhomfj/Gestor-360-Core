import React, { useState, useRef } from 'react';
import { User, UserPermissions, SalesTargets } from '../types';
import { updateUser, deactivateUser } from '../services/auth';
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
      const updateData = {
        name: name.trim(),
        username: username.trim(),
        tel: tel.trim(),
        profilePhoto: profilePhoto,
        contactVisibility: contactVisibility,
        hiddenModules: hiddenModules,
        salesTargets: salesTargets,
        prefs: {
            ...currentUser.prefs,
            defaultModule: defaultModule // Grava apenas no canônico
        }
      };

      await updateUser(currentUser.id, updateData);
      
      const updatedUser: User = { 
        ...currentUser, 
        ...updateData 
      } as User;

      localStorage.setItem('sys_session_v1', JSON.stringify(updatedUser));
      onUpdate(updatedUser);
      
      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error("Erro ao salvar perfil:", error);
      setMessage({ type: 'error', text: 'Erro ao salvar alterações.' });
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
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-12 opacity-10">
              <ShieldCheckIcon size={200}/>
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <div className="w-32 h-32 rounded-[2.5rem] border-4 border-white/20 overflow-hidden bg-white/10 flex items-center justify-center backdrop-blur-md">
                      {profilePhoto ? (
                          <img src={profilePhoto} className="w-full h-full object-cover" alt="Avatar" />
                      ) : (
                          <span className="text-4xl font-black">{safeFirstChar(name)}</span>
                      )}
                  </div>
                  <div className="absolute inset-0 bg-black/40 rounded-[2.5rem] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                      <Camera size={24} />
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoSelect} />
              </div>
              <div className="text-center md:text-left flex-1">
                  <h2 className="text-4xl font-black tracking-tighter">{name || 'Seu Nome'}</h2>
                  <p className="text-indigo-100 opacity-70 font-bold uppercase tracking-[0.2em] text-xs mt-2 flex items-center justify-center md:justify-start gap-2">
                      <Shield size={14}/> Nível: {currentUser.role}
                  </p>
                  <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-6">
                      <button onClick={() => requestAndSaveToken(currentUser.id)} className="bg-white/10 hover:bg-white/20 backdrop-blur-md px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-white/10">
                          <BellRing size={16}/> Notificações
                      </button>
                      <button onClick={onLogout} className="bg-red-500/20 hover:bg-red-500/40 backdrop-blur-md px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-red-500/30">
                          <LogOut size={16}/> Sair
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6">
             <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
                <h3 className="font-black text-gray-700 dark:text-gray-300 mb-6 flex items-center gap-2 border-b dark:border-slate-800 pb-2 uppercase text-xs tracking-widest">
                    <Smartphone className="text-indigo-500" size={16} /> Contato
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">WhatsApp</label>
                        <div className="relative">
                            <Phone size={16} className="absolute left-3 top-3.5 text-gray-500" />
                            <input className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-xl outline-none" value={tel} onChange={e => setTel(e.target.value)} placeholder="55..." />
                        </div>
                    </div>
                </div>
             </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
                <h3 className="font-black text-gray-700 dark:text-gray-300 mb-6 flex items-center gap-2 border-b dark:border-slate-800 pb-2 uppercase text-xs tracking-widest">
                    <UserIcon className="text-indigo-500" size={16} /> Identidade
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Nome Completo</label>
                        <input className="w-full p-3 bg-slate-100 dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-xl outline-none" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Usuário</label>
                        <input className="w-full p-3 bg-slate-100 dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-xl outline-none font-mono" value={username} onChange={e => setUsername(e.target.value)} />
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
                <h3 className="font-black text-gray-700 dark:text-gray-300 mb-6 flex items-center gap-2 border-b dark:border-slate-800 pb-2 uppercase text-xs tracking-widest">
                    <LayoutDashboard className="text-indigo-500" size={16} /> Inicialização Automática
                </h3>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Módulo principal (Auto-open):</label>
                    <select 
                        className="w-full p-4 border rounded-2xl dark:bg-slate-950 dark:border-slate-700 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
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

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
                <h3 className="font-black text-gray-700 dark:text-gray-300 mb-6 flex items-center gap-2 border-b dark:border-slate-800 pb-2 uppercase text-xs tracking-widest">
                    <LayoutDashboard className="text-indigo-500" size={16} /> Metas Mensais (Campanhas)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Cestas Básicas (Qtd)</label>
                        <input
                            type="number"
                            min={0}
                            className="w-full p-3 bg-slate-100 dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-xl outline-none"
                            value={salesTargets.basic}
                            onChange={e => setSalesTargets(prev => ({ ...prev, basic: Number(e.target.value) }))}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Cestas de Natal (Qtd)</label>
                        <input
                            type="number"
                            min={0}
                            className="w-full p-3 bg-slate-100 dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-xl outline-none"
                            value={salesTargets.natal}
                            onChange={e => setSalesTargets(prev => ({ ...prev, natal: Number(e.target.value) }))}
                        />
                    </div>
                </div>
                <p className="text-[11px] text-gray-500 mt-3">A meta de cestas básicas alimenta o indicador de campanha por margem baixa.</p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
                <h3 className="font-black text-gray-700 dark:text-gray-300 mb-6 flex items-center gap-2 border-b dark:border-slate-800 pb-2 uppercase text-xs tracking-widest">
                    <ShieldAlert className="text-indigo-500" size={16} /> Ocultar Módulos (UI)
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
                                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${isHidden ? 'bg-amber-50/30 border-amber-300' : 'bg-slate-50 dark:bg-slate-950 border-gray-200 dark:border-slate-700'}`}
                            >
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white ${isHidden ? 'bg-amber-500' : mod.color}`}>
                                    <Icon size={16} />
                                </div>
                                <div className="flex-1">
                                    <p className={`text-[10px] font-black uppercase ${isHidden ? 'text-amber-600' : 'text-gray-500'}`}>{mod.label}</p>
                                    <p className="text-[9px] text-gray-400">{isHidden ? 'Oculto' : 'Visível'}</p>
                                </div>
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${isHidden ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-300'}`}>
                                    {isHidden && <Check size={12} />}
                                </div>
                            </button>
                        );
                    })}
                </div>
                <p className="text-[11px] text-gray-500 mt-3">Ocultar não altera segurança nem regras. Apenas remove do menu.</p>
            </div>

            <div className="flex justify-end gap-4">
                <button onClick={handleSave} disabled={isSaving} className="px-10 py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl shadow-indigo-900/20 transition-all flex items-center gap-2 uppercase text-xs tracking-widest">
                    {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                    Salvar Perfil
                </button>
            </div>
          </div>
      </div>
    </div>
  );
};

export default UserProfile;