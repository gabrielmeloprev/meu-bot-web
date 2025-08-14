// =================================================================================
// ARQUIVO: servicoGoogle.js (VERSÃO ATUALIZADA)
// Contém funções para ler e escrever no Google Sheets.
// =================================================================================

import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';

// --- CONFIGURAÇÕES GLOBAIS ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CAMINHO_CHAVE = path.join(__dirname, 'service-account-key.json');

// Autenticação única que será usada por todas as funções
const auth = new google.auth.GoogleAuth({
    keyFile: CAMINHO_CHAVE,
    scopes: 'https://www.googleapis.com/auth/spreadsheets',
} );

const sheets = google.sheets({ version: 'v4', auth });

// DICIONÁRIO CENTRALIZADO: Mapeia o nome da coluna na planilha para a chave no objeto JavaScript
const HEADER_TO_JS_KEY_MAP = {
    'data': 'data',
    'nome': 'nome',
    'telefone': 'numero',
    'stop': 'stop',
    'contrato fechado': 'contratoFechado',
    'município': 'cidade',
    'serviço / produto': 'objetivo',
    'historico': 'historico',
    'pasta': 'pasta',
    'dia do agendamento': 'diaDoAgendamento',
    'idade': 'idade',
    'relatório de atendimento': 'relatorioDeAtendimento',
    'id openai': 'idOpenai',
    'horário': 'horario',
    'mensagem atual': 'mensagemAtual',
    'aguardando envio': 'aguardandoEnvio',
    'resposta ia': 'respostaIa',
    'runid': 'runId',
    'status': 'status',
    'lembrete': 'lembrete',
    'agendamento enviado': 'agendamentoEnviado',
    'imagem do perfil': 'imagemDoPerfil',
    'resumo da conversa': 'resumo',
    'histórico completo': 'historicoCompleto',
    'file id openai': 'fileIdOpenai',
    'possui arquivo': 'possuiArquivo',
    'cpf': 'cpf',
    'endereço': 'endereco',
    'cep': 'cep',
    'estado': 'estado',
    'profissão': 'profissao',
    'data de nascimento': 'nascimento',
    'contrato gerado': 'contratoGerado',
    'estado civil': 'estadoCivil',
    'bairro': 'bairro'
};

// --- FUNÇÕES EXISTENTES (SEM ALTERAÇÕES) ---

export async function getLeadsFromSheet(authClient, spreadsheetId, sheetName) {
    // Seu código existente para getLeadsFromSheet...
    // Nota: authClient não é mais necessário, pois usamos o 'auth' global.
    // Vamos manter a assinatura por compatibilidade com o auto-sync-service.
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: sheetName });
    const rows = res.data.values;

    if (!rows || rows.length < 2) {
        console.log('⚠️ Nenhum lead encontrado na planilha.');
        return [];
    }

    const header = rows[0].map(h => h.trim().toLowerCase());
    const dataRows = rows.slice(1);

    const leads = dataRows.map((row, index) => {
        const contactData = { rowNumber: index + 2 };
        header.forEach((colName, colIndex) => {
            const jsKey = HEADER_TO_JS_KEY_MAP[colName];
            if (jsKey) {
                contactData[jsKey] = row[colIndex] || '';
            }
        });
        
        if (contactData.numero) {
            contactData.numero = String(contactData.numero).replace(/\D/g, '');
        }
        if (!contactData.nome || !contactData.numero) {
            return null;
        }
        // **CORREÇÃO IMPORTANTE**: O ID deve ser o número de telefone para consistência
        contactData.id = contactData.numero;
        return contactData;
    }).filter(lead => lead !== null);

    console.log(`✅ ${leads.length} leads encontrados e processados da planilha.`);
    return leads;
}

