// =================================================================================
// ARQUIVO: server.js (VERSÃO FINAL PARA IMPLANTAÇÃO)
// Backend completo com Express, Socket.IO e integração com Google Sheets.
// =================================================================================

import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { database } from './firebase.js';
import { ref, get, set } from 'firebase/database';
import { botWhatsapp } from './bot.js';
// Importa as funções específicas do nosso serviço do Google
import { marcarStopNaPlanilha, removerStopDaPlanilha } from './servicoGoogle.js';
import { initializeAutoSync, performManualSync } from './auto-sync-service.js';

// --- CONFIGURAÇÕES GLOBAIS ---
const app = express( );
const server = http.createServer(app );
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// ROTA PARA SINCRONIZAÇÃO MANUAL
app.post('/api/sync-manual', async (req, res) => {
    try {
        console.log('[API] Executando sincronização manual...');
        const result = await performManualSync();
        res.json({ 
            sucesso: true, 
            mensagem: `Sincronização concluída! ${result.processedCount} registros processados.`,
            processedCount: result.processedCount,
            stats: result.stats
        });
    } catch (error) {
        console.error('❌ Erro na sincronização manual:', error);
        res.status(500).json({ 
            sucesso: false, 
            erro: `Erro na sincronização: ${error.message}` 
        });
    }
});

const PORT = process.env.PORT || 3000;

// Health check route for Render
app.get('/', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Bot WhatsApp Backend is running',
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// --- CONFIGURAÇÕES DA SUA PLANILHA (PREENCHA AQUI) ---
const SPREADSHEET_ID = '1oefql7c1C0tLMiv0bo7dkDAuMbubxXy4NLhPCStuCxA'; // ❗ SUBSTITUA PELO ID DA SUA PLANILHA
const SHEET_NAME = 'Página1';                   // ❗ SUBSTITUA PELO NOME EXATO DA SUA ABA

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- VARIÁVEL DE ESTADO PARA O QR CODE ---
let ultimoQrCode = null;

// --- INICIALIZAÇÃO DO AUTO-SYNC ---
initializeAutoSync(null).then(() => {
    console.log('✅ Auto-sync service inicializado com sucesso');
}).catch(error => {
    console.error('❌ Erro ao inicializar auto-sync service:', error);
});


// =================================================================================
// ROTAS DA API
// =================================================================================

app.get('/api', (req, res) => {
    res.send('Olá! A API do seu Bot está no ar!');
});

app.get('/api/contatos', async (req, res) => {
    try {
        const contatosRef = ref(database, 'contatos');
        const contatosSnapshot = await get(contatosRef);
        const listaDeContatos = contatosSnapshot.exists() ? Object.values(contatosSnapshot.val()) : [];
        const estruturaRef = ref(database, 'kanban-board-structure');
        const estruturaSnapshot = await get(estruturaRef);
        let estruturaDeColunas = estruturaSnapshot.exists() ? estruturaSnapshot.val() : [];
        if (!Array.isArray(estruturaDeColunas) || estruturaDeColunas.length === 0) {
            estruturaDeColunas = [{ id: '_leads', title: 'Leads', item: [] }];
        }
        const todosOsContatosNaEstrutura = new Set(
            estruturaDeColunas.flatMap(coluna => coluna.item?.map(contato => contato.id) || [])
        );
        const novosContatos = listaDeContatos.filter(contato =>
            contato && contato.id && !todosOsContatosNaEstrutura.has(contato.id)
        );
        if (novosContatos.length > 0) {
            if (!estruturaDeColunas[0].item) estruturaDeColunas[0].item = [];
            estruturaDeColunas[0].item.push(...novosContatos);
        }
        res.json(estruturaDeColunas);
    } catch (error) {
        console.error('❌ Erro na rota /api/contatos:', error);
        res.status(500).json({ erro: 'Erro ao carregar dados do Kanban.' });
    }
});

app.post('/api/salvar-contatos', async (req, res) => {
    const estruturaCompleta = req.body;
    if (!Array.isArray(estruturaCompleta)) {
        return res.status(400).json({ sucesso: false, erro: 'Formato de dados inválido. Esperado um array.' });
    }
    try {
        console.log('[API] Recebido pedido para salvar estrutura do Kanban.');
        const estruturaRef = ref(database, 'kanban-board-structure');
        await set(estruturaRef, estruturaCompleta);
        console.log('[API] Estrutura do Kanban salva no Firebase com sucesso.');
        res.json({ sucesso: true, mensagem: 'Estrutura salva com sucesso!' });
    } catch (error) {
        console.error('❌ Erro ao salvar estrutura do Kanban:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro interno do servidor ao salvar dados.' });
    }
});

