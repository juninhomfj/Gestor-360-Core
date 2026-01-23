# 🔧 Recomendações de Resiliência

## 1. Adicionar Hardcap Timeout em Bootstrap

**Problema**: `Promise.all` em `loadDataForUser` pode pender indefinidamente se qualquer query IndexedDB/Firestore travar.

**Arquivo**: [App.tsx:495-542](App.tsx#L495-L542)

**Patch Recomendado**:
```typescript
const handleLoginSuccess = async (user: User) => {
    try {
        console.warn("[Bootstrap] Iniciando...", { uid: user.uid });

        // ← NOVO: Timeout de 15 segundos
        const bootTimeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Bootstrap timeout: 15s')), 15000)
        );

        await Promise.race([
            Promise.all([
                bootstrapProductionData(),
                loadDataForUser()
            ]),
            bootTimeout
        ]);

        // ... resto do código ...
    } catch (e) {
        // Agora captura timeouts!
        Logger.error("[Bootstrap] Falha crítica", { 
            code: e?.code, 
            message: e?.message,
            timeout: e?.message?.includes('timeout')
        });
        // Fallback: app inicia sem dados
        setAuthView('APP');
        setLoading(false);
    } finally {
        console.warn("[Bootstrap] Finalizado.");
        setLoading(false);
    }
};
```

---

## 2. Remover Catch-Empty Blocks

### Localização de todos os `catch {}`:

| Arquivo | Linha | Contexto | Ação |
|---------|-------|---------|------|
| [App.tsx](App.tsx#L186) | 186 | Persistência DB | Log via Logger.warn |
| [App.tsx](App.tsx#L410) | 410 | bootNotifications | Log via Logger.info |
| [App.tsx](App.tsx#L451) | 451 | Notificações de tags | Log via Logger.warn |
| [App.tsx](App.tsx#L478) | 478 | Notificações de chat | Log via Logger.warn |
| [App.tsx](App.tsx#L500) | 500 | Service Worker register | Log via Logger.info (non-critical) |
| [services/logic.ts](services/logic.ts#L1412) | 1412 | bootstrapProductionData | Log via Logger.error |

### Exemplo de Refatoração:

**ANTES** (App.tsx:500):
```typescript
navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(() => {});
```

**DEPOIS**:
```typescript
navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(e => {
    Logger.info("[Bootstrap] Service Worker registration failed (non-critical)", {
        message: e instanceof Error ? e.message : String(e)
    });
});
```

---

## 3. Adicionar Observability ao Login Flow

**Arquivo**: [App.tsx:321-367](App.tsx#L321-L367)

**Patch Recomendado**:
```typescript
const startAuthWatch = async () => {
    try {
        // ... código existente ...
        unsubscribe = watchAuthChanges(async (sessionUser) => {
            // ← NOVO: Log síncrono
            console.debug("[Auth] Callback fired", {
                timestamp: new Date().toISOString(),
                sessionUid: sessionUser?.uid || null,
                lastUid: lastUidRef.current,
                willReturn: lastUidRef.current === sessionUser?.uid,
                isMounted
            });

            if (!isMounted) {
                console.debug("[Auth] Callback skipped: unmounted");
                return;
            }

            // ... resto do código ...
        });
    } catch (e: any) {
        Logger.error("[Auth] Watch setup failed", { message: e?.message, code: e?.code });
        setAuthError("Erro na conexão Cloud Firestore.");
        setAuthView('ERROR');
        setLoading(false);
    }
};
```

---

## 4. Validar React.StrictMode em Production Builds

**Problema**: StrictMode só executa efeitos duplos em **development**. Deve ser desabilitado em production.

**Arquivo**: [index.tsx](index.tsx#L14)

**Recomendação**:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

const isDev = process.env.NODE_ENV === 'development';

ReactDOM.createRoot(document.getElementById('root')!).render(
    isDev ? (
        <React.StrictMode>
            <App />
        </React.StrictMode>
    ) : (
        <App />
    )
);
```

---

## 5. Adicionar Health Check para Bootstrap

**Arquivo**: [App.tsx:525-540](App.tsx#L525-L540)

**Patch Recomendado**:
```typescript
// Após setAuthView('APP'), antes de finalizar:
const healthCheck = {
    salesLoaded: sales.length > 0 || getStoredSales() !== null,
    clientsLoaded: clients.length > 0 || getClients() !== null,
    configLoaded: currentUser !== null,
    timestamp: new Date().toISOString(),
    uid: user.uid
};

if (!healthCheck.salesLoaded) {
    Logger.warn("[Bootstrap] Health Check: Sales não carregadas. Usando cache.", healthCheck);
}

Logger.info("[Bootstrap] Health Check completo", healthCheck);
```

---

## 6. Monitoramento Recomendado (7 dias pós-deploy)

- [ ] Firebase Crashlytics: Zero crashes no login flow
- [ ] Firebase Performance: `handleLoginSuccess` < 5s (p95)
- [ ] Custom Logger: Verificar `[Bootstrap] Finalizado` em 100% dos logins
- [ ] Service Worker: Registration success rate > 99%
- [ ] IndexedDB: Cache hit rate > 90%

---

## Checklist de Implementação

- [x] Patch principal aplicado (setLoading em line 342)
- [ ] Timeout 15s em Promise.all
- [ ] Remover catch-empty blocks (5 no App.tsx + 1 em logic.ts)
- [ ] Adicionar observability (console.debug em watchAuthChanges)
- [ ] Condicionar React.StrictMode por NODE_ENV
- [ ] Health check após bootstrap
- [ ] Teste em staging com StrictMode habilitado
- [ ] Deploy em production
- [ ] Monitorar 7 dias