export async function updateContactInSheet(authClient, spreadsheetId, sheetName, contactData) {
    // Seu código existente para updateContactInSheet...
    if (!contactData || !contactData.rowNumber) {
        throw new Error("Dados do contato ou número da linha ausentes para atualização.");
    }
    const headerRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!1:1` });
    const header = headerRes.data.values[0];
    const dataRow = header.map(colName => {
        const lowerColName = colName.trim().toLowerCase();
        const jsKey = HEADER_TO_JS_KEY_MAP[lowerColName];
        return jsKey ? (contactData[jsKey] || '') : '';
    });
    const range = `${sheetName}!A${contactData.rowNumber}`;
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [dataRow] },
    });
    console.log(`✅ Linha ${contactData.rowNumber} atualizada na planilha.`);
}


// --- NOVA FUNÇÃO ADICIONADA ---

/**
 * Encontra um contato pelo ID (número de telefone) e atualiza a coluna 'STOP' para "SIM".
 * @param {string} spreadsheetId - O ID da planilha.
 * @param {string} sheetName - O nome da aba.
 * @param {string} contactId - O ID do contato a ser atualizado (deve ser o número de telefone).
 */
/**
 * Função auxiliar para encontrar a linha de um contato pelo ID (número de telefone)
 * @param {string} spreadsheetId - O ID da planilha.
 * @param {string} sheetName - O nome da aba.
 * @param {string} contactId - O ID do contato a ser localizado (deve ser o número de telefone).
 * @returns {Object} - Objeto com informações da linha e colunas.
 */
async function encontrarLinhaDoContato(spreadsheetId, sheetName, contactId) {
    console.log(`[Google Sheets] Procurando linha para o ID: ${contactId}`);

    // 1. Obter o cabeçalho para encontrar a posição das colunas
    const headerRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!1:1` });
    const header = headerRes.data.values[0].map(h => h.trim().toLowerCase());
    
    const telefoneColIndex = header.indexOf('telefone');
    const stopColIndex = header.indexOf('stop');

    if (telefoneColIndex === -1 || stopColIndex === -1) {
        throw new Error("Não foi possível encontrar as colunas 'telefone' ou 'stop' no cabeçalho da planilha.");
    }

    // Converte o índice da coluna para a letra (A, B, C...)
    const getColumnLetter = (index) => String.fromCharCode('A'.charCodeAt(0) + index);
    const telefoneColumnLetter = getColumnLetter(telefoneColIndex);
    const stopColumnLetter = getColumnLetter(stopColIndex);

    // 2. Carregar toda a coluna de IDs (telefones) para encontrar o número da linha
    const rangeLeitura = `${sheetName}!${telefoneColumnLetter}:${telefoneColumnLetter}`;
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: rangeLeitura });
    const ids = response.data.values;

    if (!ids || ids.length === 0) {
        throw new Error('Não foi possível encontrar nenhum ID na planilha.');
    }

    // Encontra o índice da linha (adiciona 1 porque planilhas começam na linha 1)
    // Normaliza o contactId removendo caracteres não numéricos
    const contactIdNormalizado = String(contactId).replace(/\D/g, '');
    console.log(`[Google Sheets] Procurando por telefone normalizado: ${contactIdNormalizado}`);
    
    const numeroDaLinha = ids.findIndex(row => {
        if (!row || !row[0]) return false;
        const telefoneNormalizado = String(row[0]).replace(/\D/g, '');
        console.log(`[Google Sheets] Comparando com: ${telefoneNormalizado}`);
        return telefoneNormalizado === contactIdNormalizado;
    }) + 1;

    if (numeroDaLinha === 0) {
        console.warn(`[Google Sheets] ID ${contactId} não encontrado na planilha.`);
        throw new Error(`ID ${contactId} não encontrado na planilha.`);
    }

    return {
        numeroDaLinha,
        stopColumnLetter,
        telefoneColumnLetter,
        header
    };
}

/**
 * Encontra um contato pelo ID (número de telefone) e atualiza a coluna 'STOP' para "SIM".
 * @param {string} spreadsheetId - O ID da planilha.
 * @param {string} sheetName - O nome da aba.
 * @param {string} contactId - O ID do contato a ser atualizado (deve ser o número de telefone).
 */
export async function marcarStopNaPlanilha(spreadsheetId, sheetName, contactId) {
    const { numeroDaLinha, stopColumnLetter } = await encontrarLinhaDoContato(spreadsheetId, sheetName, contactId);

    console.log(`[Google Sheets] ID encontrado na linha ${numeroDaLinha}. Escrevendo 'SIM' na coluna ${stopColumnLetter}.`);

    // Escrever "SIM" na célula correta (ex: E5)
    const rangeEscrita = `${sheetName}!${stopColumnLetter}${numeroDaLinha}`;
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: rangeEscrita,
        valueInputOption: 'USER_ENTERED',
        resource: {
            values: [['SIM']],
        },
    });

    console.log(`[Google Sheets] 'SIM' escrito com sucesso para o ID ${contactId}.`);
    return { sucesso: true, mensagem: 'Status STOP atualizado na planilha.' };
}

/**
 * Remove o STOP de um contato, limpando a célula na coluna 'STOP'.
 * @param {string} spreadsheetId - O ID da planilha.
 * @param {string} sheetName - O nome da aba.
 * @param {string} contactId - O ID do contato a ser atualizado (deve ser o número de telefone).
 */
export async function removerStopDaPlanilha(spreadsheetId, sheetName, contactId) {
    const { numeroDaLinha, stopColumnLetter } = await encontrarLinhaDoContato(spreadsheetId, sheetName, contactId);

    console.log(`[Google Sheets] ID encontrado na linha ${numeroDaLinha}. Removendo 'SIM' da coluna ${stopColumnLetter}.`);

    // Limpar a célula na coluna STOP
    const rangeEscrita = `${sheetName}!${stopColumnLetter}${numeroDaLinha}`;
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: rangeEscrita,
        valueInputOption: 'USER_ENTERED',
        resource: {
            values: [['']],
        },
    });

    console.log(`[Google Sheets] STOP removido com sucesso para o ID ${contactId}.`);
    return { sucesso: true, mensagem: 'Status STOP removido na planilha.' };
}
