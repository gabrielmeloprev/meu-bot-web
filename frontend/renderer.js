// =================================================================================
// ARQUIVO: renderer.js (VERSÃO PARA WEB - COMPLETA E CORRIGIDA)
// Lógica da interface do usuário (UI) consumindo uma API externa
// =================================================================================

// URL base da sua API. Mude isso quando for para produção.
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : 'https://meu-bot-whatsapp-backend.onrender.com';

console.log("Renderer.js (versão web ) foi carregado.");

// --- 1. FUNÇÕES AUXILIARES E MODAIS (sem alterações) ---
function showCustomAlert(title, message) {
    const modal = document.getElementById('notification-modal');
    const modalTitle = document.getElementById('notification-title');
    const modalMessage = document.getElementById('notification-message');
    const okButton = document.getElementById('notification-btn-ok');
    if (!modal || !modalTitle || !modalMessage || !okButton) return alert(message);
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modal.style.display = 'flex';
    const closeModal = () => {
        modal.style.display = 'none';
        okButton.removeEventListener('click', closeModal);
    };
    okButton.addEventListener('click', closeModal);
}

function showCustomConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmation-modal');
        const modalTitle = document.getElementById('confirmation-title');
        const modalMessage = document.getElementById('confirmation-message');
        const confirmBtn = document.getElementById('confirmation-btn-confirm');
        const cancelBtn = document.getElementById('confirmation-btn-cancel');
        if (!modal) return resolve(confirm(message));
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modal.style.display = 'flex';
        const cleanupAndResolve = (value) => {
            modal.style.display = 'none';
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            resolve(value);
        };
        const onConfirm = () => cleanupAndResolve(true);
        const onCancel = () => cleanupAndResolve(false);
        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
    });
}

function gerarHtmlDoCard(contact) {
    // Função para gerar iniciais do nome para o avatar
    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(word => word.charAt(0)).join('').substring(0, 2).toUpperCase();
    };
    
    let html = `<div class="contact-info">
        <div class="contact-avatar">
            <span>${getInitials(contact.nome)}</span>
        </div>
        <div>
            <strong>${contact.nome || ''}</strong><br>
            <small>${contact.numero || ''}</small>
        </div>
    </div>`;
    html += '<div class="card-info">';
    
    // Exibe informações adicionais do contato
    if (contact.cidade) {
        html += `<span>🏙️ ${contact.cidade}</span>`;
    }
    if (contact.objetivo) {
        html += `<span>🎯 ${contact.objetivo}</span>`;
    }
    if (contact.idade) {
        html += `<span>👤 ${contact.idade} anos</span>`;
    }
    
    // Exibe tag de STOP
    if (contact.stop && contact.stop.toUpperCase() === 'SIM') {
        html += `<span class="stop-tag">🚫 STOP ATIVADO</span>`;
    }
    
    // Exibe data e horário de agendamento
    if (contact.diaDoAgendamento && contact.horario) {
        html += `<span>🗓️ ${contact.diaDoAgendamento} &nbsp; ⏰ ${contact.horario}</span>`;
    } else if (contact.diaDoAgendamento) {
        html += `<span>🗓️ ${contact.diaDoAgendamento}</span>`;
    } else if (contact.horario) {
        html += `<span>⏰ ${contact.horario}</span>`;
    }
    
    // Exibe link para pasta
    if (contact.pasta && contact.pasta.startsWith('http' )) {
        html += `<a href="${contact.pasta}" target="_blank" class="link-pasta">📁 Abrir Pasta</a>`;
    }
    
    html += '</div>';
    
    // Botões de ação
    html += `<div class="card-actions">`;
    
    // Botão de mensagem sempre visível
    html += `<button class="btn-message" data-contact-id="${contact.id}" data-contact-name="${contact.nome || ''}" data-contact-phone="${contact.numero || ''}">📱 Mensagem</button>`;
    
    // Botão de STOP ou Remover STOP dependendo do status atual
    if (contact.stop && contact.stop.toUpperCase() === 'SIM') {
        html += `<button class="btn-remove-stop" data-contact-id="${contact.id}">✅ Remover STOP</button>`;
    } else {
        html += `<button class="btn-stop" data-contact-id="${contact.id}">🚫 STOP</button>`;
    }
    
    html += `</div>`;
    
    return html;
}

function showCustomPrompt(elements, title) {
    return new Promise((resolve) => {
        const { backdrop, title: promptTitle, input, btnSave, btnCancel } = elements.promptModal;
        promptTitle.textContent = title;
        input.value = '';
        backdrop.style.display = 'flex';
        input.focus();
        const cleanupAndResolve = (value) => {
            backdrop.style.display = 'none';
            btnSave.removeEventListener('click', onSave);
            btnCancel.removeEventListener('click', onCancel);
            input.removeEventListener('keydown', onKeydown);
            resolve(value);
        };
        const onSave = () => {
            const value = input.value.trim();
            if (value) cleanupAndResolve(value);
        };
        const onCancel = () => cleanupAndResolve(null);
        const onKeydown = (e) => {
            if (e.key === 'Enter') onSave();
            else if (e.key === 'Escape') onCancel();
        };
        btnSave.addEventListener('click', onSave);
        btnCancel.addEventListener('click', onCancel);
        input.addEventListener('keydown', onKeydown);
    });
}

