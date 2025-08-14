// =================================================================================
// ARQUIVO: auto-sync-service.js (VERSÃO CORRIGIDA)
// Serviço de sincronização automática entre Google Sheets e Firebase
// =================================================================================

import { google } from 'googleapis';
import { ref, set, get } from 'firebase/database';
import { database } from './firebase.js';
import fs from 'fs';
import path from 'path';

// =================================================================================
// CONFIGURAÇÕES FIXAS (HARDCODED)
// =================================================================================

const SPREADSHEET_ID = '1oefql7c1C0tLMiv0bo7dkDAuMbubxXy4NLhPCStuCxA';
const SHEET_NAME = 'Página1';
const SERVICE_ACCOUNT_KEY_PATH = './service-account-key.json';
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

// =================================================================================
// CLASSE DO SERVIÇO DE SINCRONIZAÇÃO AUTOMÁTICA (VERSÃO CORRIGIDA)
// =================================================================================

class AutoSyncService {
    constructor() {
        this.isRunning = false;
        this.intervalId = null;
        this.mainWindow = null;
        this.stats = {
            syncCount: 0,
            errorCount: 0,
            lastSyncTime: null,
            lastError: null,
            status: 'stopped'
        };
        this.auth = null;
        this.sheets = null;
    }

    /**
     * Inicializa o serviço de sincronização automática
     */
    async initialize(mainWindow) {
        console.log('🚀 [AutoSync] Inicializando serviço de sincronização automática...');
        this.mainWindow = mainWindow;

        try {
            // Configura autenticação
            await this.setupAuthentication();
            
            // Executa primeira sincronização
            await this.performSync();
            
            // Inicia sincronização automática
            this.startAutoSync();
            
            this.stats.status = 'running';
            console.log('✅ [AutoSync] Serviço inicializado com sucesso');
            
            // Notifica o frontend de forma segura
            this.safeSendToRenderer('auto-sync-status', {
                status: 'running',
                message: 'Sincronização automática ativa',
                stats: this.stats
            });
            
            return true;
        } catch (error) {
            console.error('❌ [AutoSync] Erro ao inicializar serviço:', error);
            this.stats.status = 'error';
            this.stats.lastError = error.message;
            this.stats.errorCount++;
            
            // Notifica o frontend sobre o erro de forma segura
            this.safeSendToRenderer('auto-sync-status', {
                status: 'error',
                message: `Erro ao inicializar sincronização automática: ${error.message}`,
                stats: this.stats
            });
            
            return false;
        }
    }

    /**
     * Configura a autenticação com o Google Service Account
     */
    async setupAuthentication() {
        console.log('🔐 [AutoSync] Configurando autenticação...');
        
        // Verifica se o arquivo de Service Account existe
        if (!fs.existsSync(SERVICE_ACCOUNT_KEY_PATH)) {
            throw new Error(`Arquivo service-account-key.json não encontrado em ${SERVICE_ACCOUNT_KEY_PATH}`);
        }

        // Configura autenticação
        this.auth = new google.auth.GoogleAuth({
            keyFile: SERVICE_ACCOUNT_KEY_PATH,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
        });

        const authClient = await this.auth.getClient();
        this.sheets = google.sheets({ version: 'v4', auth: authClient });
        
        console.log('✅ [AutoSync] Autenticado com Service Account');
        console.log('✅ [AutoSync] Autenticação realizada com sucesso');
    }

    /**
     * Inicia a sincronização automática em intervalos regulares
     */
    startAutoSync() {
        if (this.isRunning) {
            console.log('⚠️ [AutoSync] Sincronização automática já está rodando');
            return;
        }

        console.log(`🔄 [AutoSync] Iniciando sincronização automática (intervalo: ${SYNC_INTERVAL_MS / 1000}s)`);
        this.isRunning = true;
        
        this.intervalId = setInterval(async () => {
            try {
                await this.performSync();
            } catch (error) {
                console.error('❌ [AutoSync] Erro durante sincronização automática:', error);
                this.stats.errorCount++;
                this.stats.lastError = error.message;
                
                // Notifica o frontend sobre o erro de forma segura
                this.safeSendToRenderer('auto-sync-error', {
                    error: error.message,
                    stats: this.stats
                });
            }
        }, SYNC_INTERVAL_MS);
    }

