import { ShoppingCart, PieChart, Shield } from 'lucide-react';
import { AppMode, SystemConfig, UserPermissions } from '../types';

export interface ModuleInfo {
    key: keyof UserPermissions;
    label: string;
    description: string;
    icon: any;
    route: string;
    appMode: AppMode;
    color: string;
    isBeta?: boolean;
}

export const isModuleEnabled = (
    modulesConfig: SystemConfig['modules'] | undefined,
    moduleKey: keyof UserPermissions,
    isDev = false
) => {
    if (isDev) return true;
    return modulesConfig?.[moduleKey] ?? true;
};

/**
 * Catálogo enxuto (Vendas360 + Finanças360) + Engenharia (DEV)
 * OBS: Settings/Chat/Logs permanecem como áreas transversais, não como "módulo" principal.
 */
export const SYSTEM_MODULES: ModuleInfo[] = [
    {
        key: 'sales',
        label: 'Vendas 360',
        description: 'Gestão de pedidos, comissões e faturamento comercial.',
        icon: ShoppingCart,
        route: 'sales',
        appMode: 'SALES',
        color: 'bg-emerald-500'
    },
    {
        key: 'finance',
        label: 'Finanças 360',
        description: 'Controle de caixa, contas, cartões e fluxo de caixa.',
        icon: PieChart,
        route: 'fin_dashboard',
        appMode: 'FINANCE',
        color: 'bg-blue-500'
    },
    {
        key: 'dev',
        label: 'Engenharia (Root)',
        description: 'Diagnóstico, inspeção e auditoria de dados/sync.',
        icon: Shield,
        route: 'dev_roadmap',
        appMode: 'SALES',
        color: 'bg-purple-700'
    }
];
