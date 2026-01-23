# 🔴 Relatório de Bugs: Configurações + Comissão + Firebase

## Problema 1: Botões de "Ocultar Módulos" não clicáveis

### Localização
- Arquivo: [components/UserProfile.tsx](components/UserProfile.tsx#L235)
- Seção: "Ocultar Módulos (UI)"

### Análise
✅ Os botões **TÊM** onClick: `onClick={() => setHiddenModules(prev => ({ ...prev, [mod.key]: !prev[mod.key] }))}`

❌ Mas há um **problema de renderização**: o estado está sendo atualizado (setHiddenModules funciona), mas **a mudança visual não persiste**.

### Causa Raiz
O estado `hiddenModules` é atualizado localmente, mas:
1. **Não há feedback visual imediato** de qual botão foi clicado
2. **O círculo de checkbox não muda de cor/estilo** quando clicado
3. **O estado não é salvo automaticamente** - precisa clicar "Salvar Perfil" depois

### Solução Rápida (1-2 linhas)
Adicionar classe `active:scale-95` + verificar o estado visual:

```tsx
<button
    key={mod.key}
    type="button"
    onClick={() => setHiddenModules(prev => ({ ...prev, [mod.key]: !prev[mod.key] }))}
    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all active:scale-95 ${
        isHidden ? 'bg-amber-50/30 border-amber-300' : 'bg-slate-50 dark:bg-slate-950 border-gray-200 dark:border-slate-700'
    }`}
>
```

**Também adicionar este feedback**:
```tsx
<div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
    isHidden 
        ? 'bg-amber-500 border-amber-500 text-white scale-110' // ← scale visual
        : 'border-gray-300'
}`}>
    {isHidden && <Check size={12} />}
</div>
```

---

## Problema 2: SalesForm não calcula comissão

### Localização
- Arquivo: [services/logic.ts](services/logic.ts#L438) - função `computeCommissionValues`
- Arquivo: [components/SalesForm.tsx](components/SalesForm.tsx#L125) - useEffect de cálculo

### Análise

✅ **Código está correto**, mas está retornando `rateUsed: 0` porque **as regras estão vazias** (`rulesBasic` e `rulesNatal` chegam vazios no SalesForm).

**Fluxo:**
```
App.tsx [line 651]
  ↓
getStoredTable(ProductType.BASICA)
  ↓
Tenta buscar do Firestore com: query(collection(db, "commission_basic"), where("isActive", "==", true))
  ↓
❌ Firestore não retorna dados (Firebase problem #3)
  ↓
✅ Fallback para IndexedDB: dbGetAll("commission_basic")
  ↓
❌ IndexedDB também vazio
  ↓
return [] (array vazio)
  ↓
setRulesBasic([])
  ↓
SalesForm recebe rulesBasic=[]
  ↓
computeCommissionValues(..., [])
  ↓
Nenhuma rule encontrada → rateUsed = 0 → comissão = 0
```

### Causa Raiz
**O banco de dados de regras de comissão não foi sincronizado ou está vazio.**

### Verificação
Execute no console do browser:

```javascript
// Ver se regras existem em IndexedDB
const allRules = await db.getAll('commission_basic');
console.log('Rules em IndexedDB:', allRules);

// Ver se consegue conectar no Firestore
const snap = await firebase.firestore().collection('commission_basic').where('isActive', '==', true).getDocs();
console.log('Rules no Firestore:', snap.docs.map(d => d.data()));
```

### Solução
1. Abra [SettingsHub](components/SettingsHub.tsx) → aba "Comissões"
2. Configure as regras de comissão (Cesta Básica + Natal)
3. Clique "Salvar Tabela"
4. As regras serão sincronizadas para Firebase + IndexedDB
5. Volte ao SalesForm e tente novamente

---

## Problema 3: Firebase não desce informações

### Localização
- Arquivo: [services/logic.ts](services/logic.ts#L559) - `getStoredTable`
- Arquivo: [services/logic.ts](services/logic.ts#L652) - `loadDataForUser` fallback

### Análise

✅ **Código tem fallback robusto** (tenta Firestore, depois IndexedDB), mas o fallback indica que **Firestore não está respondendo corretamente**.

**Log de evidência** (do seu console):
```
[00:37:04] INFOCampaigns: índice ausente para orderBy; tentando fallback sem ordenação.
```

Isso significa:
- ✅ Firestore está respondendo (não é timeout total)
- ❌ **Mas está retornando VAZIO ou erro de índice**

### Verificação - 3 testes

**Teste 1: Índices Firestore**
```
Abra: https://console.firebase.google.com/v1/r/project/gestor360-app/firestore/indexes?create_composite=...
```
Precisa criar índices para:
- `commission_basic (where isActive + orderBy)`
- `commission_natal (where isActive + orderBy)`

**Teste 2: Permissões**
```javascript
// No browser console
const auth = firebase.auth();
const uid = auth.currentUser?.uid;
console.log('Current User UID:', uid);

// Tentar ler um doc
const doc = await firebase.firestore().collection('commission_basic').doc('ANY_ID').get();
console.log('Doc:', doc.data()); // Se undefined, é permission-denied
```

**Teste 3: Conectividade**
```javascript
// Verificar se consegue fazer uma query simples
const snap = await firebase.firestore().collection('commission_basic').limit(1).getDocs();
console.log('Query test:', snap.empty ? 'VAZIO ou ERRO' : 'OK');
```

### Solução por Severidade

**🔴 CRÍTICO**: Se todas as 3 queries retornam vazio:
→ Verifique se existe algum documento em `commission_basic` e `commission_natal`
→ Se não existir, crie um no SettingsHub

**🟡 MÉDIO**: Se retorna "permission-denied":
→ Verifique Firestore Rules em Console Firebase
→ Certifique-se de que usuário tem acesso a ler/escrever

**🟢 BAIXO**: Se retorna índice ausente:
→ Crie os índices compostos recomendados no Firebase Console
→ Leva ~1 minuto para ativar

---

## Resumo das 3 Soluções

| Problema | Causa | Solução | Tempo |
|----------|-------|---------|-------|
| **Botões não clicáveis** | Falta feedback visual | Adicionar `active:scale-95` + cores | 2 min |
| **Comissão não calcula** | Regras vazias (Problema #3) | Configurar regras em Settings | 5 min |
| **Firebase não desce info** | Índices/permissões/dados | Criar índices + verificar acesso | 10 min |

---

## Checklist de Verificação

- [ ] Botão tem feedback visual (escala/cor) ao clicar
- [ ] Regras de comissão existem em `commission_basic` no Firebase
- [ ] Regras de comissão existem em `commission_natal` no Firebase
- [ ] Índices do Firestore foram criados/ativados
- [ ] SalesForm agora calcula comissão corretamente
- [ ] Console do browser sem erros "permission-denied"

---

**Próximo passo**: Execute os 3 testes acima e reporte qual falha.
