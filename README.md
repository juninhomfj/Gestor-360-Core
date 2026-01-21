# Gestor 360 — Vendas & Finanças (React + Vite + Firebase)

![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react&logoColor=0B1220)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=0B1220)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)

Plataforma web modular com **Vendas**, **Finanças**, **Distribuição**, **Recebíveis**, **Configurações** e utilitários.  
Arquitetura **online-first** (Firestore) com cache local (IndexedDB) e tolerancia a offline.

---

## ✨ Principais recursos

### Home
- Resumo combinado de Vendas e Financas
- Atalhos para Vendas360 e Financas360
- Preferencia de abertura (Home ou modulo direto) + botao de privacidade


### Vendas
- Cadastro e edição de vendas
- Faturamento em lote
- Regras de comissão (básica / natal) com assinatura em tempo real
- Integração com campanhas / overlays de comissão (quando habilitado)
- Modelo XLSX de importacao: `public/modelo_importacao_vendas360.xlsx`

### Finanças
- Contas, transações, categorias, metas, desafios, receíveis
- Indicadores e dashboards

### Operação
- Cache local (IndexedDB) + sync
- Chat interno com selecao de usuarios e grupos
- Modo manutenção e bloqueio de escrita (quando habilitado)
- Lixeira (restaurar e excluir permanentemente)
- Audio de feedback (sucesso/erro/notificacoes)

### IA / BI
- Selecao de provedor (OpenAI ou Gemini)
- Chave de API armazenada localmente no navegador

---

## 🧱 Stack
- **React 18 + TypeScript**
- **Vite**
- **Firebase**: Auth, Firestore, Functions, Messaging (opcional), AppCheck (opcional)
- **IndexedDB (idb)** para cache local-first
- Tailwind + Lucide + Recharts

---

## ✅ Pré-requisitos
- Node.js 18+ recomendado
- Projeto Firebase configurado (Web App)

---

## 🔐 Variáveis de ambiente

Crie **`.env.local`** na raiz do projeto.

Você pode usar **qualquer um** dos padrões abaixo (o projeto aceita ambos):

### Padrão A (compat)
```env
VITE_APP_FIREBASE_API_KEY="..."
VITE_APP_FIREBASE_AUTH_DOMAIN="..."
VITE_APP_FIREBASE_PROJECT_ID="..."
VITE_APP_FIREBASE_STORAGE_BUCKET="..."
VITE_APP_FIREBASE_MESSAGING_SENDER_ID="..."
VITE_APP_FIREBASE_APP_ID="..."
VITE_APP_FIREBASE_MEASUREMENT_ID="..."
VITE_KLIPY_APP_KEY="..."
Padrão B (novo)
VITE_FIREBASE_API_KEY="..."
VITE_FIREBASE_AUTH_DOMAIN="..."
VITE_FIREBASE_PROJECT_ID="..."
VITE_FIREBASE_STORAGE_BUCKET="..."
VITE_FIREBASE_MESSAGING_SENDER_ID="..."
VITE_FIREBASE_APP_ID="..."
VITE_FIREBASE_MEASUREMENT_ID="..."
VITE_KLIPY_APP_KEY="..."
⚠️ Depois de alterar .env.local, reinicie o Vite: Ctrl+C e npm run dev

▶️ Rodar local
npm install
npm run dev
Acesse:

http://localhost:5173

🏗️ Build / Preview
npm run build
npm run preview
☁️ Deploy (Vercel)
Configure as variáveis de ambiente no painel da Vercel (mesmas do .env.local)

Build command: npm run build

Output: dist

🧩 Estrutura (alto nível)
services/firebase.ts — init Firebase (env compat + Firestore cache multi-aba)

services/logic.ts — regras de negócio / local-first / sync

storage/db.ts — IndexedDB (idb)

components/* — UI e módulos

Commission Engine Lock
- O motor de comissao em `services/logic.ts` possui contrato bloqueado (banner "ARQUIVO BLOQUEADO").
- Testes unitarios em `tests/commissionEngine.test.ts` garantem faixas e bordas.


🛟 Troubleshooting
Firebase: Error (auth/invalid-api-key)
O app não está lendo a apiKey do .env.local ou a chave é inválida/restrita.

Reinicie o Vite após alterar .env.local.

Confirme que a chave é a do Web App do Firebase.

No matching export ... services/logic.ts
Algum componente importou função que não existe/exporta no logic.ts.

Garanta que os exports compat foram adicionados ao final do arquivo.