app.post('/api/enviar-mensagem', async (req, res) => {
    const { numero, mensagem } = req.body;
    if (!numero || !mensagem) {
        return res.status(400).json({ sucesso: false, erro: 'Número e mensagem são obrigatórios.' });
    }
    try {
        console.log(`[API] Enviando mensagem para ${numero}`);
        await botWhatsapp.sendMessage(`${numero}@c.us`, mensagem);
        res.json({ sucesso: true, mensagem: `Mensagem enviada para ${numero}` });
    } catch (error) {
        console.error(`❌ Erro ao enviar mensagem para ${numero}:`, error);
        res.status(500).json({ sucesso: false, erro: `Falha ao enviar mensagem: ${error.message}` });
    }
});

// ROTA ATUALIZADA PARA MARCAR "STOP"
app.post('/api/marcar-stop', async (req, res) => {
    const { contactId } = req.body;
    if (!contactId) {
        return res.status(400).json({ sucesso: false, erro: 'ID do contato é obrigatório.' });
    }
    try {
        // 1. Atualiza a planilha do Google
        console.log(`[API] Iniciando processo de STOP para o contato: ${contactId}`);
        await marcarStopNaPlanilha(SPREADSHEET_ID, SHEET_NAME, contactId);

        // 2. Atualiza a estrutura no Firebase para manter a consistência visual imediata
        const estruturaRef = ref(database, 'kanban-board-structure');
        const snapshot = await get(estruturaRef);
        if (snapshot.exists()) {
            let estrutura = snapshot.val();
            let contatoEncontrado = false;
            for (const coluna of estrutura) {
                if (coluna.item) {
                    const index = coluna.item.findIndex(c => c && c.id === contactId);
                    if (index > -1) {
                        coluna.item[index].stop = 'SIM';
                        contatoEncontrado = true;
                        break;
                    }
                }
            }
            if (contatoEncontrado) {
                await set(estruturaRef, estrutura);
                console.log(`[API] Contato ${contactId} atualizado no Firebase.`);
            }
        }
        res.json({ sucesso: true, mensagem: 'Status STOP atualizado com sucesso na planilha e no sistema.' });
    } catch (error) {
        console.error(`❌ Erro no processo de marcar STOP para ${contactId}:`, error);
        res.status(500).json({ sucesso: false, erro: error.message });
    }
});

// ROTA PARA REMOVER "STOP"
app.post('/api/remover-stop', async (req, res) => {
    console.log('[API] Recebida requisição para remover STOP');
    console.log('[API] Body da requisição:', req.body);
    
    const { contactId } = req.body;
    if (!contactId) {
        console.log('[API] Erro: ID do contato não fornecido');
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).send(JSON.stringify({ sucesso: false, erro: 'ID do contato é obrigatório.' }));
    }
    
    try {
        // 1. Atualiza a planilha do Google
        console.log(`[API] Iniciando processo de remoção de STOP para o contato: ${contactId}`);
        await removerStopDaPlanilha(SPREADSHEET_ID, SHEET_NAME, contactId);
        console.log(`[API] STOP removido com sucesso na planilha para o contato: ${contactId}`);

        // 2. Atualiza a estrutura no Firebase para manter a consistência visual imediata
        const estruturaRef = ref(database, 'kanban-board-structure');
        const snapshot = await get(estruturaRef);
        if (snapshot.exists()) {
            let estrutura = snapshot.val();
            let contatoEncontrado = false;
            for (const coluna of estrutura) {
                if (coluna.item) {
                    const index = coluna.item.findIndex(c => c && c.id === contactId);
                    if (index > -1) {
                        coluna.item[index].stop = '';
                        contatoEncontrado = true;
                        break;
                    }
                }
            }
            if (contatoEncontrado) {
                await set(estruturaRef, estrutura);
                console.log(`[API] Contato ${contactId} atualizado no Firebase (STOP removido).`);
            } else {
                console.log(`[API] Contato ${contactId} não encontrado no Firebase.`);
            }
        } else {
            console.log('[API] Estrutura do Firebase não encontrada.');
        }
        
        // Garantir que estamos enviando apenas JSON válido
        const resposta = { sucesso: true, mensagem: 'Status STOP removido com sucesso na planilha e no sistema.' };
        console.log('[API] Enviando resposta de sucesso:', resposta);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(resposta));
    } catch (error) {
        console.error(`❌ Erro no processo de remover STOP para ${contactId}:`, error);
        const resposta = { sucesso: false, erro: error.message };
        console.log('[API] Enviando resposta de erro:', resposta);
        res.setHeader('Content-Type', 'application/json');
        res.status(500).send(JSON.stringify(resposta));
    }
});

