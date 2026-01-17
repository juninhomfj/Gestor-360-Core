<div align="center">

<img src="./docs/assets/gestor360-banner.png" alt="Gestor 360" width="100%" />

# Gestor 360 Core  
### Vendas360 + Financeiro360 + SettingsHub + DEV/Logs + Chat (Online-First)

<p>
  <img alt="Vite" src="https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=black" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" />
  <img alt="Firebase" src="https://img.shields.io/badge/Firebase-Firestore%20%2B%20Auth-FFCA28?logo=firebase&logoColor=black" />
  <img alt="Online First" src="https://img.shields.io/badge/Mode-Online--First-22c55e" />
</p>

<p>
Plataforma web modular focada em **Vendas** e **Finanças**, com **cache local (IndexedDB)** e **sincronização confiável** com Firestore.
</p>

</div>

---

## ✨ Módulos incluídos (escopo do Core)

- **Vendas360**
  - Cadastro e gestão de vendas
  - Pendências (`sales_tasks`)
  - Comissões (regras e cálculo)
  - Importação (CSV/XLSX)
- **Financeiro360**
  - Transações, contas, cartões e categorias
  - Recebíveis e distribuição
  - Metas e desafios
- **SettingsHub**
  - Configurações do sistema (tema, módulos, preferências)
  - Administração (conforme permissões)
- **DEV / Diagnóstico**
  - Health-check, telemetria e utilitários internos
- **Logs**
  - Persistência local + envio para `audit_log`
- **Chat interno**
  - Mensagens internas (`internal_messages`)

> Este repositório **não contém** WhatsApp/Fiscal/ERP/outros módulos (removidos do escopo).

---

## 🧠 Online-First (como funciona)

### Leitura
- Quando online: busca do **Firestore** (server refresh) e hidrata o cache local.
- Quando offline: usa **IndexedDB**.

### Escrita
- Escreve no **cache local** e tenta Firestore.
- Se offline/erro transitório → enfileira em `sync_queue` para sincronizar depois.
- O Sync Worker tenta novamente quando a rede volta.

---

## 🏗️ Arquitetura (alto nível)

**UI (React)** → **services/** → **storage/** → **Firestore**

Pontos-chave:
- `services/firebase.ts` inicializa Firebase/Auth/Firestore (cache persistente multi-aba com fallback).
- `storage/db.ts` mantém stores do IndexedDB + fila `sync_queue`.
- `services/syncWorker.ts` processa `sync_queue` com retry/backoff.
- `services/logic.ts` concentra leitura/escrita de Vendas e Finanças.

---

## 🔥 Coleções Firestore (Core)

**Config / Usuários**
- `profiles`
- `users`
- `invites`
- `config/*` (`system`, `ping`, `report`)

**Vendas**
- `sales`
- `sales_tasks`
- `clients`
- `campaigns`
- `commission_basic`
- `commission_natal`

**Financeiro**
- `accounts`
- `cards`
- `categories`
- `transactions`
- `receivables`
- `goals`
- `challenges`
- `challenge_cells`

**Transversais**
- `internal_messages`
- `audit_log`
- `tickets`

---

## 🧩 Índices Firestore (mínimos)
Crie estes índices no Firestore:

- `sales_tasks`: `userId ASC` + `createdAt DESC`
- `tickets`: `userId ASC` + `createdAt DESC`
- `tickets`: `userId ASC` + `status ASC`

---

## ✅ Requisitos

- Node.js **18+** (recomendado 20)
- Firebase project com:
  - Auth habilitado
  - Firestore habilitado

---

## ⚙️ Setup local

### 1) Instalar dependências
```bash
npm install
2) Variáveis de ambiente (Vite)
Crie um .env.local:

VITE_FIREBASE_API_KEY="..."
VITE_FIREBASE_AUTH_DOMAIN="..."
VITE_FIREBASE_PROJECT_ID="..."
VITE_FIREBASE_STORAGE_BUCKET="..."
VITE_FIREBASE_MESSAGING_SENDER_ID="..."
VITE_FIREBASE_APP_ID="..."
VITE_FIREBASE_MEASUREMENT_ID="..."
VITE_FIREBASE_APPCHECK_RECAPTCHA_KEY="..." # opcional (AppCheck)
3) Rodar
npm run dev
🔐 Permissões (Firestore Rules)
As regras do Firestore usam profiles/{uid} como fonte de:

role: USER | ADMIN | DEV

modules: chaves booleanas por módulo

Usuário precisa estar isActive: true para operar.

🧪 Testes rápidos (offline-first)
Logue online, faça uma venda.

Desligue a internet.

Faça outra venda e atualize uma pendência.

Ligue a internet.

Verifique: sincronizou automaticamente.

🖼️ Screenshots (opcional, mas recomendado)
Coloque imagens em docs/assets/:

gestor360-banner.png

login.png

dashboard.png

E referencie aqui:

<div align="center"> <img src="./docs/assets/login.png" width="45%" /> <img src="./docs/assets/dashboard.png" width="45%" /> </div>
📦 Scripts
npm run dev — ambiente de desenvolvimento

npm run build — build de produção

npm run preview — preview do build

🛠️ Troubleshooting
Tela branca / erro de import
Verifique o console (F12) e corrija exports/imports.

Se o erro for “does not provide an export named …”, o arquivo importado não exporta esse símbolo.

Firestore “requires an index”
Crie os índices listados acima e faça deploy.

📄 Licença
Uso interno/privado (defina aqui se necessário).


### Imagens “modernas”
O README já está preparado para imagens.  
Só crie a pasta:

- `docs/assets/`

e coloque um banner simples (pode ser print do login) como `gestor360-banner.png`.


