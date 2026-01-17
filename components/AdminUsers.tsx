import React, { useState, useEffect } from 'react';
import { User, UserRole, UserPermissions, UserStatus } from '../types';
import { SYSTEM_MODULES } from '../config/modulesCatalog';
import { listUsers, createUser, updateUser, resendInvitation } from '../services/auth';
import { atomicClearUserTables } from '../services/logic';
import { Plus, Shield, Edit2, Check, Loader2, Send } from 'lucide-react';
import InvitationSentModal from './InvitationSentModal';
import { safeFirstChar, safeShort } from '../utils/stringUtils';

interface AdminUsersProps {
  currentUser: User;
}

// Inicializador dinâmico
const createDefaultPermissions = () => {
    const mods: any = {};
    SYSTEM_MODULES.forEach(m => mods[m.key] = false);
    mods.sales = true;
    mods.finance = true;
    return mods as UserPermissions;
};

const DEFAULT_PERMISSIONS = createDefaultPermissions();
const createDefaultHiddenModules = () => {
    const mods: any = {};
    SYSTEM_MODULES.forEach(m => mods[m.key] = false);
    return mods as UserPermissions;
};

const DEFAULT_HIDDEN_MODULES = createDefaultHiddenModules();

const RESETTABLE_TABLES = ["sales", "sales_tasks", "transactions", "accounts", "clients", "receivables", "goals", "cards"];