function popularModalComContato(elements, contactObject) {
    const form = document.getElementById('modal-contact-form');
    form.reset();
    for (const key in contactObject) {
        const inputId = `modal-contact-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        const inputElement = document.getElementById(inputId);
        if (inputElement) {
            inputElement.value = contactObject[key];
        }
    }
}

function abrirModalParaNovoContato(elements) {
    elements.modalTitle.textContent = 'Adicionar Novo Contato';
    popularModalComContato(elements, {});
    elements.contactModalBackdrop.style.display = 'flex';
    elements.btnDeleteContact.style.display = 'none';
}

function fecharModalContato(elements) {
    elements.contactModalBackdrop.style.display = 'none';
}

function findContactById(boardsData, contactId) {
    for (const board of boardsData) {
        if (board.item && Array.isArray(board.item)) {
            const found = board.item.find(c => c && c.id === contactId);
            if (found) return found;
        }
    }
    return null;
}

function getFormData(formElement) {
    const data = {};
    const inputs = formElement.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        const key = input.id.replace('modal-contact-', '').replace(/-(\w)/g, (match, letter) => letter.toUpperCase());
        data[key] = input.value;
    });
    return data;
}

// --- 2. FUNÇÕES PARA MODAL DE MENSAGEM (ADAPTADO PARA API) ---

function openMessageModal(contactId, contactName, contactPhone) {
    const modal = document.getElementById('message-modal');
    const contactNameSpan = document.getElementById('message-contact-name');
    const contactPhoneSpan = document.getElementById('message-contact-phone');
    const messageTextarea = document.getElementById('message-textarea');
    if (!modal || !contactNameSpan || !contactPhoneSpan || !messageTextarea) return;
    contactNameSpan.textContent = contactName || 'Nome não informado';
    contactPhoneSpan.textContent = contactPhone || 'Telefone não informado';
    messageTextarea.value = '';
    modal.dataset.contactId = contactId;
    modal.dataset.contactName = contactName;
    modal.dataset.contactPhone = contactPhone;
    modal.style.display = 'flex';
    messageTextarea.focus();
}

// Função para abrir o modal de histórico de mensagens
function openMessageHistoryModal(contactName, contactPhone) {
    const historyModal = document.getElementById('message-history-modal');
    const contactNameSpan = document.getElementById('history-contact-name');
    const contactPhoneSpan = document.getElementById('history-contact-phone');
    const contactAvatarSpan = document.getElementById('history-contact-avatar');
    const historyContainer = document.getElementById('message-history-container');
    
    if (!historyModal || !contactNameSpan || !contactPhoneSpan || !historyContainer) return;
    
    // Função para gerar iniciais do nome para o avatar
    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(word => word.charAt(0)).join('').substring(0, 2).toUpperCase();
    };
    
    contactNameSpan.textContent = contactName || 'Nome não informado';
    contactPhoneSpan.textContent = contactPhone || 'Telefone não informado';
    if (contactAvatarSpan) contactAvatarSpan.textContent = getInitials(contactName);
    historyContainer.innerHTML = '<div class="loading-message">Carregando mensagens...</div>';
    
    // Armazenar dados do contato no modal para uso posterior
    historyModal.dataset.contactName = contactName;
    historyModal.dataset.contactPhone = contactPhone;
    
    historyModal.style.display = 'flex';
    
    // Formatar o número para garantir que esteja no formato correto para a API
    const formattedPhone = formatPhoneNumberForApi(contactPhone);
    
    // Carregar o histórico de mensagens
    fetch(`${API_BASE_URL}/api/mensagens/${formattedPhone}`)
        .then(response => response.json())
        .then(data => {
            if (data.sucesso) {
                renderMessageHistory(data.historico || []);
            } else {
                historyContainer.innerHTML = 
                    '<div class="error-message">Erro ao carregar mensagens: ' + (data.erro || 'Erro desconhecido') + '</div>';
            }
        })
        .catch(error => {
            console.error('Erro ao carregar histórico de mensagens:', error);
            historyContainer.innerHTML = 
                '<div class="error-message">Erro ao carregar mensagens: ' + error.message + '</div>';
        });
}

// Função para formatar o número de telefone para a API
function formatPhoneNumberForApi(phoneNumber) {
    // Remove todos os caracteres não numéricos
    let formatted = phoneNumber.replace(/\D/g, '');
    
    // Se o número começar com 55 (código do Brasil) e tiver mais de 12 dígitos, mantém como está
    if (formatted.startsWith('55') && formatted.length >= 12) {
        return formatted;
    }
    
    // Se não começar com 55, adiciona o código do Brasil
    if (!formatted.startsWith('55')) {
        formatted = '55' + formatted;
    }
    
    return formatted;
}

// Função para renderizar o histórico de mensagens
function renderMessageHistory(messages) {
    const container = document.getElementById('message-history-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!messages || messages.length === 0) {
        container.innerHTML = '<div class="no-messages">Nenhuma mensagem encontrada.</div>';
        return;
    }
    
    // Função para gerar iniciais do nome para o avatar
    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(word => word.charAt(0)).join('').substring(0, 2).toUpperCase();
    };
    
    // Obter nome do contato do modal
    const historyModal = document.getElementById('message-history-modal');
    const contactName = historyModal ? historyModal.dataset.contactName : '';
    
    // Ordenar mensagens por timestamp (mais antigas primeiro)
    const sortedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);
    
    sortedMessages.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-bubble ${msg.fromMe ? 'message-sent' : 'message-received'}`;
        
        // Se for mensagem recebida, adicionar avatar
        if (!msg.fromMe) {
            const avatarDiv = document.createElement('div');
            avatarDiv.className = 'message-avatar';
            const avatarSpan = document.createElement('span');
            avatarSpan.textContent = getInitials(contactName);
            avatarDiv.appendChild(avatarSpan);
            messageDiv.appendChild(avatarDiv);
            
            const wrapperDiv = document.createElement('div');
            wrapperDiv.className = 'message-wrapper';
            
            const messageText = document.createElement('div');
            messageText.className = 'message-text';
            messageText.textContent = msg.message;
            
            const messageTime = document.createElement('div');
            messageTime.className = 'message-time';
            messageTime.textContent = formatMessageTime(msg.timestamp);
            
            wrapperDiv.appendChild(messageText);
            wrapperDiv.appendChild(messageTime);
            messageDiv.appendChild(wrapperDiv);
        } else {
            const messageText = document.createElement('div');
            messageText.className = 'message-text';
            messageText.textContent = msg.message;
            
            const messageTime = document.createElement('div');
            messageTime.className = 'message-time';
            messageTime.textContent = formatMessageTime(msg.timestamp);
            
            messageDiv.appendChild(messageText);
            messageDiv.appendChild(messageTime);
        }
        
        container.appendChild(messageDiv);
    });
    
    // Rolar para a mensagem mais recente
    container.scrollTop = container.scrollHeight;
}