    /**
     * Para a sincronização automática
     * CORREÇÃO: Verificação segura da janela principal
     */
    stop() {
        if (!this.isRunning) {
            console.log('⚠️ [AutoSync] Sincronização automática já está parada');
            return;
        }

        console.log('🛑 [AutoSync] Parando sincronização automática...');
        this.isRunning = false;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        this.stats.status = 'stopped';
        console.log('✅ [AutoSync] Sincronização automática parada');
        
        // CORREÇÃO: Verificação segura antes de acessar a janela
        this.safeSendToRenderer('auto-sync-status', {
            status: 'stopped',
            message: 'Sincronização automática parada',
            stats: this.stats
        });
    }

    /**
     * Executa uma sincronização manual
     */
    async performSync() {
        console.log('🔄 [AutoSync] Iniciando sincronização...');
        
        try {
            // Busca dados da planilha
            const leadsData = await this.getLeadsFromSheet();
            
            // Salva no Firebase
            await this.saveLeadsToFirebase(leadsData);
            
            // Atualiza estatísticas
            this.stats.syncCount++;
            this.stats.lastSyncTime = new Date().toISOString();
            this.stats.status = 'running';
            
            console.log(`✅ [AutoSync] Sincronização concluída. ${leadsData.length} registros processados.`);
            
            // Notifica o frontend de forma segura
            this.safeSendToRenderer('auto-sync-success', {
                message: `Sincronização concluída! ${leadsData.length} registros processados.`,
                processedCount: leadsData.length,
                stats: this.stats
            });
            
            return {
                success: true,
                processedCount: leadsData.length,
                stats: this.stats
            };
            
        } catch (error) {
            console.error('❌ [AutoSync] Erro durante sincronização:', error);
            this.stats.errorCount++;
            this.stats.lastError = error.message;
            
            // Notifica o frontend sobre o erro de forma segura
            this.safeSendToRenderer('auto-sync-error', {
                error: error.message,
                stats: this.stats
            });
            
            throw error;
        }
    }

    /**
     * Busca dados da planilha Google Sheets
     */
    async getLeadsFromSheet() {
        console.log('📖 [AutoSync] Buscando dados da planilha...');
        
        try {
            const range = `${SHEET_NAME}!A:Z`; // Lê todas as colunas
            
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: range
            });

            if (!response.data.values || response.data.values.length === 0) {
                console.log('⚠️ [AutoSync] Nenhum dado encontrado na planilha');
                return [];
            }

            const rows = response.data.values;
            const headers = rows[0]; // Primeira linha são os cabeçalhos
            const dataRows = rows.slice(1); // Demais linhas são os dados

            console.log(`📊 [AutoSync] Encontrados ${dataRows.length} registros na planilha`);
            console.log(`📋 [AutoSync] Cabeçalhos: ${headers.join(', ')}`);

            // Converte os dados para objetos
            const leads = dataRows.map((row, index) => {
                const lead = {};
                headers.forEach((header, colIndex) => {
                    lead[header] = row[colIndex] || '';
                });
                
                // Adiciona um ID único baseado no índice da linha
                lead.id = `lead_${index + 2}`; // +2 porque começamos da linha 2 (índice 1 + 1)
                
                return lead;
            }).filter(lead => {
                // Filtra apenas leads que têm pelo menos um nome ou telefone
                return lead.NOME || lead.TELEFONE;
            });

