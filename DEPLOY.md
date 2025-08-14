# 🚀 Guia de Deploy - Render + Vercel

## Pré-requisitos

1. ✅ Conta no GitHub (para hospedar o código)
2. ✅ Conta no Render (backend)
3. ✅ Conta no Vercel (frontend)
4. ✅ Credenciais do Firebase configuradas
5. ✅ Credenciais do Google Sheets API

## 📋 Passo a Passo

### 1. Preparar o Repositório

```bash
# Inicializar git (se ainda não foi feito)
git init
git add .
git commit -m "Preparação para deploy"

# Conectar com GitHub
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

### 2. Deploy do Backend no Render

#### 2.1 Criar Web Service
1. Acesse [render.com](https://render.com)
2. Clique em **"New"** → **"Web Service"**
3. Conecte seu repositório GitHub
4. Configure:
   - **Name:** `meu-bot-whatsapp-backend`
   - **Environment:** `Node`
   - **Region:** `Oregon (US West)`
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`

#### 2.2 Configurar Variáveis de Ambiente
Em **Environment** → **Environment Variables**, adicione:

```
NODE_ENV=production
PORT=10000
```

#### 2.3 Configurar Arquivos Secretos
Em **Environment** → **Secret Files**, adicione:

1. **service-account-key.json** (credenciais Firebase)
2. **client_oauth.json** (credenciais Google Sheets)
3. **token.json** (token Google Sheets)

#### 2.4 Deploy
- Clique em **"Create Web Service"**
- Aguarde o build e deploy (5-10 minutos)
- Anote a URL gerada (ex: `https://meu-bot-whatsapp-backend.onrender.com`)

### 3. Atualizar Frontend

#### 3.1 Configurar URL do Backend
Edite `frontend/renderer.js` e substitua:

```javascript
// ANTES
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : 'https://your-backend-url.onrender.com';

// DEPOIS (substitua pela URL real do Render)
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : 'https://meu-bot-whatsapp-backend.onrender.com';
```

#### 3.2 Commit das Alterações
```bash
git add .
git commit -m "Configurar URL do backend para produção"
git push
```

### 4. Deploy do Frontend no Vercel

#### 4.1 Criar Projeto
1. Acesse [vercel.com](https://vercel.com)
2. Clique em **"New Project"**
3. Conecte seu repositório GitHub
4. Configure:
   - **Framework Preset:** `Other`
   - **Root Directory:** `frontend`
   - **Build Command:** (deixe vazio)
   - **Output Directory:** `.`

#### 4.2 Configurar Variáveis de Ambiente
Em **Settings** → **Environment Variables**:

```
VITE_API_URL=https://meu-bot-whatsapp-backend.onrender.com
```

#### 4.3 Deploy
- Clique em **"Deploy"**
- Aguarde o build (2-5 minutos)
- Anote a URL gerada (ex: `https://meu-bot-whatsapp.vercel.app`)

## 🔧 Verificações Pós-Deploy

### Backend (Render)
1. Acesse `https://sua-url-backend.onrender.com/health`
2. Deve retornar: `{"status": "healthy", ...}`
3. Verifique os logs no painel do Render

### Frontend (Vercel)
1. Acesse sua URL do Vercel
2. Abra o console do navegador (F12)
3. Verifique se não há erros de CORS ou conexão

### Teste de Integração
1. Teste o login no sistema
2. Verifique se o Kanban carrega os dados
3. Teste a sincronização manual: `POST /api/sync-manual`

## 🐛 Troubleshooting

### Problemas Comuns

#### Backend não inicia
- ✅ Verifique se `package.json` está correto
- ✅ Confirme se as variáveis de ambiente estão configuradas
- ✅ Verifique os logs no Render

#### Frontend não conecta com Backend
- ✅ Confirme se a URL do backend está correta no `renderer.js`
- ✅ Verifique se o backend está rodando
- ✅ Teste a URL do backend diretamente

#### Erro de CORS
- ✅ Verifique se o CORS está configurado no `server.js`
- ✅ Confirme se a URL do frontend está permitida

#### WhatsApp não conecta
- ✅ Verifique se as credenciais estão corretas
- ✅ Confirme se o bot está autorizado
- ✅ Verifique os logs do WhatsApp

### Comandos Úteis

```bash
# Testar backend localmente
cd backend && npm start

# Testar frontend localmente
cd frontend && python -m http.server 8000

# Verificar logs do Render
# Acesse o painel do Render → Logs

# Testar API manualmente
curl https://sua-url-backend.onrender.com/health
```

## 📞 Suporte

Se encontrar problemas:

1. 📋 Verifique este guia novamente
2. 🔍 Consulte os logs do Render e Vercel
3. 🌐 Teste as URLs individualmente
4. 📧 Documente o erro e procure ajuda

---

**✅ Sistema pronto para produção!**