// Função para adicionar uma nova mensagem ao histórico exibido
function addMessageToHistory(message) {
    const container = document.getElementById('message-history-container');
    if (!container) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-bubble ${message.fromMe ? 'message-sent' : 'message-received'}`;
    
    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    messageText.textContent = message.message;
    
    const messageTime = document.createElement('div');
    messageTime.className = 'message-time';
    messageTime.textContent = formatMessageTime(message.timestamp);
    
    messageDiv.appendChild(messageText);
    messageDiv.appendChild(messageTime);
    container.appendChild(messageDiv);
    
    // Rolar para a mensagem mais recente
    container.scrollTop = container.scrollHeight;
}

// Função para formatar o timestamp da mensagem
function formatMessageTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit'
    });
}

function closeMessageModal() {
    const modal = document.getElementById('message-modal');
    if (modal) modal.style.display = 'none';
}

function closeMessageHistoryModal() {
    const modal = document.getElementById('message-history-modal');
    if (modal) modal.style.display = 'none';
}

// Função para enviar mensagem do modal de histórico
async function sendMessageFromHistoryModal() {
    const historyModal = document.getElementById('message-history-modal');
    const messageInput = document.getElementById('history-message-input');
    const sendButton = document.getElementById('history-send-button');
    
    if (!historyModal || !messageInput || !sendButton) return;
    
    const message = messageInput.value.trim();
    const contactPhone = historyModal.dataset.contactPhone;
    const contactName = historyModal.dataset.contactName;
    
    if (!message || !contactPhone) {
        showCustomAlert('Erro', 'Número e mensagem são obrigatórios.');
        return;
    }
    
    sendButton.disabled = true;
    sendButton.textContent = 'Enviando...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/enviar-mensagem`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numero: contactPhone, mensagem: message })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.erro || 'Erro desconhecido do servidor');
        }
        
        // Limpar o campo de mensagem
        messageInput.value = '';
        
        // Adicionar a mensagem enviada ao histórico
        const newMessage = {
            message: message,
            timestamp: Date.now(),
            fromMe: true
        };
        
        addMessageToHistory(newMessage);
        
        showCustomAlert('Sucesso', result.mensagem || 'Mensagem enviada com sucesso!');
        
    } catch (error) {
        showCustomAlert('Erro', `Erro ao enviar mensagem: ${error.message}`);
    } finally {
        sendButton.disabled = false;
        sendButton.textContent = 'Enviar';
    }
}

async function sendMessageFromModal() {
    const modal = document.getElementById('message-modal');
    const messageTextarea = document.getElementById('message-textarea');
    const sendButton = document.getElementById('message-send-btn');
    const errorDiv = document.getElementById('message-error');
    if (!modal || !messageTextarea || !sendButton) return;

    const { contactPhone } = modal.dataset;
    const message = messageTextarea.value.trim();
    if (errorDiv) errorDiv.style.display = 'none';
    if (!message || !contactPhone) {
        if (errorDiv) {
            errorDiv.textContent = 'Número e mensagem são obrigatórios.';
            errorDiv.style.display = 'block';
        }
        return;
    }

    sendButton.disabled = true;
    sendButton.textContent = 'Enviando...';
    try {
        const response = await fetch(`${API_BASE_URL}/api/enviar-mensagem`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numero: contactPhone, mensagem: message })
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.erro || 'Erro desconhecido do servidor');
        }
        closeMessageModal();
        showCustomAlert('Sucesso', result.mensagem || 'Mensagem enviada com sucesso!');
    } catch (error) {
        if (errorDiv) {
            errorDiv.textContent = `Erro: ${error.message}`;
            errorDiv.style.display = 'block';
        }
    } finally {
        sendButton.disabled = false;
        sendButton.textContent = 'Enviar Mensagem';
    }
}


function setupMessageModalListeners(elements) {
    document.addEventListener('click', (event) => {
        if (event.target.classList.contains('btn-message')) {
            event.stopPropagation();
            const { contactId, contactName, contactPhone } = event.target.dataset;
            openMessageModal(contactId, contactName, contactPhone);
        }
    });
    document.getElementById('message-close-btn')?.addEventListener('click', closeMessageModal);
    document.getElementById('message-cancel-btn')?.addEventListener('click', closeMessageModal);
    document.getElementById('message-send-btn')?.addEventListener('click', sendMessageFromModal);
    document.getElementById('view-message-history-btn')?.addEventListener('click', () => {
        const contactName = document.getElementById('message-contact-name')?.textContent;
        const contactPhone = document.getElementById('message-contact-phone')?.textContent;
        openMessageHistoryModal(contactName, contactPhone);
    });
    const messageModal = document.getElementById('message-modal');
    messageModal?.addEventListener('click', (event) => {
        if (event.target === messageModal) closeMessageModal();
    });
    const messageTextarea = document.getElementById('message-textarea');
    messageTextarea?.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.key === 'Enter') {
            event.preventDefault();
            sendMessageFromModal();
        } else if (event.key === 'Escape') {
            closeMessageModal();
        }
    });
    
    // Configurar listeners para o modal de histórico de mensagens
    const historyModal = document.getElementById('message-history-modal');
    const historyCloseBtn = document.getElementById('history-close-btn');
    const historySendBtn = document.getElementById('history-send-button');
    const historyMessageInput = document.getElementById('history-message-input');
    
    historyCloseBtn?.addEventListener('click', closeMessageHistoryModal);
    historySendBtn?.addEventListener('click', sendMessageFromHistoryModal);
    
    historyModal?.addEventListener('click', (event) => {
        if (event.target === historyModal) closeMessageHistoryModal();
    });
    
    // Adicionar listener para Enter no input de mensagem do histórico
    historyMessageInput?.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.key === 'Enter') {
            event.preventDefault();
            sendMessageFromHistoryModal();
        } else if (event.key === 'Escape') {
            closeMessageHistoryModal();
        }
    });
}