// Rota para obter o histórico de mensagens de um contato
app.get('/api/mensagens/:numero', (req, res) => {
    const { numero } = req.params;
    if (!numero) {
        return res.status(400).json({ sucesso: false, erro: 'Número do contato é obrigatório.' });
    }
    try {
        console.log(`[API] Obtendo histórico de mensagens para o número: ${numero}`);
        const historico = botWhatsapp.getMessageHistory(numero);
        res.json({ sucesso: true, historico });
    } catch (error) {
        console.error(`❌ Erro ao obter histórico de mensagens para ${numero}:`, error);
        res.status(500).json({ sucesso: false, erro: error.message });
    }
});


// =================================================================================
// LÓGICA DO SOCKET.IO
// =================================================================================

io.on('connection', (socket) => {
    console.log('✅ Um usuário se conectou via WebSocket');
    if (ultimoQrCode) {
        console.log('➡️ Enviando QR Code existente para o novo cliente...');
        socket.emit('whatsapp-qr', ultimoQrCode);
    }
    socket.on('disconnect', () => {
        console.log('❌ Usuário desconectado');
    });
});


// =================================================================================
// INICIALIZAÇÃO DO WHATSAPP
// =================================================================================

function setupWhatsAppListeners() {
    console.log('🔧 Configurando listeners do WhatsApp...');
    botWhatsapp.on('qr', (qr) => {
        console.log('🔄 QR Code recebido/atualizado pelo bot.');
        ultimoQrCode = qr;
        io.emit('whatsapp-qr', qr);
    });
    botWhatsapp.on('ready', () => {
        console.log('✅ WhatsApp conectado com sucesso!');
        ultimoQrCode = null;
        io.emit('whatsapp-status', { status: 'connected', message: 'WhatsApp conectado com sucesso!' });
    });
    botWhatsapp.on('disconnected', (reason) => {
        console.log(`🔌 WhatsApp desconectado: ${reason}`);
        io.emit('whatsapp-status', { status: 'disconnected', message: `WhatsApp desconectado: ${reason}` });
    });
    
    // Listener para mensagens enviadas
    botWhatsapp.on('message-sent', (data) => {
        console.log(`📤 Mensagem enviada para ${data.to}: ${data.message}`);
        io.emit('message-update', {
            type: 'sent',
            to: data.to,
            message: data.message,
            timestamp: data.timestamp
        });
    });
    
    // Listener para mensagens recebidas
    botWhatsapp.on('message-received', (data) => {
        console.log(`📥 Mensagem recebida de ${data.from}: ${data.message}`);
        io.emit('message-update', {
            type: 'received',
            from: data.from,
            message: data.message,
            timestamp: data.timestamp
        });
    });
}


// =================================================================================
// INICIALIZAÇÃO DO SERVIDOR
// =================================================================================

server.listen(PORT, () => {
    console.log(`🚀 Servidor e Socket.IO rodando na porta ${PORT}`);
    setupWhatsAppListeners();
    botWhatsapp.initialize().catch(error => {
        console.error('❌ Falha ao iniciar WhatsApp na inicialização:', error);
    });
});