            console.log(`✅ [AutoSync] ${leads.length} registros válidos processados`);
            return leads;
            
        } catch (error) {
            console.error('❌ [AutoSync] Erro ao buscar dados da planilha:', error);
            throw new Error(`Falha ao acessar planilha: ${error.message}`);
        }
    }

    /**
     * Salva os dados no Firebase
     */
    async saveLeadsToFirebase(leads) {
        console.log('💾 [AutoSync] Salvando dados no Firebase...');
        
        try {
            // Converte array para objeto com IDs como chaves
            const leadsObject = {};
            leads.forEach(lead => {
                // Usa o telefone como chave principal, ou o ID se não houver telefone
                const key = lead.TELEFONE || lead.id;
                leadsObject[key] = {
                    id: key,
                    nome: lead.NOME || '',
                    numero: lead.TELEFONE || '',
                    cpf: lead.CPF || '',
                    endereco: lead.ENDERECO || '',
                    cidade: lead.CIDADE || '',
                    estado: lead.ESTADO || '',
                    dataNascimento: lead['DATA DE NASCIMENTO'] || '',
                    objetivo: lead.OBJETIVO || '',
                    resumoAtendimento: lead['RESUMO DO ATENDIMENTO'] || '',
                    parado: lead.STOP === 'SIM' || false,
                    // Campos adicionais da planilha
                    contratoFechado: lead['Contrato Fechado'] || '',
                    municipio: lead.MUNICÍPIO || '',
                    servico: lead['SERVIÇO / PRODUTO'] || '',
                    historico: lead.HISTÓRICO || '',
                    pasta: lead.PASTA || '',
                    diaDoAgendamento: lead['DIA DO AGENDAMENTO'] || '',
                    idade: lead.IDADE || '',
                    relatorioAtendimento: lead['RELATÓRIO DE ATENDIMENTO'] || '',
                    idOpenai: lead['ID OPENAI'] || '',
                    horario: lead.HORÁRIO || '',
                    mensagemAtual: lead['mensagem atual'] || '',
                    aguardandoEnvio: lead['Aguardando Envio'] || '',
                    respostaIa: lead['RESPOSTA IA'] || '',
                    runid: lead.Runid || '',
                    status: lead.Status || '',
                    lembrete: lead.Lembrete || '',
                    agendamentoEnviado: lead['AGENDAMENTO ENVIADO'] || '',
                    // Timestamps
                    ultimaAtualizacao: new Date().toISOString(),
                    sincronizadoEm: new Date().toISOString()
                };
            });

            // Salva no Firebase
            const contatosRef = ref(database, 'contatos');
            await set(contatosRef, leadsObject);
            
            console.log(`✅ [AutoSync] ${Object.keys(leadsObject).length} registros salvos no Firebase`);
            
        } catch (error) {
            console.error('❌ [AutoSync] Erro ao salvar no Firebase:', error);
            throw new Error(`Falha ao salvar no Firebase: ${error.message}`);
        }
    }

    /**
     * Retorna as estatísticas do serviço
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * CORREÇÃO: Método seguro para enviar mensagens ao renderer
     * Evita o erro "Object has been destroyed"
     */
    safeSendToRenderer(channel, message) {
        try {
            // Verifica se a janela ainda existe e não foi destruída
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.webContents.send(channel, message);
            } else {
                console.warn(`⚠️ [AutoSync] Janela principal não disponível para enviar: ${channel}`);
            }
        } catch (error) {
            console.error(`❌ [AutoSync] Erro ao enviar mensagem para ${channel}:`, error);
        }
    }
}

// =================================================================================
// INSTÂNCIA GLOBAL E FUNÇÕES EXPORTADAS
// =================================================================================

let autoSyncService = null;

/**
 * Inicializa o serviço de sincronização automática
 */
export async function initializeAutoSync(mainWindow) {
    try {
        if (!autoSyncService) {
            autoSyncService = new AutoSyncService();
        }
        
        return await autoSyncService.initialize(mainWindow);
    } catch (error) {
        console.error('❌ [AutoSync] Erro ao inicializar serviço:', error);
        return false;
    }
}

/**
 * Para o serviço de sincronização automática
 */
export function stopAutoSync() {
    if (autoSyncService) {
        autoSyncService.stop();
    }
}

/**
 * Executa uma sincronização manual
 */
export async function performManualSync() {
    if (!autoSyncService) {
        throw new Error('Serviço de sincronização não foi inicializado');
    }
    
    return await autoSyncService.performSync();
}

/**
 * Retorna as estatísticas do serviço
 */
export function getAutoSyncStats() {
    if (!autoSyncService) {
        return {
            syncCount: 0,
            errorCount: 0,
            lastSyncTime: null,
            lastError: null,
            status: 'not_initialized'
        };
    }
    
    return autoSyncService.getStats();
}

/**
 * Limpa referência para a janela principal
 */
export function cleanupWindowReference() {
    if (autoSyncService) {
        autoSyncService.mainWindow = null;
    }
}