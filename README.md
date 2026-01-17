# Gestor360 — Vendas 360 + Finanças 360

Este repositório contém apenas os módulos **Vendas 360** e **Finanças 360**, mantendo também as áreas transversais necessárias ao funcionamento:

- SettingsHub (Admin/DEV)
- Logs
- Chat interno

## Ambiente

1) Configure as variáveis do Firebase no `.env.local` (Vite):

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

2) Instale e rode:

- `npm install`
- `npm run dev`

> Observação: a conexão Firestore/Firebase e a estratégia **Online-First** serão revisadas na etapa seguinte do plano.
