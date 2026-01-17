# ETAPA 4 - Checklist de Deploy e Validação (Online-First)

Este checklist fecha a estabilização **Firestore/Firebase** e o comportamento **online-first** (cache local + fila de sincronização), mantendo o app com **apenas Vendas360 + Financeiro360 + SettingsHub + DEV/Logs/Chat**.

## 1) Variáveis de ambiente (Vite)
Defina no ambiente (Vercel/CI/local) as variáveis abaixo (não use placeholders):

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID` (opcional)

Opcional (AppCheck):
- `VITE_FIREBASE_APPCHECK_RECAPTCHA_KEY` (somente se AppCheck estiver habilitado no projeto)

## 2) Deploy Firestore (rules + indexes)
Comandos:

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

## 3) Deploy Functions (somente escopo do recorte)

```bash
firebase deploy --only functions
```

## 4) Teste rápido - Online-first (cenários mínimos)

### 4.1 Escrita offline (fila)
1. Abra o app.
2. Desconecte a internet.
3. Faça uma ação de escrita:
   - criar/editar venda
   - criar task de vendas
   - marcar transação como conciliada
   - enviar mensagem no chat
   - abrir/atualizar ticket
4. Recarregue a página (ainda offline) e confirme que os dados persistem (IDB).

### 4.2 Retorno online (sync automático)
1. Volte a internet.
2. Aguarde ~10s.
3. Confirme:
   - sync_worker marcou entradas como COMPLETED
   - dados aparecem no Firestore

### 4.3 Proteção contra overwrite (server refresh)
1. Offline: edite uma venda existente.
2. Volte online e force refresh (abrir dashboard / trocar módulo).
3. Confirme que a venda **não é sobrescrita** pelo pull do servidor enquanto estiver pendente na fila.

## 5) Observação (persistência Firestore)
O `services/firebase.ts` inicializa Firestore com cache persistente multi-tab.
Se o navegador negar/der erro, o app faz fallback para `getFirestore(app)` para **não travar no boot**.
