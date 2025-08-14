// =================================================================================
// ARQUIVO: bot.js (VERSÃO ATUALIZADA COM EXCLUSÃO DE SESSÃO)
// Módulo de serviço do WhatsApp que emite eventos para o main.js.
// =================================================================================

import { EventEmitter } from 'events';
import * as baileys from '@whiskeysockets/baileys';
const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = baileys;
import pino from 'pino';
import { readFile } from 'fs/promises';
import fs from 'fs'; // Importa o módulo fs para operações síncronas
import path from 'path';

/**
 * Formata um número de telefone para o padrão do WhatsApp (@c.us).
 * @param {string} numero - O número a ser formatado.
 * @returns {string} O número formatado.
 */
function formatarNumeroBrasil(numero) {
    const numeroLimpo = String(numero).replace(/\D/g, '');
    if (numero.endsWith('@c.us')) return numero;
    if (numeroLimpo.startsWith('55') && numeroLimpo.length >= 12) return `${numeroLimpo}@c.us`;
    if (numeroLimpo.length >= 10) return `55${numeroLimpo}@c.us`;
    return `${numeroLimpo}@c.us`;
}

// A classe agora herda de EventEmitter para poder emitir eventos
class BotWhatsappService extends EventEmitter {
    constructor() {
        super();
        this.sock = null;
        this.status = 'disconnected';
        this.authFolder = 'auth_info'; // Pasta padrão de autenticação
        this.messageHistory = {}; // Armazena o histórico de mensagens por contato para gerenciamento
    }

    /**
     * Inicia a conexão com o WhatsApp e configura os listeners de eventos.
     */
    async initialize(authFolderName = this.authFolder) {
        // Evita múltiplas tentativas de conexão simultâneas
        if (this.status === 'connecting' || this.status === 'connected') {
            return console.log('⚠️ Conexão já em andamento ou estabelecida.');
        }

        console.log('🟢 Iniciando conexão com o WhatsApp...');
        this.status = 'connecting';
        this.authFolder = authFolderName; // Atualiza o nome da pasta

        try {
            const { state, saveCreds } = await useMultiFileAuthState(`./${authFolderName}`);
            const { version } = await fetchLatestBaileysVersion();

            this.sock = makeWASocket({
                version,
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: 'silent' })
            });

            // Salva as credenciais sempre que forem atualizadas
            this.sock.ev.on('creds.update', saveCreds);