// --- 3. LÓGICA DO KANBAN (ADAPTADO PARA API) ---

let kanban;
let idContatoEmEdicao = null;
let kanbanBoardsData = [];

async function salvarKanbanNaNuvem() {
    console.log('[Frontend] Enviando alterações para a API:', kanbanBoardsData);
    try {
        const response = await fetch(`${API_BASE_URL}/api/salvar-contatos`, {
            method: 'POST', // Usamos o método POST para enviar dados
            headers: {
                'Content-Type': 'application/json', // Informamos que estamos enviando JSON
            },
            body: JSON.stringify(kanbanBoardsData) // Convertemos nosso array de dados para uma string JSON
        });

        if (!response.ok) {
            // Se o servidor responder com um erro, nós o capturamos aqui
            const errorData = await response.json();
            throw new Error(errorData.erro || 'Falha ao salvar os dados no servidor.');
        }

        console.log('[Frontend] Dados salvos com sucesso via API.');
        // Opcional: mostrar uma pequena notificação de sucesso que some sozinha.

    } catch (error) {
        console.error('Erro ao salvar Kanban via API:', error);
        showCustomAlert('Erro de Rede', `Não foi possível salvar as alterações. Verifique a conexão com o servidor. Detalhes: ${error.message}`);
    }
}


function renderKanban(elements) {
    const kanbanContainer = document.getElementById("meuKanban");
    kanbanContainer.innerHTML = "";
    const boardsParaRenderizar = kanbanBoardsData.map(board => ({
        ...board,
        item: (board.item || []).map(contact => ({
            id: contact.id,
            title: gerarHtmlDoCard(contact),
            class: contact.stop && contact.stop.toUpperCase() === "SIM" ? "kanban-item-stop" : null,
        }))
    }));
    kanban = new jKanban({
        element: "#meuKanban",
        gutter: "20px",
        widthBoard: "300px",
        boards: boardsParaRenderizar,
        dropEl: async (el, target, source) => {
            const contactId = el.dataset.eid;
            const targetBoardId = target.parentElement.dataset.id;
            const sourceBoardId = source.parentElement.dataset.id;
            let movedContact = null;
            const sourceBoard = kanbanBoardsData.find(b => b.id === sourceBoardId);
            if (sourceBoard && sourceBoard.item) {
                const contactIndex = sourceBoard.item.findIndex(c => c && c.id === contactId);
                if (contactIndex > -1) {
                    [movedContact] = sourceBoard.item.splice(contactIndex, 1);
                }
            }
            const targetBoard = kanbanBoardsData.find(b => b.id === targetBoardId);
            if (targetBoard && movedContact) {
                if (!targetBoard.item) targetBoard.item = [];
                targetBoard.item.push(movedContact);
            }
            await salvarKanbanNaNuvem();
        }
    });
    addKanbanClickListeners(elements);
}

function addKanbanClickListeners(elements) {
    if (!kanban || !kanban.element) {
        console.error("[DEBUG] Kanban não inicializado. Saindo de addKanbanClickListeners.");
        return;
    }

    kanban.element.addEventListener("click", async (event) => {
        console.log("---------------------------------");
        console.log("[DEBUG] Clique detectado no Kanban.");
        console.log("[DEBUG] Elemento exato clicado (event.target):", event.target);

        const cardElement = event.target.closest(".kanban-item");
        if (!cardElement) {
            console.log("[DEBUG] O clique não foi dentro de um card (.kanban-item). Ignorando.");
            return;
        }
        console.log("[DEBUG] Card pai encontrado:", cardElement);

        // --- TENTATIVA DE ENCONTRAR O LINK DA PASTA ---
        const linkPastaClicado = event.target.closest(".link-pasta");
        console.log("[DEBUG] Resultado de closest('.link-pasta'):", linkPastaClicado);

        if (linkPastaClicado) {
            console.log("[DEBUG] SUCESSO! Entrando no bloco de código para 'link-pasta'.");
            event.preventDefault();
            event.stopPropagation();
            const url = linkPastaClicado.href;
            console.log(`[DEBUG] URL encontrada no data-url: ${url}`);
            if (url) {
                console.log("[DEBUG] Abrindo URL em nova aba...");
                window.open(url, '_blank', 'noopener,noreferrer');
            } else {
                console.warn("[DEBUG] O link foi clicado, mas não há data-url definido.");
            }
            return;
        }

        // --- Se não encontrou o link, continua a verificação para outros botões ---
        const stopButtonClicado = event.target.closest(".btn-stop");
        if (stopButtonClicado) {
            console.log("[DEBUG] Botão STOP clicado. A lógica do STOP será executada.");
            event.stopPropagation();
            stopButtonClicado.disabled = true;
            stopButtonClicado.textContent = '...';
            try {
                const contactId = cardElement.dataset.eid;
                const response = await fetch(`${API_BASE_URL}/api/marcar-stop`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contactId })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.erro || 'Erro desconhecido');
                
                const contactData = findContactById(kanbanBoardsData, contactId);
                if(contactData) contactData.stop = 'SIM';
                renderKanban(elements);
                showCustomAlert('Sucesso', result.mensagem || 'Status STOP atualizado.');
            } catch (error) {
                showCustomAlert('Erro', `Falha ao marcar STOP: ${error.message}`);
                stopButtonClicado.disabled = false;
                stopButtonClicado.textContent = '🚫 STOP';
            }
            return;
        }
        
        // --- Verificação para o botão de remover STOP ---
        const removeStopButtonClicado = event.target.closest(".btn-remove-stop");
        if (removeStopButtonClicado) {
            console.log("[DEBUG] Botão Remover STOP clicado.");
            event.stopPropagation();
            removeStopButtonClicado.disabled = true;
            removeStopButtonClicado.textContent = '...';
            try {
                const contactId = cardElement.dataset.eid;
                const response = await fetch(`${API_BASE_URL}/api/remover-stop`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contactId })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.erro || 'Erro desconhecido');
                
                const contactData = findContactById(kanbanBoardsData, contactId);
                if(contactData) contactData.stop = '';
                renderKanban(elements);
                showCustomAlert('Sucesso', result.mensagem || 'Status STOP removido.');
            } catch (error) {
                showCustomAlert('Erro', `Falha ao remover STOP: ${error.message}`);
                removeStopButtonClicado.disabled = false;
                removeStopButtonClicado.textContent = '✅ Remover STOP';
            }
            return;
        }

        const messageButtonClicado = event.target.closest(".btn-message");
        if (messageButtonClicado) {
            console.log("[DEBUG] Botão MENSAGEM clicado. Parando propagação.");
            event.stopPropagation();
            
            // Obter os dados do contato do botão
            const contactId = messageButtonClicado.dataset.contactId;
            const contactName = messageButtonClicado.dataset.contactName;
            const contactPhone = messageButtonClicado.dataset.contactPhone;
            
            // Abrir o modal de mensagem
            console.log("[DEBUG] Abrindo modal de mensagem para:", contactName, contactPhone);
            openMessageModal(contactId, contactName, contactPhone);
            return;
        }

        console.log("[DEBUG] Nenhum botão/link específico foi clicado. Abrindo modal de edição.");
        const contactId = cardElement.dataset.eid;
        const contactData = findContactById(kanbanBoardsData, contactId);
        if (!contactData) return;
        idContatoEmEdicao = contactData.id;
        elements.modalTitle.textContent = "Editar Contato";
        elements.modalTitle.dataset.contactId = contactData.id;
        popularModalComContato(elements, contactData);
        elements.btnDeleteContact.style.display = "block";
        elements.contactModalBackdrop.style.display = "flex";
    });

    // Listener de duplo clique (sem alterações)
    kanban.element.addEventListener("dblclick", (event) => {
        // ... (código do dblclick) ...
    });
}


