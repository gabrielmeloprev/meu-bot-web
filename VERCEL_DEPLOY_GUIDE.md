# Guia de Deploy no Vercel - Soluções para Problemas Comuns

## Problemas Identificados e Soluções

### 1. URL do Backend Incorreta
**Problema:** O frontend estava configurado com URL placeholder `https://your-backend-url.onrender.com`

**Solução Aplicada:**
- Atualizado `frontend/vercel.json` com a URL correta: `https://meu-bot-web-backend.onrender.com`
- Atualizado `frontend/renderer.js` com a mesma URL

### 2. Credenciais Sensíveis no Repositório
**Problema:** GitHub bloqueando push devido a credenciais OAuth detectadas

**Solução:**
- Removidos `backend/client_oauth.json` e `backend/token.json` do repositório
- Mantidos apenas os arquivos `.example` como referência
- Criado branch limpo sem histórico de credenciais

### 3. Configuração do Vercel

#### Arquivos Essenciais para Deploy:

**frontend/vercel.json:**
```json
{
  "version": 2,
  "name": "meu-bot-web-frontend",
  "builds": [
    {
      "src": "**/*",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/",
      "dest": "/index.html"
    },
    {
      "src": "/(.*)",
      "dest": "/$1"
    }
  ],
  "functions": {},
  "env": {
    "API_BASE_URL": "https://meu-bot-web-backend.onrender.com"
  }
}
```

**frontend/package.json:**
```json
{
  "name": "meu-bot-web-frontend",
  "version": "1.0.0",
  "description": "Frontend do sistema de bot WhatsApp com Kanban",
  "main": "index.html",
  "scripts": {
    "build": "echo 'Build completed - static files ready'",
    "start": "echo 'Starting frontend server'",
    "dev": "echo 'Development server ready'"
  },
  "keywords": ["whatsapp", "bot", "kanban", "frontend"],
  "author": "Your Name",
  "license": "MIT",
  "devDependencies": {},
  "dependencies": {}
}
```

## Passos para Deploy no Vercel

### 1. Conectar Repositório
1. Acesse [vercel.com](https://vercel.com)
2. Faça login com sua conta GitHub
3. Clique em "New Project"
4. Selecione o repositório `meu-bot-web`

### 2. Configurar Projeto
1. **Framework Preset:** Other
2. **Root Directory:** `frontend`
3. **Build Command:** `npm run build` (ou deixe vazio)
4. **Output Directory:** `.` (diretório atual)
5. **Install Command:** `npm install` (ou deixe vazio)

### 3. Variáveis de Ambiente
Adicione as seguintes variáveis de ambiente no Vercel:
- `API_BASE_URL`: `https://meu-bot-web-backend.onrender.com`

### 4. Deploy
1. Clique em "Deploy"
2. Aguarde o processo de build
3. Acesse a URL fornecida pelo Vercel

## Problemas Comuns e Soluções

### Erro: "Build failed"
- Verifique se o diretório root está configurado como `frontend`
- Certifique-se de que não há erros de sintaxe nos arquivos

### Erro: "API calls failing"
- Verifique se o backend está rodando no Render
- Confirme se a URL do backend está correta
- Verifique as configurações de CORS no backend

### Erro: "Static files not loading"
- Verifique se os caminhos dos arquivos estão corretos
- Confirme se o `vercel.json` está configurado corretamente

## Estrutura de Arquivos para Deploy

```
frontend/
├── index.html          # Página principal
├── renderer.js         # Lógica do frontend
├── libs/
│   └── qrcode.min.js  # Biblioteca QR Code
├── package.json        # Configurações do projeto
└── vercel.json        # Configurações do Vercel
```

## Próximos Passos

1. **Resolver conectividade:** Aguarde a conexão com GitHub ser restabelecida
2. **Push do código limpo:** Execute `git push --force origin clean-deploy:main`
3. **Deploy no Vercel:** Siga os passos acima
4. **Configurar backend:** Certifique-se de que o backend está rodando no Render
5. **Testar integração:** Verifique se frontend e backend estão se comunicando

## Comandos Úteis

```bash
# Verificar status do repositório
git status

# Fazer push quando a conectividade for restabelecida
git push --force origin clean-deploy:main

# Verificar branches
git branch -a

# Mudar para branch main local
git checkout main
git branch -M main
```

## Suporte

Se encontrar problemas:
1. Verifique os logs do Vercel
2. Confirme se o backend está funcionando
3. Teste localmente primeiro
4. Verifique as configurações de DNS/conectividade