            // Ouve as atualizações de conexão
            this.sock.ev.on('connection.update', (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    console.log('📲 QR Code recebido pelo bot.');
                    this.emit('qr', qr);
                }

                if (connection === 'close') {
                    this.status = 'disconnected';
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                    console.log(`❌ Conexão encerrada. Deve reconectar: ${shouldReconnect}`);
                    this.emit('disconnected', { shouldReconnect });
                    
                    if (shouldReconnect) {
                        setTimeout(() => this.initialize(), 3000); // Reconecta após 3 segundos
                    }
                } else if (connection === 'open') {
                    this.status = 'connected';
                    console.log('✅ Bot conectado com sucesso ao WhatsApp!');
                    
                    // Configura o listener de mensagens
                    this.setupMessageListener();
                    
                    this.emit('ready');
                }
            });
        } catch (error) {
            console.error('❌ Erro ao inicializar conexão:', error);
            this.status = 'disconnected';
            this.emit('error', error);
        }
    }

    /**
     * Envia uma mensagem de texto para um número de WhatsApp
     * @param {string} numero - Número de destino no formato internacional (ex: 5511999999999)
     * @param {string} mensagem - Texto da mensagem a ser enviada
     * @returns {Promise<object>} - Resultado do envio
     */
    async sendMessage(numero, mensagem) {
        if (!this.isConnected()) throw new Error('Bot não conectado.');
        const numeroFormatado = formatarNumeroBrasil(numero);
        const result = await this.sock.sendMessage(numeroFormatado, { text: mensagem });
        
        // Armazena a mensagem no histórico
        const numeroLimpo = numeroFormatado.split('@')[0];
        if (!this.messageHistory[numeroLimpo]) {
            this.messageHistory[numeroLimpo] = [];
        }
        
        const timestamp = Date.now();
        this.messageHistory[numeroLimpo].push({
            fromMe: true,
            message: mensagem,
            timestamp: timestamp
        });
        
        // Emite evento de mensagem enviada
        this.emit('message-sent', {
            to: numeroLimpo,
            message: mensagem,
            timestamp: timestamp
        });
        
        console.log(`✅ Mensagem enviada para ${numeroFormatado}`);
        return { success: true, result };
    }

    /**
     * Envia um arquivo de mídia.
     */
    async sendMedia(numero, caminhoArquivo, tipo, legenda = '') {
        if (!this.isConnected()) throw new Error('Bot não conectado.');
        const numeroFormatado = formatarNumeroBrasil(numero);
        const buffer = await readFile(caminhoArquivo);
        let mensagemMidia = {};

        switch (tipo) {
            case 'image': mensagemMidia = { image: buffer, caption: legenda }; break;
            case 'video': mensagemMidia = { video: buffer, caption: legenda }; break;
            case 'audio': mensagemMidia = { audio: buffer, mimetype: 'audio/mp4' }; break;
            case 'document':
                mensagemMidia = {
                    document: buffer,
                    mimetype: 'application/pdf',
                    fileName: path.basename(caminhoArquivo)
                };
                break;
            default: throw new Error('Tipo de mídia não suportado.');
        }
        await this.sock.sendMessage(numeroFormatado, mensagemMidia);
        console.log(`✅ Mídia (${tipo}) enviada para ${numeroFormatado}`);
    }

    /**
     * Desconecta da sessão atual e remove os dados de autenticação.
     */
    async logout() {
        try {
            if (this.sock) {
                // 1. Desconecta do WhatsApp
                await this.sock.logout();
                this.sock = null;
                this.status = 'disconnected';
                console.log('✅ Desconectado do WhatsApp');
                
                // 2. Exclui a pasta de autenticação
                const authFolderPath = path.join(process.cwd(), this.authFolder);
                if (fs.existsSync(authFolderPath)) {
                    fs.rmSync(authFolderPath, { recursive: true, force: true });
                    console.log('✅ Pasta de autenticação removida com sucesso');
                }
            }
            
            // 3. Emite evento de logout completo
            this.emit('logged-out');
            return true;
        } catch (error) {
            console.error('❌ Erro durante logout:', error);
            this.emit('error', error);
            return false;
        }
    }

    /**
     * Verifica se o bot está conectado.
     * @returns {boolean}
     */
    isConnected() {
        return this.status === 'connected';
    }

    /**
     * Configura o listener para mensagens recebidas
     */
    setupMessageListener() {
        if (!this.sock) return;
        
        // Configura o listener para mensagens recebidas
        this.sock.ev.on('messages.upsert', async ({ messages }) => {
            for (const message of messages) {
                // Ignora mensagens de status ou que não são conversas
                if (message.key.remoteJid === 'status@broadcast' || !message.message) continue;
                
                // Verifica se é uma mensagem recebida (não enviada por nós)
                const isFromMe = message.key.fromMe;
                const remoteJid = message.key.remoteJid;
                const senderNumber = remoteJid.split('@')[0]; // Remove o @s.whatsapp.net
                
                // Extrai o conteúdo da mensagem (texto, imagem, etc)
                let messageContent = '';
                if (message.message.conversation) {
                    messageContent = message.message.conversation;
                } else if (message.message.extendedTextMessage) {
                    messageContent = message.message.extendedTextMessage.text;
                } else if (message.message.imageMessage) {
                    messageContent = message.message.imageMessage.caption || '[Imagem]';
                } else if (message.message.videoMessage) {
                    messageContent = message.message.videoMessage.caption || '[Vídeo]';
                } else if (message.message.audioMessage) {
                    messageContent = '[Áudio]';
                } else if (message.message.documentMessage) {
                    messageContent = '[Documento]';
                } else if (message.message.stickerMessage) {
                    messageContent = '[Sticker]';
                } else {
                    messageContent = '[Mensagem não suportada]';
                }
                
                // Armazena a mensagem no histórico
                if (!this.messageHistory[senderNumber]) {
                    this.messageHistory[senderNumber] = [];
                }
                
                this.messageHistory[senderNumber].push({
                    fromMe: isFromMe,
                    message: messageContent,
                    timestamp: Date.now()
                });
                
                // Se não for uma mensagem enviada por nós, emite o evento de mensagem recebida
                if (!isFromMe) {
                    console.log(`📩 Mensagem recebida de ${senderNumber}: ${messageContent}`);
                    this.emit('message-received', {
                        from: senderNumber,
                        message: messageContent,
                        timestamp: Date.now()
                    });
                }
            }
        });
        
        console.log('✅ Listener de mensagens configurado com sucesso');
    }
    
    /**
     * Retorna o histórico de mensagens para um número específico
     * @param {string} number - Número no formato internacional (ex: 5511999999999)
     * @returns {Array} - Array com o histórico de mensagens
     */
    getMessageHistory(number) {
        // Normaliza o número removendo caracteres não numéricos
        const normalizedNumber = number.replace(/\D/g, '');
        return this.messageHistory[normalizedNumber] || [];
    }

    /**
     * Obtém o histórico de mensagens de um contato específico
     * @param {string} numero - O número do contato
     * @returns {Array} - Array com o histórico de mensagens
     */
    getMessageHistory(numero) {
        const numeroLimpo = String(numero).replace(/\D/g, '');
        return this.messageHistory[numeroLimpo] || [];
    }
}

// Exporta uma única instância da classe para ser usada em todo o app
export const botWhatsapp = new BotWhatsappService();