function setupKanbanEventListeners(elements) {
    elements.btnAbrirModalContato.addEventListener('click', () => {
        idContatoEmEdicao = null;
        abrirModalParaNovoContato(elements);
    });
    elements.btnCloseModal.addEventListener('click', () => fecharModalContato(elements));
    elements.contactModalBackdrop.addEventListener('click', (event) => {
        if (event.target === elements.contactModalBackdrop) fecharModalContato(elements);
    });
    elements.btnAddBoard.addEventListener('click', async () => {
        const nomeDaColuna = await showCustomPrompt(elements, 'Digite o nome da nova coluna:');
        if (nomeDaColuna) {
            const novaColuna = { id: `_board_${Date.now()}`, title: nomeDaColuna, item: [] };
            kanbanBoardsData.push(novaColuna);
            await salvarKanbanNaNuvem();
            renderKanban(elements);
        }
    });
    elements.kanbanSearchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        document.querySelectorAll('.kanban-item').forEach(cardElement => {
            const contactId = cardElement.dataset.eid;
            const contact = findContactById(kanbanBoardsData, contactId);
            if (contact) {
                const match = (contact.numero || '').includes(searchTerm) || (contact.nome || '').toLowerCase().includes(searchTerm);
                cardElement.style.display = match ? '' : 'none';
            }
        });
    });
    document.getElementById('modal-contact-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = getFormData(e.target);
        if (!formData.nome || !formData.numero) {
            return showCustomAlert('Atenção', 'Preencha pelo menos o nome e o número.');
        }
        if (idContatoEmEdicao) {
            const originalContact = findContactById(kanbanBoardsData, idContatoEmEdicao);
            const updatedContact = { ...originalContact, ...formData, id: idContatoEmEdicao };
            const board = kanbanBoardsData.find(b => b.item && b.item.some(c => c && c.id === idContatoEmEdicao));
            if (board) {
                const contactIndex = board.item.findIndex(c => c && c.id === idContatoEmEdicao);
                if (contactIndex > -1) board.item[contactIndex] = updatedContact;
            }
        } else {
            const novoContato = { ...formData, id: `_contact_${Date.now()}` };
            if (kanbanBoardsData.length > 0) {
                if (!kanbanBoardsData[0].item) kanbanBoardsData[0].item = [];
                kanbanBoardsData[0].item.push(novoContato);
            } else {
                return showCustomAlert('Atenção', 'Crie uma coluna antes de adicionar contatos.');
            }
        }
        await salvarKanbanNaNuvem();
        fecharModalContato(elements);
        renderKanban(elements);
        idContatoEmEdicao = null;
    });
}

// --- 4. LÓGICA PRINCIPAL DA INTERFACE (ADAPTADO PARA API) ---

let elements;

function switchPage(pageId) {
    elements.pages.forEach(page => page.classList.remove('active'));
    elements.navLinks.forEach(link => link.classList.remove('active'));
    const pageToShow = document.getElementById(pageId);
    if (pageToShow) pageToShow.classList.add('active');
    const linkToActivate = document.querySelector(`.nav-link[data-page="${pageId}"]`);
    if (linkToActivate) linkToActivate.classList.add('active');
    if (pageId === 'contatos' && (!kanbanBoardsData || kanbanBoardsData.length === 0)) {
        loadInitialData();
    }
}

