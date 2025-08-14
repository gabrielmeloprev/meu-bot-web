# Sistema de Bot WhatsApp com Kanban

Sistema completo de automação WhatsApp com interface Kanban para gerenciamento de leads.

## 🚀 Deploy

### Backend (Render)

1. **Preparação do repositório:**
   - Faça push do código para um repositório Git (GitHub, GitLab, etc.)
   - Certifique-se que o arquivo `backend/package.json` está configurado corretamente

2. **Deploy no Render:**
   - Acesse [render.com](https://render.com) e crie uma conta
   - Clique em "New" → "Web Service"
   - Conecte seu repositório Git
   - Configure:
     - **Name:** `meu-bot-whatsapp-backend`
     - **Environment:** `Node`
     - **Region:** `Oregon (US West)`
     - **Branch:** `main` (ou sua branch principal)
     - **Root Directory:** `backend`
     - **Build Command:** `npm install`
     - **Start Command:** `npm start`

3. **Variáveis de ambiente no Render:**
   Adicione as seguintes variáveis de ambiente:
   ```
   NODE_ENV=production
   PORT=10000
   ```

4. **Configuração do Firebase:**
   - No Render, vá em "Environment" → "Secret Files"
   - Adicione o arquivo `service-account-key.json` com suas credenciais do Firebase
   - Ou configure as variáveis de ambiente do Firebase individualmente

5. **Configuração do Google Sheets:**
   - Adicione as credenciais do Google Sheets como variáveis de ambiente
   - Configure `client_oauth.json` e `token.json` como secret files

### Frontend (Vercel)

1. **Atualizar URL do backend:**
   - No arquivo `frontend/renderer.js`, substitua `https://your-backend-url.onrender.com` pela URL real do seu backend no Render
   - Exemplo: `https://meu-bot-whatsapp-backend.onrender.com`

2. **Deploy no Vercel:**
   - Acesse [vercel.com](https://vercel.com) e crie uma conta
   - Clique em "New Project"
   - Conecte seu repositório Git
   - Configure:
     - **Framework Preset:** `Other`
     - **Root Directory:** `frontend`
     - **Build Command:** `npm run build` (deixe vazio se não houver)
     - **Output Directory:** `.` (diretório atual)

3. **Variáveis de ambiente no Vercel:**
   ```
   VITE_API_URL=https://seu-backend-url.onrender.com
   ```

## 📋 Pré-requisitos

- Conta no Firebase com projeto configurado
- Credenciais do Google Sheets API
- Conta no WhatsApp Business (para o bot)

## 🔧 Configuração Local

### Backend
```bash
cd backend
npm install
npm start
```

### Frontend
```bash
cd frontend
npm install
npm start
```

## 📁 Estrutura do Projeto

```
meu-bot-web/
├── backend/
│   ├── server.js          # Servidor Express principal
│   ├── bot.js             # Lógica do bot WhatsApp
│   ├── firebase.js        # Configuração Firebase
│   ├── servicoGoogle.js   # Integração Google Sheets
│   ├── auto-sync-service.js # Sincronização automática
│   └── package.json
└── frontend/
    ├── index.html         # Interface principal
    ├── renderer.js        # Lógica do frontend
    ├── package.json
    └── vercel.json        # Configuração Vercel
```

## 🌟 Funcionalidades

- ✅ Bot WhatsApp automatizado
- ✅ Interface Kanban para gerenciamento de leads
- ✅ Sincronização automática com Google Sheets
- ✅ Integração com Firebase
- ✅ Sistema de mensagens em tempo real
- ✅ Controle de status de contatos

## 🔒 Segurança

- Todas as credenciais devem ser configuradas como variáveis de ambiente
- Nunca commite arquivos de credenciais no repositório
- Use HTTPS em produção

## 📞 Suporte

Para dúvidas ou problemas, verifique:
1. Logs do Render para o backend
2. Console do navegador para o frontend
3. Configurações de variáveis de ambiente

---

**Desenvolvido por Gabriel Melo Advocacia**