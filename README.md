# 🏠 DOMUS

> **Controle total da sua vida, em um só lugar.**

Sistema de controle pessoal completo, mobile-first, com suporte a PWA.

## 📱 Funcionalidades

- ✅ **Tarefas** — Gerenciamento com prioridades
- 🧠 **Pensamentos** — Diário com rastreamento de humor
- ❤️ **Gratidão** — Lista de gratidão diária
- 💰 **Finanças** — Controle de receitas e despesas
- 🎯 **Propósito** — Missão, metas e valores
- 📊 **Análise de Padrões** — Insights comportamentais
- 🌙 **Modo Escuro** — Tema dark completo
- 📲 **PWA** — Instalável como app

## 🚀 Início Rápido

### Pré-requisitos
- Node.js 18+

### Instalação

```bash
cd server
npm install
cp .env.example .env
# Editar .env e definir JWT_SECRET
npm run dev
```

### Acessar
- **App**: http://localhost:4000
- **Health**: http://localhost:4000/health

## 🔧 Variáveis de Ambiente

```env
JWT_SECRET=seu_segredo_64_caracteres
NODE_ENV=development
PORT=4000
```

**Gerar JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 📱 PWA - Instalar como App

1. Abra http://localhost:4000 no navegador
2. No celular: Menu → "Adicionar à tela inicial"
3. No Chrome desktop: Clique no ícone ➕ na barra

## 🚂 Deploy Railway

1. Push para GitHub
2. Conectar no railway.app
3. Configurar variáveis: `NODE_ENV=production`, `JWT_SECRET`, `PORT=4000`

## 📁 Estrutura

```
domus/
├── index.html          # Frontend mobile-first
├── domus.css           # Estilos
├── domus-app.js        # App JavaScript
├── manifest.json       # PWA manifest
├── sw.js               # Service Worker
├── server/
│   ├── index.js        # API Express
│   ├── db.js           # SQLite
│   └── .env            # Config (não versionar!)
└── railway.toml        # Deploy config
```

## 🔒 Segurança

- JWT + bcrypt
- Rate limiting
- Validação de entrada
- XSS protection (DOMPurify)
- Foreign keys + índices

## 📡 API Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/auth/register` | Criar conta |
| POST | `/auth/login` | Login |
| GET/POST/DELETE | `/api/tasks` | Tarefas |
| GET/POST/DELETE | `/api/thoughts` | Pensamentos |
| GET/POST/DELETE | `/api/gratitude` | Gratidão |
| GET/POST/PUT/DELETE | `/api/finances` | Finanças |

---

**DOMUS** — Desenvolvido com 💜