async function handleDeleteContact() {
    const contactId = elements.modalTitle.dataset.contactId;
    if (!contactId) return showCustomAlert("Erro", "ID do contato não encontrado.");
    const confirmed = await showCustomConfirm("Confirmar Exclusão", "Você tem certeza que deseja apagar este contato?");
    if (confirmed) {
        // ADAPTADO: A lógica agora é remover do frontend e depois salvar o estado completo
        for (const board of kanbanBoardsData) {
            const index = board.item?.findIndex(c => c && c.id === contactId);
            if (index > -1) {
                board.item.splice(index, 1);
                break;
            }
        }
        await salvarKanbanNaNuvem(); // Salva o novo estado sem o contato
        fecharModalContato(elements);
        renderKanban(elements);
        showCustomAlert('Sucesso', 'Contato apagado.');
    }
}

// Função para abrir o modal de seleção de colunas para envio em massa
function openColumnSelectionModal() {
    // Criar o modal dinamicamente se não existir
    let modal = document.getElementById('column-selection-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'column-selection-modal';
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content" style="width: 600px;">
                <div class="modal-header">
                    <h2 class="modal-title">Selecionar Colunas para Envio</h2>
                    <button id="column-selection-close-btn" class="modal-close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Selecione as colunas que contêm os contatos para envio em massa:</p>
                    <div id="column-selection-container" style="margin-top: 15px; max-height: 300px; overflow-y: auto;"></div>
                    <label for="mass-message-textarea" style="margin-top: 20px;">Mensagem a ser enviada:</label>
                    <textarea id="mass-message-textarea" rows="5" placeholder="Digite a mensagem que será enviada para todos os contatos selecionados..."></textarea>
                </div>
                <div class="modal-footer">
                    <button id="column-selection-cancel-btn" class="secondary">Cancelar</button>
                    <button id="column-selection-send-btn">Enviar Mensagens</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Adicionar event listeners
        document.getElementById('column-selection-close-btn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        document.getElementById('column-selection-cancel-btn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        document.getElementById('column-selection-send-btn').addEventListener('click', sendMassMessages);
        modal.addEventListener('click', (event) => {
            if (event.target === modal) modal.style.display = 'none';
        });
    }
    
    // Preencher o container com checkboxes para cada coluna
    const columnSelectionContainer = document.getElementById('column-selection-container');
    columnSelectionContainer.innerHTML = '';
    
    kanbanBoardsData.forEach(board => {
        const boardDiv = document.createElement('div');
        boardDiv.className = 'column-selection-item';
        boardDiv.style.margin = '10px 0';
        boardDiv.style.padding = '10px';
        boardDiv.style.backgroundColor = '#333';
        boardDiv.style.borderRadius = '5px';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `column-${board.id}`;
        checkbox.dataset.boardId = board.id;
        checkbox.style.marginRight = '10px';
        
        const label = document.createElement('label');
        label.htmlFor = `column-${board.id}`;
        label.textContent = `${board.title} (${board.item ? board.item.length : 0} contatos)`;
        
        boardDiv.appendChild(checkbox);
        boardDiv.appendChild(label);
        columnSelectionContainer.appendChild(boardDiv);
    });
    
    // Exibir o modal
    modal.style.display = 'flex';
}

// Função para enviar mensagens em massa para os contatos das colunas selecionadas
async function sendMassMessages() {
    const selectedBoardIds = [];
    const checkboxes = document.querySelectorAll('#column-selection-container input[type="checkbox"]:checked');
    checkboxes.forEach(checkbox => {
        selectedBoardIds.push(checkbox.dataset.boardId);
    });
    
    if (selectedBoardIds.length === 0) {
        showCustomAlert('Atenção', 'Selecione pelo menos uma coluna para enviar mensagens.');
        return;
    }
    
    const message = document.getElementById('mass-message-textarea').value.trim();
    if (!message) {
        showCustomAlert('Atenção', 'Digite uma mensagem para enviar.');
        return;
    }
    
    // Coletar todos os contatos das colunas selecionadas
    const contactsToSend = [];
    selectedBoardIds.forEach(boardId => {
        const board = kanbanBoardsData.find(b => b.id === boardId);
        if (board && board.item) {
            board.item.forEach(contact => {
                // Verificar se o contato não tem STOP ativado
                if (!contact.stop || contact.stop.toUpperCase() !== 'SIM') {
                    contactsToSend.push({
                        id: contact.id,
                        nome: contact.nome || '',
                        numero: contact.numero || ''
                    });
                }
            });
        }
    });
    
    if (contactsToSend.length === 0) {
        showCustomAlert('Atenção', 'Não há contatos válidos nas colunas selecionadas ou todos estão com STOP ativado.');
        return;
    }
    
    // Confirmar o envio
    const confirmed = await showCustomConfirm(
        'Confirmar Envio em Massa', 
        `Você está prestes a enviar mensagens para ${contactsToSend.length} contatos. Deseja continuar?`
    );
    
    if (!confirmed) return;
    
    // Fechar o modal de seleção
    document.getElementById('column-selection-modal').style.display = 'none';
    
    // Mostrar progresso
    const logEnvios = document.getElementById('log-envios');
    logEnvios.textContent = `Iniciando envio em massa para ${contactsToSend.length} contatos...\n`;
    
    // Enviar mensagens
    let successCount = 0;
    let failCount = 0;
    
    for (const contact of contactsToSend) {
        try {
            logEnvios.textContent += `Enviando para ${contact.nome} (${contact.numero})...\n`;
            
            const response = await fetch(`${API_BASE_URL}/api/enviar-mensagem`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ numero: contact.numero, mensagem: message })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                successCount++;
                logEnvios.textContent += `✅ Mensagem enviada com sucesso para ${contact.nome}\n`;
            } else {
                failCount++;
                logEnvios.textContent += `❌ Falha ao enviar para ${contact.nome}: ${result.erro || 'Erro desconhecido'}\n`;
            }
            
            // Pequeno delay para não sobrecarregar a API
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Manter o scroll no final do log
            logEnvios.scrollTop = logEnvios.scrollHeight;
            
        } catch (error) {
            failCount++;
            logEnvios.textContent += `❌ Erro ao enviar para ${contact.nome}: ${error.message}\n`;
            logEnvios.scrollTop = logEnvios.scrollHeight;
        }
    }
    
    // Resumo final
    logEnvios.textContent += `\n=== RESUMO DO ENVIO EM MASSA ===\n`;
    logEnvios.textContent += `✅ Mensagens enviadas com sucesso: ${successCount}\n`;
    logEnvios.textContent += `❌ Falhas no envio: ${failCount}\n`;
    logEnvios.textContent += `Total de contatos processados: ${contactsToSend.length}\n`;
    logEnvios.scrollTop = logEnvios.scrollHeight;
    
    // Notificar o usuário
    showCustomAlert('Envio em Massa Concluído', 
        `Mensagens enviadas: ${successCount}\nFalhas: ${failCount}\nTotal: ${contactsToSend.length}`
    );
}

