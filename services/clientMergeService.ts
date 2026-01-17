
import { dbGetAll, dbPut, enqueueSync } from '../storage/db';
import { saveSales } from './logic';
import { Client, Sale } from '../types';
import { Logger } from './logger';

export interface MergePreviewResult {
    salesAffected: number;
    masterName: string;
    duplicatesCount: number;
}

export const previewClientMerge = async (
    masterId: string, 
    duplicateIds: string[]
): Promise<MergePreviewResult> => {
    const allSales = await dbGetAll('sales');
    const allClients = await dbGetAll('clients');
    const duplicateClients = allClients.filter(c => duplicateIds.includes(c.id));
    const duplicateNames = duplicateClients.map(c => c.name.toLowerCase());

    const salesCount = allSales.filter(s => {
        /* Fix: Changed 'sale.deleted' to 's.deleted' as 'sale' was undefined in this scope */
        if (s.deleted) return false;
        if (s.clientId && duplicateIds.includes(s.clientId)) return true;
        if (!s.clientId && duplicateNames.includes(s.client.toLowerCase())) return true;
        return false;
    }).length;

    const master = allClients.find(c => c.id === masterId);

    return {
        salesAffected: salesCount,
        masterName: master?.name || 'Desconhecido',
        duplicatesCount: duplicateIds.length
    };
};

export const executeClientMerge = async (
    masterId: string, 
    duplicateIds: string[], 
    approvedName: string,
    currentUser: { id: string, name: string }
): Promise<boolean> => {
    
    const allSalesSnapshot = await dbGetAll('sales');
    
    try {
        const allClients = await dbGetAll('clients');
        const masterClient = allClients.find(c => c.id === masterId);
        if (!masterClient) throw new Error("Cliente mestre não encontrado.");

        const duplicateClients = allClients.filter(c => duplicateIds.includes(c.id));
        const duplicateNames = duplicateClients.map(c => c.name);

        let salesUpdatedCount = 0;
        const updatedSales: Sale[] = [];

        for (const sale of allSalesSnapshot) {
            if (sale.deleted) continue;

            let shouldUpdate = false;
            if (sale.clientId && duplicateIds.includes(sale.clientId)) {
                shouldUpdate = true;
            } else if (!sale.clientId && duplicateNames.some(n => n.toLowerCase() === sale.client.toLowerCase())) {
                shouldUpdate = true;
            }

            if (shouldUpdate) {
                updatedSales.push({
                    ...sale,
                    clientId: masterId, 
                    client: approvedName, 
                    updatedAt: new Date().toISOString()
                } as any);
                salesUpdatedCount++;
            }
        }

        if (updatedSales.length > 0) {
            await saveSales(updatedSales);
        }

        const updatedMaster: Client = {
            ...masterClient,
            name: approvedName,
            updatedAt: new Date().toISOString()
        };
        await dbPut('clients', updatedMaster);
        await enqueueSync({ table: 'clients', type: 'UPDATE', data: updatedMaster, rowId: updatedMaster.id } as any);

        for (const dup of duplicateClients) {
            const deletedDup: Client = {
                ...dup,
                deleted: true,
                deletedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                notes: (dup.notes ? dup.notes + "\n" : "") + `[MESCLADO] Mesclado em ${updatedMaster.id} por ${currentUser.name}`
            };
            await dbPut('clients', deletedDup);
            await enqueueSync({ table: 'clients', type: 'UPDATE', data: deletedDup, rowId: deletedDup.id } as any);
        }

        Logger.info(`Mescla de clientes executada por ${currentUser.name}`, {
            masterId,
            duplicates: duplicateIds,
            salesMoved: salesUpdatedCount
        });

        return true;

    } catch (e: any) {
        Logger.error("Falha na mescla de clientes", { error: e.message });
        throw e;
    }
};
