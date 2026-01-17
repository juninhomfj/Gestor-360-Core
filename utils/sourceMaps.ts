
export const SOURCE_FILES = {
    'types.ts': `export interface User {
    id: string;
    username: string; // Adicionado p/ Identidade Única
    role: 'DEV' | 'ADMIN' | 'USER';
    isActive: boolean;
    modules: UserModules;
}`,
    'services/logic.ts': `// Controle de Acesso Centralizado
export const canAccess = (user: User | null, feature: string): boolean => {
    if (!user || !user.isActive) return false;
    if (user.role === 'DEV') return true; 
    return !!(user.modules as any)[feature];
};

// Bootstrap de Produção
export const bootstrapProductionData = async () => {
    // Garante Tabelas e Dados Iniciais no Firestore
};`,
    'services/auth.ts': `export const reloadSession = async () => {
    // Detecta sessão Firebase Auth
    // Recupera Perfil Firestore
    // AUTO-HEALING: Se perfil não existir, cria como DEV.
};`,
    'components/Layout.tsx': `const hasAccess = (mod: string) => {
    // Respeita canAccess da logic.ts
    return canAccess(currentUser, mod);
};`,
    'DOCUMENTATION.md': `# Gestor360 v2.5.0 - Firebase Native Architecture

Este sistema utiliza escrita direta no Cloud Firestore (AWAIT) para consistência organizacional.

## Segurança
- Hierarquia DEV > ADMIN > USER com RLS.
- Bypass de bloqueios de UI para perfil DEV (Root).`
};