function handleManualSend() {
    // Verificar se estamos na página de contatos ou na página de envio manual
    const contatosPage = document.getElementById('contatos');
    
    if (contatosPage.classList.contains('active')) {
        // Se estamos na página de contatos, abrir o modal de seleção de colunas
        openColumnSelectionModal();
    } else {
        // Se estamos na página de envio manual, usar a funcionalidade tradicional
        const numeros = document.getElementById('numeros').value.trim();
        const mensagem = document.getElementById('legenda').value.trim();
        
        if (!numeros || !mensagem) {
            showCustomAlert('Atenção', 'Preencha os números e a mensagem para enviar.');
            return;
        }
        
        // Dividir os números por linha e remover espaços
        const numerosList = numeros.split('\n')
            .map(num => num.trim())
            .filter(num => num.length > 0);
        
        if (numerosList.length === 0) {
            showCustomAlert('Atenção', 'Adicione pelo menos um número válido.');
            return;
        }
        
        // Confirmar o envio
        showCustomConfirm(
            'Confirmar Envio', 
            `Você está prestes a enviar mensagens para ${numerosList.length} números. Deseja continuar?`
        ).then(async (confirmed) => {
            if (!confirmed) return;
            
            // Mostrar progresso
            const logEnvios = document.getElementById('log-envios');
            logEnvios.textContent = `Iniciando envio para ${numerosList.length} números...\n`;
            
            // Enviar mensagens
            let successCount = 0;
            let failCount = 0;
            
            for (const numero of numerosList) {
                try {
                    logEnvios.textContent += `Enviando para ${numero}...\n`;
                    
                    const response = await fetch(`${API_BASE_URL}/api/enviar-mensagem`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ numero, mensagem })
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok) {
                        successCount++;
                        logEnvios.textContent += `✅ Mensagem enviada com sucesso para ${numero}\n`;
                    } else {
                        failCount++;
                        logEnvios.textContent += `❌ Falha ao enviar para ${numero}: ${result.erro || 'Erro desconhecido'}\n`;
                    }
                    
                    // Pequeno delay para não sobrecarregar a API
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Manter o scroll no final do log
                    logEnvios.scrollTop = logEnvios.scrollHeight;
                    
                } catch (error) {
                    failCount++;
                    logEnvios.textContent += `❌ Erro ao enviar para ${numero}: ${error.message}\n`;
                    logEnvios.scrollTop = logEnvios.scrollHeight;
                }
            }
            
            // Resumo final
            logEnvios.textContent += `\n=== RESUMO DO ENVIO ===\n`;
            logEnvios.textContent += `✅ Mensagens enviadas com sucesso: ${successCount}\n`;
            logEnvios.textContent += `❌ Falhas no envio: ${failCount}\n`;
            logEnvios.textContent += `Total de números processados: ${numerosList.length}\n`;
            logEnvios.scrollTop = logEnvios.scrollHeight;
            
            // Notificar o usuário
            showCustomAlert('Envio Concluído', 
                `Mensagens enviadas: ${successCount}\nFalhas: ${failCount}\nTotal: ${numerosList.length}`
            );
        });
    }
}

async function loadInitialData() {
    try {
        console.log(`[Frontend] Solicitando dados da API em ${API_BASE_URL}/api/contatos`);
        const response = await fetch(`${API_BASE_URL}/api/contatos`);
        if (!response.ok) {
            throw new Error(`Erro na API: ${response.statusText}`);
        }
        const initialData = await response.json();
        if (Array.isArray(initialData)) {
            console.log("[Frontend] Dados recebidos da API. Renderizando Kanban...");
            kanbanBoardsData = initialData;
        } else {
            console.log("[Frontend] Nenhum dado válido recebido. Usando colunas padrão.");
            kanbanBoardsData = [{ id: '_leads', title: 'Leads', item: [] }];
        }
        renderKanban(elements);
    } catch (error) {
        console.error("Erro ao carregar dados iniciais da API:", error);
        showCustomAlert("Erro Crítico", `Não foi possível carregar os dados do servidor. Verifique se o backend está rodando. Detalhes: ${error.message}`);
    }
}

// --- 5. PONTO DE ENTRADA DA APLICAÇÃO ---

function setupEventListeners() {
    elements.navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = link.getAttribute('data-page');
            switchPage(pageId);
        });
    });
    elements.sidebarToggleBtn.addEventListener('click', () => {
        elements.sidebar.classList.toggle('collapsed');
        elements.sidebarToggleBtn.textContent = elements.sidebar.classList.contains('collapsed') ? '»' : '«';
    });
    elements.btnDeleteContact.addEventListener('click', handleDeleteContact);
    elements.btnEnviarManual.addEventListener('click', handleManualSend);
    
    // Adicionar listener para o botão de envio em massa na página de contatos
    const btnEnviarKanban = document.getElementById('btn-enviar-kanban');
    if (btnEnviarKanban) {
        btnEnviarKanban.addEventListener('click', openColumnSelectionModal);
    }

    elements.btnSelecionarArquivo.addEventListener('click', () => elements.seletorArquivo.click());
    elements.seletorArquivo.addEventListener('change', () => {
        elements.spanArquivo.textContent = elements.seletorArquivo.files.length > 0 ? `Arquivo: ${elements.seletorArquivo.files[0].name}` : 'Nenhum arquivo.';
    });
    setupKanbanEventListeners(elements);
    setupMessageModalListeners(elements);
}

