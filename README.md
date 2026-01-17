<div align="center">

<img src="./docs/assets/gestor360-banner.png" alt="Gestor 360 Core" width="100%" />

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
Aplicação web modular focada em <b>Vendas</b> e <b>Finanças</b>, com <b>cache local (IndexedDB)</b> e sincronização confiável com Firestore.
</p>

</div>

---

## Escopo do Core

Incluído:
- **Vendas360**
- **Financeiro360**
- **SettingsHub** (somente funções pertinentes ao core)
- **DEV / Logs / Diagnóstico**
- **Chat interno**

Removido do escopo:
- Qualquer módulo fora do core (WhatsApp, CRM completo, extras, etc.)

---

## Online-First (fluxo)

### Leitura
- Online: busca do **Firestore (server refresh)** e hidrata o cache local
- Offline: usa **IndexedDB** como fonte imediata

### Escrita
- Sempre grava no **IndexedDB**
- Quando offline/erro transitório: enfileira e sincroniza depois via worker

---

## Arquitetura

**UI (React)** → **services/** → **storage/** → **Firestore**

Principais pontos:
- `services/firebase.ts`: inicialização Firebase/Auth/Firestore
- `storage/db.ts`: IndexedDB + fila de sincronização
- `services/syncWorker.ts`: processa fila com retry/backoff
- `services/logic.ts`: funções de Vendas/Finanças/SettingsHub (core)

---

## Coleções Firestore (Core)

Config/Usuários:
- `profiles`
- `users`
- `invites`
- `config/system`
- `config/ping`
- `config/report`

Vendas:
- `sales`
- `sales_tasks`
- `clients`
- `campaigns`
- `commission_basic`
- `commission_natal`

Financeiro:
- `accounts`
- `cards`
- `categories`
- `transactions`
- `receivables`
- `goals`
- `challenges`
- `challenge_cells`

Transversais:
- `internal_messages`
- `audit_log`
- `tickets`

---

## Índices Firestore mínimos

Crie índices:
- `sales`: `userId ASC` + `createdAt DESC`
- `sales_tasks`: `userId ASC` + `createdAt DESC`

---

## Setup

### Instalação
```bash
npm install
