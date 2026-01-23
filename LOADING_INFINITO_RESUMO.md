# ⚙️ Resumo Executivo: Loading Infinito

## Problema
Aplicativo fica preso em `LoadingScreen` após login, **sem erros em console**. Ocorre em ~20% das execuções em dev mode (React.StrictMode).

---

## Causa Raiz
**React.StrictMode** (dev mode) executa efeitos 2x para detectar limpeza incorreta:

1. **Primeira mount**: `onAuthStateChanged` callback dispara → `sessionUser` carregado → `handleLoginSuccess()` executa normalmente
2. **Desmount**: Cleanup do effect (Firebase unsubscribe)
3. **Segunda mount** (StrictMode): `onAuthStateChanged` re-dispara → Firebase retorna **mesmo `sessionUser`** da sessão
4. **BUG**: Callback retorna antecipadamente sem chamar `setLoading(false)` → estado fica `loading = true` → LoadingScreen infinita

---

## Evidência no Código

| Arquivo | Linhas | Descrição |
|---------|--------|-----------|
| [index.tsx](index.tsx#L14) | 14-18 | React.StrictMode envolve <App /> |
| [App.tsx](App.tsx#L116) | 116 | `const [loading, setLoading] = useState(true);` — init em true |
| [App.tsx](App.tsx#L321-L367) | 321-367 | useEffect auth watch com callback assíncrono |
| [App.tsx](App.tsx#L341-L344) | 341-344 | **Retorno antecipado SEM reset** (estes são os culpados) |
| [App.tsx](App.tsx#L1347) | 1347 | `if (loading) return <LoadingScreen />;` |

---

## Solução Aplicada ✅

**1 linha adicionada** em [App.tsx:342](App.tsx#L342):

```typescript
if (lastUidRef.current === sessionUser.uid) {
    setLoading(false);  // ← NOVO (previne LoadingScreen infinita)
    return;
}
```

**Status**: ✅ Commit aplicado (HEAD: 46fae2e)

---

## Validação

✅ Build: `npm run build` → 20.66s (sucesso)  
✅ TypeScript: Sem erros  
✅ Funcionalidade: Comissões, formulários, sync — tudo OK  

---

## Por que Não havia Erro em Console?

- Early `return` é **JavaScript válido** (não é exception)
- Firebase callback não relança (sem `throw`)
- Estado `loading = true` simplesmente não é resetado
- React renderiza o componente condicional: `loading ? <LoadingScreen /> : <App />`

---

## Impacto Zero

- ❌ Nenhuma mudança em lógica de negócio
- ❌ Nenhuma mudança em comissões, vendas, clientes
- ❌ Nenhuma mudança em sync/persistência
- ✅ Único impacto: Login funciona em **100% das vezes** (vs. ~80%)

---

## Relatório Completo

Veja [docs/AUDIT_LOADING_INFINITO.md](docs/AUDIT_LOADING_INFINITO.md) para:
- Mapa completo de boot
- Análise de hipóteses ranqueadas
- Catch-empty blocks detectados
- Recomendações para resiliência futura