function main() {
    elements = {
        sidebar: document.getElementById('sidebar'),
        sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
        navLinks: document.querySelectorAll('.nav-link'),
        pages: document.querySelectorAll('.page'),
        logEnvios: document.getElementById('log-envios'),
        logConexao: document.getElementById('log-conexao'),
        waStatusDot: document.getElementById('wa-status-dot'),
        btnEnviarManual: document.getElementById('btn-enviar-manual'),
        btnSelecionarArquivo: document.getElementById('btn-selecionar-arquivo'),
        seletorArquivo: document.getElementById('seletor-arquivo'),
        spanArquivo: document.getElementById('arquivo-selecionado'),
        btnLimparContatos: document.getElementById('btn-limpar-contatos'),
        btnDeleteContact: document.getElementById('btn-delete-contact'),
        contactModalBackdrop: document.getElementById('contact-modal-backdrop'),
        btnCloseModal: document.getElementById('btn-close-modal'),
        modalTitle: document.getElementById('modal-title'),
        btnAbrirModalContato: document.getElementById('btn-abrir-modal-contato'),
        btnAddBoard: document.getElementById('btn-add-board'),
        kanbanSearchInput: document.getElementById('kanban-search-input'),
        btnSaveContact: document.getElementById('btn-save-contact'),
        promptModal: {
            backdrop: document.getElementById('prompt-modal-backdrop'),
            title: document.getElementById('prompt-modal-title'),
            input: document.getElementById('prompt-modal-input'),
            btnSave: document.getElementById('prompt-modal-btn-save'),
            btnCancel: document.getElementById('prompt-modal-btn-cancel'),
        }
    };


    function setupSocketListeners() {
    const socket = io(API_BASE_URL); // Conecta ao seu servidor backend

    socket.on('connect', () => {
        console.log('[Socket.IO] Conectado com sucesso ao servidor backend. ID do Socket:', socket.id);
        elements.logConexao.textContent = 'Conectado ao servidor. Aguardando status do WhatsApp...';
    });

    socket.on('whatsapp-qr', (qr) => {
        console.log('[Socket.IO] QR Code recebido. Tentando renderizar...');
        const qrDisplay = document.getElementById('qrcode-display');
        if (!qrDisplay) {
            console.error('Elemento #qrcode-display não encontrado no DOM.');
            return;
        }
        
        // Limpa qualquer conteúdo anterior (seja um canvas ou uma mensagem de erro)
        qrDisplay.innerHTML = '';
        qrDisplay.style.display = 'block';
        elements.logConexao.textContent = 'Escaneie o QR Code para conectar:';

        // --- CORREÇÃO FINAL E MAIS ROBUSTA ---
        try {
            // 1. Crie uma nova instância do QRious sem associá-la a um elemento ainda.
            const qrcode = new QRious({
                value: qr,
                size: 250,
                padding: 10,
                level: 'L'
            });

            // 2. A biblioteca gera um elemento <canvas>. Adicione este canvas ao seu div.
            qrDisplay.appendChild(qrcode.canvas);
            console.log('QR Code renderizado e adicionado ao DOM com sucesso.');

        } catch (error) {
            console.error('Erro ao criar ou renderizar o QRious:', error);
            elements.logConexao.textContent = 'Erro ao gerar o QR Code.';
        }
    });


    socket.on('whatsapp-status', (data) => {
        console.log('[Socket.IO] Status do WhatsApp recebido:', data);
        const qrDisplay = document.getElementById('qrcode-display');
        
        elements.logConexao.textContent = data.message;
        if (qrDisplay) qrDisplay.style.display = 'none'; // Esconde o QR code

        if (data.status === 'connected') {
            elements.waStatusDot.className = 'status-dot green';
        } else {
            elements.waStatusDot.className = 'status-dot red';
        }
    });

    socket.on('disconnect', () => {
        console.log('[Socket.IO] Desconectado do servidor backend.');
        elements.logConexao.textContent = 'Desconectado do servidor. Tentando reconectar...';
        elements.waStatusDot.className = 'status-dot red';
    });
    
    // Listener para atualizações de mensagens em tempo real
    socket.on('message-update', (data) => {
        console.log('[Socket.IO] Atualização de mensagem recebida:', data);
        
        // Se o modal de histórico estiver aberto, atualizar em tempo real
        const historyModal = document.getElementById('message-history-modal');
        if (historyModal && historyModal.style.display === 'flex') {
            const contactPhone = document.getElementById('history-contact-phone')?.textContent;
            if (contactPhone) {
                const formattedPhone = formatPhoneNumberForApi(contactPhone);
                const messageFrom = data.from || data.to;
                const formattedFrom = formatPhoneNumberForApi(messageFrom);
                
                // Se a mensagem for do contato que está sendo visualizado, adicionar à lista
                if (formattedPhone === formattedFrom) {
                    // Criar novo objeto de mensagem no formato esperado pelo renderizador
                    const newMessage = {
                        message: data.message,
                        timestamp: data.timestamp || Date.now(),
                        fromMe: data.type === 'sent'
                    };
                    
                    // Adicionar a nova mensagem ao histórico
                    addMessageToHistory(newMessage);
                }
            }
        }
    });
}

    setupEventListeners();
    setupSocketListeners();
    switchPage('contatos'); // Inicia na página de contatos para carregar os dados.


}

document.addEventListener('DOMContentLoaded', main);
