# ✅ Checklist de Testes: Loading Infinito

## Pré-Requisitos
- [ ] Patch em [App.tsx:342](App.tsx#L342) aplicado (`setLoading(false)` antes de return)
- [ ] Build: `npm run build` executado com sucesso
- [ ] Sem erros TypeScript
- [ ] Git commit 46fae2e presente

---

## Fase 1: Testes Unitários (Dev Mode com StrictMode)

### 1.1 Cenário: Login Normal (Primeiro Acesso)
```
✓ Setup: Limpar localStorage + sessionStorage
✓ Setup: Abrir DevTools Console (F12)
✓ Ação: Clicar "Login" → inserir credenciais válidas
✓ Esperado: App carrega em < 5s, sem LoadingScreen infinita
✓ Verificação: Tela de home/vendas visível
✓ Verificação: Console sem erros críticos
```

**Passo a Passo**:
1. Abrir browser em dev mode: `npm run dev`
2. Limpar dados: DevTools → Application → Clear Site Data
3. Fazer login com usuário válido
4. **Verificar**: LoadingScreen desaparece em < 5 segundos
5. **Verificar**: Console mostra `[Bootstrap] Finalizado`

---

### 1.2 Cenário: Dupla Mount (React.StrictMode)
```
✓ Esperado: Mesmo com dupla-mount, setLoading(false) dispara
✓ Verificação: Apenas 1 HTTP POST para login (Firebase)
✓ Verificação: Duas chamadas de watchAuthChanges (esperado)
✓ Verificação: Ambas as chamadas chegam ao setLoading(false)
```

**Passo a Passo**:
1. Abrir DevTools → Console → Colar:
```javascript
// Monitor setLoading calls
const originalSetLoading = window.__setLoadingCalls || [];
console.log("Rastreando setLoading calls...");
```
2. Fazer login
3. **Verificar** no console: Logs `[Auth] Callback fired` aparecem 2x (ambas com setLoading)
4. **Verificar**: App inicia mesmo com dupla-call

---

### 1.3 Cenário: Mesma Sessão (Re-login mesmo UID)
```
✓ Ação: Logout e login novamente com mesmo usuário
✓ Esperado: App carrega normalmente (não fica preso)
✓ Verificação: lastUidRef.current === sessionUser.uid dispara setLoading(false)
```

**Passo a Passo**:
1. Fazer login (usuário A)
2. Clicar "Logout" (header)
3. Clicar "Login" novamente (mesmo usuário A)
4. **Verificar**: App carrega sem LoadingScreen infinita

---

## Fase 2: Testes de Integração (Build Production-like)

### 2.1 Build Validation
```
Command: npm run build
Expected: Sucesso em < 30s, zero warnings, zero errors
```

**Executar**:
```bash
npm run build
echo "Build status: $?"
```

**Validações**:
- [ ] Exit code = 0
- [ ] Output contém "built successfully"
- [ ] Nenhuma linha contém "error" (case-insensitive)
- [ ] Arquivo dist/index.html existe

---

### 2.2 Preview Build (Production Server)
```
Command: npm run preview
Expected: Aplicativo carrega em localhost:4173
```

**Passo a Passo**:
1. Terminal: `npm run preview`
2. Abrir browser em `http://localhost:4173`
3. Fazer login
4. **Verificar**: LoadingScreen desaparece em < 5s
5. **Verificar**: Vendas/clientes/dashboard carregam
6. **Verificar**: Nenhum erro de network

---

## Fase 3: Testes de Edge Cases

### 3.1 Network Throttling (Simular 3G Lento)
```
Setup: DevTools → Network → "Slow 3G"
Ação: Fazer login com throttle ativo
Esperado: App carrega (lento, mas sem infinito)
Timeout: Se > 15s, considerar adição de hardcap timeout
```

**Passo a Passo**:
1. DevTools F12 → Network tab
2. Dropdown "Throttling": selecionar "Slow 3G"
3. Fazer login
4. **Verificar**: App eventualmente carrega (pode demorar, ok)
5. **Verificar**: LoadingScreen não fica presa após 30s

---

### 3.2 Offline Então Online
```
Setup: DevTools → Network → "Offline"
Ação 1: Tentar login offline
Ação 2: Ligar internet, tentar login novamente
Esperado: Ambos os cenários tratados gracefully (erro ou cache)
```

**Passo a Passo**:
1. DevTools → Network → Offline
2. Tentar fazer login
3. **Verificar**: Erro de conexão exibido (não LoadingScreen infinita)
4. Ligar internet (DevTools → Network → Online)
5. Fazer login
6. **Verificar**: App carrega normalmente

---

### 3.3 Firestore Delay (Simular Latência)
```
Setup: DevTools → Network → Disable cache + "Fast 3G"
Ação: Fazer login
Esperado: App aguarda dados, mas não fica preso
```

**Passo a Passo**:
1. Abrir DevTools → Network tab
2. Selecionar "Fast 3G"
3. Marcar "Disable cache"
4. Fazer login
5. **Verificar**: Pode demorar mais, mas LoadingScreen desaparece

---

## Fase 4: Regressão (Funcionalidade Existente)

### 4.1 Comissões Intactas
```
✓ Acessar "Comissões" → aba "Básica"
✓ Comissões carregadas corretamente
✓ Cálculos de percentual OK
✓ Salvar/editar comissão OK
```

---

### 4.2 Vendas Intactas
```
✓ Acessar "Vendas"
✓ Listar vendas OK
✓ Criar nova venda OK
✓ Editar venda existente OK
✓ Soft delete funciona
```

---

### 4.3 Clientes Intactos
```
✓ Acessar "Clientes"
✓ Buscar clientes OK
✓ Criar novo cliente OK
✓ Detalhes do cliente carregam
```

---

### 4.4 Finanças Intactas
```
✓ Acessar "Finanças"
✓ Dashboard carrega corretamente
✓ Transações listadas
✓ Contas e cartões OK
```

---

## Fase 5: Monitoramento Pós-Deploy (7 dias)

### Métricas no Firebase

**Firebase Crashlytics**:
- [ ] Zero crashes na rota de login (`/`) nos últimos 7 dias
- [ ] Sem exceções "setLoading not defined" ou similares
- [ ] ANR (Application Not Responding) rate = 0

**Firebase Performance**:
- [ ] Trace `handleLoginSuccess` < 5s (p95)
- [ ] Trace `loadDataForUser` < 3s (p95)
- [ ] Network latency de Firestore < 2s (p95)

**Custom Logger (observar logs)**:
- [ ] `[Bootstrap] Finalizado` deve aparecer em 100% dos logins
- [ ] Nenhum `[Bootstrap] Falha` sem recovery
- [ ] Nenhum `[Auth] Callback fired` sem `setLoading(false)`

---

## Logs Esperados no Console (Dev Mode)

```javascript
[Bootstrap] Iniciando carga inicial Firestore. {uid: "abc123"}
[Auth] Callback fired {uid: "abc123", ...}
[Bootstrap] Dados carregados. {sales: 45, clients: 12, ...}
[Bootstrap] Finalizado. {uid: "abc123"}
```

---

## Critério de Sucesso

✅ **PASSOU** se:
- [ ] Login funciona 100% das vezes (múltiplas tentativas)
- [ ] Nenhuma LoadingScreen infinita detectada em nenhum cenário
- [ ] Build compila sem erros
- [ ] Nenhuma regressão em funcionalidades existentes
- [ ] Console sem erros críticos pós-login
- [ ] Performance < 5s em conexão normal

❌ **FALHOU** se:
- [ ] LoadingScreen infinita em qualquer cenário
- [ ] Build com erros/warnings
- [ ] Regressão em comissões/vendas/clientes
- [ ] Crash ou exceção não tratada

---

## Sign-Off

| Teste | Responsável | Data | Status |
|-------|------------|------|--------|
| Fase 1 | Dev | _____ | ⬜ |
| Fase 2 | Dev | _____ | ⬜ |
| Fase 3 | QA | _____ | ⬜ |
| Fase 4 | QA | _____ | ⬜ |
| Fase 5 | Monitor | _____ | ⬜ |

**Aprovado para Deploy**: ⬜ Sim / ⬜ Não

Data: _____ Assinado por: _____