const AdminUsers: React.FC<AdminUsersProps> = ({ currentUser }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("USER");
  const [newPermissions, setNewPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const [newHiddenModules, setNewHiddenModules] = useState<UserPermissions>(DEFAULT_HIDDEN_MODULES);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  const statusLabel = (status?: UserStatus) => {
      switch (status) {
          case 'ACTIVE':
              return 'ATIVO';
          case 'INACTIVE':
              return 'INATIVO';
          case 'PENDING':
          default:
              return 'PENDENTE';
      }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (e) {
      console.error("Erro ao carregar usuários:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (u: any) => {
      setEditingId(u.id);
      setNewName(u.name || "");
      setNewEmail(u.email || "");
      setNewRole(u.role || "USER");
      setNewPermissions({ ...DEFAULT_PERMISSIONS, ...(u.permissions || u.modules || {}) });
      setNewHiddenModules({ ...DEFAULT_HIDDEN_MODULES, ...(u.hiddenModules || {}) });
      setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!newName || !newEmail) return;
    try {
        if (editingId) {
            await updateUser(editingId, { 
                name: newName, 
                role: newRole, 
                permissions: newPermissions,
                modules: newPermissions,
                hiddenModules: newHiddenModules
            } as any);
        } else {
            await createUser(currentUser.id, { 
                name: newName, 
                email: newEmail, 
                role: newRole, 
                modules_config: newPermissions,
                hiddenModules: newHiddenModules
            });
            setInviteEmail(newEmail);
            setShowInviteModal(true);
        }
        setIsFormOpen(false);
        setEditingId(null);
        setNewName("");
        setNewEmail("");
        setNewRole("USER");
        setNewPermissions(DEFAULT_PERMISSIONS);
        setNewHiddenModules(DEFAULT_HIDDEN_MODULES);
        loadUsers();
    } catch (e) {
        alert("Erro ao salvar usuário.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-20">
        <div className="flex justify-between items-center">
            <div>
                <h2 className="text-2xl font-black flex items-center gap-2">
                    <Shield className="text-indigo-500" /> Governança Cloud
                </h2>
                <p className="text-sm text-gray-500">Gestão centralizada de acessos e autoridade.</p>
            </div>
            <button 
                onClick={() => { setEditingId(null); setNewName(""); setNewEmail(""); setNewRole("USER"); setNewPermissions(DEFAULT_PERMISSIONS); setNewHiddenModules(DEFAULT_HIDDEN_MODULES); setIsFormOpen(true); }}
                className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-900/20 active:scale-95 transition-all flex items-center gap-2"
            >
                <Plus size={18}/> Novo Usuário
            </button>
        </div>

        {isFormOpen && (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border-2 border-indigo-500/20 animate-in zoom-in-95 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Nome do Usuário</label>
                        <input className="w-full p-4 rounded-2xl border dark:bg-slate-950 dark:border-slate-800 outline-none focus:ring-2 ring-indigo-500" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: João Silva" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">E-mail Corporativo</label>
                        <input className="w-full p-4 rounded-2xl border dark:bg-slate-950 dark:border-slate-800 outline-none focus:ring-2 ring-indigo-500 disabled:opacity-50" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="joao@empresa.com" disabled={!!editingId} />
                    </div>
                </div>

                <div className="p-6 bg-gray-50 dark:bg-slate-950/50 rounded-2xl border dark:border-slate-800">
                    <label className="block text-xs font-black text-gray-500 uppercase mb-6 tracking-widest">Nível de Autoridade</label>
                    <div className="flex gap-4 mb-10">
                        {['USER', 'ADMIN', 'DEV'].map((r) => (
                            <button key={r} onClick={() => setNewRole(r as any)} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border ${newRole === r ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl' : 'bg-white dark:bg-slate-900 text-gray-400 border-gray-200 dark:border-slate-800 text-gray-400'}`}>
                                {r}
                            </button>
                        ))}
                    </div>

                    <label className="block text-xs font-black text-gray-500 uppercase mb-6 tracking-widest">Controle de Módulos (Catalogo 360)</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {SYSTEM_MODULES.map((mod) => {
                            const isEnabled = newPermissions[mod.key];
                            return (
                                <button
                                    key={mod.key}
                                    type="button"
                                    onClick={() => setNewPermissions(prev => ({ ...prev, [mod.key]: !prev[mod.key] }))}
                                    className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${isEnabled ? 'bg-indigo-50/10 border-indigo-500' : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 opacity-60'}`}
                                >
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0 ${mod.color}`}>
                                        <mod.icon size={18} />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className={`text-[10px] font-black uppercase truncate ${isEnabled ? 'text-indigo-600' : 'text-gray-400'}`}>{mod.label}</p>
                                        <p className="text-[9px] text-gray-500 truncate">{isEnabled ? 'Habilitado' : 'Bloqueado'}</p>
                                    </div>
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${isEnabled ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300'}`}>
                                        {isEnabled && <Check size={12}/>}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <label className="block text-xs font-black text-gray-500 uppercase mb-6 tracking-widest mt-10">Ocultar Módulos na UI (não bloqueia regras)</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {SYSTEM_MODULES.map((mod) => {
                            const isHidden = newHiddenModules[mod.key];
                            return (
                                <button
                                    key={mod.key}
                                    type="button"
                                    onClick={() => setNewHiddenModules(prev => ({ ...prev, [mod.key]: !prev[mod.key] }))}
                                    className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${isHidden ? 'bg-amber-50/30 border-amber-400' : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800'}`}
                                >
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0 ${isHidden ? 'bg-amber-500' : mod.color}`}>
                                        <mod.icon size={18} />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className={`text-[10px] font-black uppercase truncate ${isHidden ? 'text-amber-600' : 'text-gray-400'}`}>{mod.label}</p>
                                        <p className="text-[9px] text-gray-500 truncate">{isHidden ? 'Oculto' : 'Visível'}</p>
                                    </div>
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${isHidden ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-300'}`}>
                                        {isHidden && <Check size={12}/>}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex gap-4 mt-8">
                    <button onClick={() => setIsFormOpen(false)} className="px-8 py-4 text-gray-500 font-bold uppercase text-[10px] tracking-widest">Cancelar</button>
                    <button onClick={handleSave} className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-900/20 active:scale-95 transition-all uppercase text-[10px] tracking-widest">
                        {editingId ? 'Salvar Alterações' : 'Criar Conta & Enviar Convite'}
                    </button>
                </div>
            </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-gray-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-[10px] font-black uppercase text-gray-400 tracking-widest bg-gray-50 dark:bg-slate-950/50 border-b dark:border-slate-800">
                        <tr>
                            <th className="p-6">Usuário</th>
                            <th className="p-6">Função</th>
                            <th className="p-6">Status</th>
                            <th className="p-6 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-800">
                        {users.map((u) => (
                            <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-all">
                                <td className="p-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-black text-xs">
                                            {safeFirstChar(u.name)}
                                        </div>
                                        <div>
                                            <p className="font-black text-gray-800 dark:text-white">{u.name}</p>
                                            <p className="text-[10px] text-gray-500">{u.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-6">
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest border ${u.role === 'DEV' ? 'bg-purple-100 text-purple-700 border-purple-200' : u.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                        {u.role}
                                    </span>
                                </td>
                                <td className="p-6">
                                    <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase ${u.userStatus === 'ACTIVE' ? 'text-emerald-500' : u.userStatus === 'INACTIVE' ? 'text-red-500' : 'text-amber-500'}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${u.userStatus === 'ACTIVE' ? 'bg-emerald-500' : u.userStatus === 'INACTIVE' ? 'bg-red-500' : 'bg-amber-500'}`} />
                                        {statusLabel(u.userStatus)}
                                    </span>
                                </td>
                                <td className="p-6">
                                    <div className="flex justify-center gap-2">
                                        <button onClick={() => handleOpenEdit(u)} className="p-2 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><Edit2 size={16}/></button>
                                        <button onClick={() => resendInvitation(u.email)} className="p-2 text-amber-500 hover:bg-amber-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><Send size={16}/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {loading && (
                            <tr><td colSpan={4} className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" size={32}/></td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {showInviteModal && <InvitationSentModal email={inviteEmail} onClose={() => setShowInviteModal(false)} />}
    </div>
  );
};

export default AdminUsers;
