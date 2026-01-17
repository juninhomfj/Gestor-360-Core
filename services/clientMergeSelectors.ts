
import { Client, ClientTransferRequest } from '../types';
import { dbGetAll } from '../storage/db';
import { isClientEligibleForMerge } from './clientMergeRules';

export interface ClientDuplicateSuggestion {
    id: string;
    masterCandidate: Client;
    possibles: Client[];
    scoreMap: Record<string, number>;
}

// Utilitário Levenshtein simples (sem dependências externas)
const levenshteinDistance = (a: string, b: string): number => {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
};

const normalizeName = (name: string): string => {
    return name
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[^a-z0-9\s]/g, "") // Remove pontuação
        .replace(/\s+/g, " ") // Collapse spaces
        .replace(/\b(ltda|me|eireli|sa|s\/a|limitada)\b/g, "") // Remove sufixos jurídicos
        .trim();
};

export const getPossibleDuplicates = async (userId: string): Promise<ClientDuplicateSuggestion[]> => {
    const allClients = await dbGetAll('clients');
    const allRequests = await dbGetAll('client_transfer_requests');
    const pendingRequests = allRequests.filter(r => r.status === 'PENDING');

    // 1. Filtrar elegíveis
    const eligibleClients = allClients.filter(c => isClientEligibleForMerge(c, userId, pendingRequests));
    
    // Se tiver menos de 2 clientes, impossível haver duplicatas
    if (eligibleClients.length < 2) return [];

    const suggestions: ClientDuplicateSuggestion[] = [];
    const processedIds = new Set<string>();

    // 2. Análise O(n^2/2) - Comparação par a par otimizada
    // Em produção real, usaríamos indexing ou buckets, mas para IndexedDB local isso é aceitável até ~2k clientes
    for (let i = 0; i < eligibleClients.length; i++) {
        const clientA = eligibleClients[i];
        if (processedIds.has(clientA.id)) continue;

        const normA = normalizeName(clientA.name);
        const group: Client[] = [];
        const scores: Record<string, number> = {};

        for (let j = i + 1; j < eligibleClients.length; j++) {
            const clientB = eligibleClients[j];
            if (processedIds.has(clientB.id)) continue;

            const normB = normalizeName(clientB.name);
            let score = 0;

            // Critérios de Similaridade
            if (normA === normB) {
                score = 100;
            } else if (normA.includes(normB) || normB.includes(normA)) {
                score = 70; // Substring
            } else {
                const dist = levenshteinDistance(normA, normB);
                if (dist <= 2 && normA.length > 3) {
                    score = 80; // Erro de digitação leve
                } else if (dist <= 4 && normA.length > 8) {
                    score = 60; // Erro em nome longo
                }
            }

            if (score >= 60) {
                group.push(clientB);
                scores[clientB.id] = score;
            }
        }

        if (group.length > 0) {
            // Marca todos como processados para não gerar grupos redundantes
            processedIds.add(clientA.id);
            group.forEach(c => processedIds.add(c.id));

            suggestions.push({
                id: crypto.randomUUID(),
                masterCandidate: clientA,
                possibles: group,
                scoreMap: scores
            });
        }
    }

    return suggestions;
};
