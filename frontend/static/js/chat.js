/**
 * Enhanced AI Hostel Chat Interface JavaScript
 * Advanced real-time messaging with modern features
 */

class EnhancedChatInterface {
    constructor() {
        this.apiBaseUrl = '/api';
        this.messagesContainer = document.getElementById('messages-container');
        this.messagesList = document.getElementById('messages-list');
        this.messageForm = document.getElementById('message-form');
        this.messageInput = document.getElementById('message-input');
        this.sendButton = document.getElementById('send-button');
        this.charCount = document.getElementById('char-count');
        this.typingIndicator = document.getElementById('typing-indicator');
        this.statusIndicator = document.getElementById('status-indicator');
        this.connectionModal = document.getElementById('connection-modal');
        
        // Enhanced elements
        this.searchBar = document.getElementById('search-bar');
        this.searchInput = document.getElementById('search-input');
        this.attachmentMenu = document.getElementById('attachment-menu');
        this.emojiPicker = document.getElementById('emoji-picker');
        this.smartSuggestions = document.getElementById('smart-suggestions');
        this.suggestionsContainer = document.getElementById('suggestions-container');
        this.scrollToBottomBtn = document.getElementById('scroll-to-bottom');
        
        // Check for required elements
        if (!this.messageForm || !this.messageInput || !this.sendButton) {
            console.error('Required chat elements not found. Chat functionality may not work properly.');
            return;
        }
        
        // User context from template
        this.userContext = this.getUserContext();
        
        // State management
        this.isConnected = true;
        this.isTyping = false;
        this.isRecording = false;
        this.typingTimeout = null;
        this.messageQueue = [];
        this.conversationId = null;
        this.messages = [];
        this.searchResults = [];
        this.currentSearchIndex = 0;
        this.settings = this.loadSettings();
        
        // Media recorder for voice messages
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.recordingStartTime = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupQuickActions();
        this.setupAttachments();
        this.setupEmojis();
        this.setupVoiceRecording();
        this.setupSearch();
        this.setupSettings();
        this.loadConversationHistory(); // Load previous messages on page load
        this.startConnectionMonitoring();
        this.updateWelcomeTime();
        this.applySettings();
        this.setupKeyboardShortcuts();
        this.setupScrollBehavior();
        this.requestNotificationPermission();
    }
    
    setupEventListeners() {
        // Message form submission
        if (this.messageForm) {
            this.messageForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendMessage();
            });
        }
        
        // Enhanced message input events
        if (this.messageInput) {
            this.messageInput.addEventListener('input', () => {
                this.handleInputChange();
                this.generateSmartSuggestions();
            });
            
            this.messageInput.addEventListener('keydown', (e) => {
                this.handleKeyDown(e);
            });
            
            this.messageInput.addEventListener('paste', (e) => {
                this.handlePaste(e);
            });
            
            // Focus events
            this.messageInput.addEventListener('focus', () => {
                this.scrollToBottom();
                this.hideAttachmentMenu();
                this.hideEmojiPicker();
            });
        }
        
        // Send button click event
        if (this.sendButton) {
            this.sendButton.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.messageInput && this.messageInput.value.trim()) {
                    this.sendMessage();
                }
            });
        }
        
        // Connection events
        window.addEventListener('online', () => this.handleConnectionChange(true));
        window.addEventListener('offline', () => this.handleConnectionChange(false));
        
        // Visibility change for read receipts
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.markMessagesAsRead();
            }
        });
        
        // Scroll events
        if (this.messagesContainer) {
            this.messagesContainer.addEventListener('scroll', () => {
                this.handleScroll();
            });
        }
        
        // Click outside to close menus
        document.addEventListener('click', (e) => {
            this.handleOutsideClick(e);
        });
    }
    
    setupQuickActions() {
        document.querySelectorAll('.quick-action-btn').forEach(button => {
            button.addEventListener('click', () => {
                const message = button.dataset.message;
                this.messageInput.value = message;
                this.handleInputChange();
                this.messageInput.focus();
                
                // Add visual feedback
                button.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    button.style.transform = '';
                }, 150);
            });
        });
    }
    
    setupAttachments() {
        const attachmentBtn = document.getElementById('attachment-btn');
        const imageInput = document.getElementById('image-input');
        const documentInput = document.getElementById('document-input');
        
        attachmentBtn.addEventListener('click', () => {
            this.toggleAttachmentMenu();
        });
        
        document.querySelectorAll('.attachment-option').forEach(option => {
            option.addEventListener('click', () => {
                const type = option.dataset.type;
                this.handleAttachmentType(type);
            });
        });
        
        imageInput.addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files[0], 'image');
        });
        
        documentInput.addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files[0], 'document');
        });
    }
    
    setupEmojis() {
        const emojiBtn = document.getElementById('emoji-btn');
        
        emojiBtn.addEventListener('click', () => {
            this.toggleEmojiPicker();
        });
        
        document.querySelectorAll('.emoji-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const emoji = btn.textContent;
                this.insertEmoji(emoji);
            });
        });
    }
    
    setupVoiceRecording() {
        const voiceBtn = document.getElementById('voice-btn');
        const voiceModal = document.getElementById('voice-modal');
        const voiceCancel = document.getElementById('voice-cancel');
        const voiceSend = document.getElementById('voice-send');
        
        voiceBtn.addEventListener('mousedown', () => this.startVoiceRecording());
        voiceBtn.addEventListener('mouseup', () => this.stopVoiceRecording());
        voiceBtn.addEventListener('mouseleave', () => this.stopVoiceRecording());
        
        // Touch events for mobile
        voiceBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startVoiceRecording();
        });
        
        voiceBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopVoiceRecording();
        });
        
        voiceCancel.addEventListener('click', () => this.cancelVoiceRecording());
        voiceSend.addEventListener('click', () => this.sendVoiceMessage());
    }
    
    setupSearch() {
        const searchToggle = document.getElementById('search-toggle');
        const searchClose = document.getElementById('search-close');
        
        if (searchToggle) {
            searchToggle.addEventListener('click', () => {
                this.toggleSearch();
            });
        } else {
            console.warn('Search toggle button not found');
        }
        
        if (searchClose) {
            searchClose.addEventListener('click', () => {
                this.hideSearch();
            });
        }
        
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                this.performSearch(e.target.value);
            });
            
            this.searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.navigateSearchResults(e.shiftKey ? -1 : 1);
                } else if (e.key === 'Escape') {
                    this.hideSearch();
                }
            });
        } else {
            console.warn('Search input not found');
        }
    }
    
    setupSettings() {
        const settingsToggle = document.getElementById('settings-toggle');
        const settingsModal = document.getElementById('settings-modal');
        const settingsClose = document.getElementById('settings-close');
        const settingsSave = document.getElementById('settings-save');
        const settingsReset = document.getElementById('settings-reset');
        
        if (settingsToggle) {
            settingsToggle.addEventListener('click', () => {
                if (settingsModal) {
                    settingsModal.classList.remove('hidden');
                    this.updateSettingsUI();
                } else {
                    console.warn('Settings modal not found');
                }
            });
        } else {
            console.warn('Settings toggle button not found');
        }
        
        if (settingsClose) {
            settingsClose.addEventListener('click', () => {
                if (settingsModal) {
                    settingsModal.classList.add('hidden');
                }
            });
        }
        
        if (settingsSave) {
            settingsSave.addEventListener('click', () => {
                this.saveSettings();
                if (settingsModal) {
                    settingsModal.classList.add('hidden');
                }
            });
        }
        
        if (settingsReset) {
            settingsReset.addEventListener('click', () => {
                this.resetSettings();
            });
        }
        
        // Clear chat functionality
        const clearChatBtn = document.getElementById('clear-chat');
        const clearChatModal = document.getElementById('clear-chat-modal');
        const clearChatCancel = document.getElementById('clear-chat-cancel');
        const clearChatConfirm = document.getElementById('clear-chat-confirm');
        
        if (clearChatBtn) {
            clearChatBtn.addEventListener('click', () => {
                if (clearChatModal) {
                    clearChatModal.classList.remove('hidden');
                } else {
                    // Fallback: direct clear if modal not found
                    if (confirm('Are you sure you want to clear the chat? This cannot be undone.')) {
                        this.clearChat();
                    }
                }
            });
        }
        
        if (clearChatCancel) {
            clearChatCancel.addEventListener('click', () => {
                if (clearChatModal) {
                    clearChatModal.classList.add('hidden');
                }
            });
        }
        
        if (clearChatConfirm) {
            clearChatConfirm.addEventListener('click', () => {
                this.clearChat();
                if (clearChatModal) {
                    clearChatModal.classList.add('hidden');
                }
            });
        }
        
        // Export chat functionality
        const exportChatBtn = document.getElementById('export-chat');
        if (exportChatBtn) {
            exportChatBtn.addEventListener('click', () => {
                this.exportChat();
            });
        } else {
            console.warn('Export chat button not found');
        }
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Enter to send message
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (this.messageInput.value.trim()) {
                    this.sendMessage();
                }
            }
            
            // Ctrl/Cmd + K to focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.toggleSearch();
            }
            
            // Escape to clear input or close modals
            if (e.key === 'Escape') {
                if (this.messageInput === document.activeElement && this.messageInput.value) {
                    this.messageInput.value = '';
                    this.handleInputChange();
                } else {
                    this.hideAllModals();
                }
            }
            
            // Ctrl/Cmd + L to clear chat
            if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
                e.preventDefault();
                document.getElementById('clear-chat-modal').classList.remove('hidden');
            }
        });
    }
    
    setupScrollBehavior() {
        this.scrollToBottomBtn.addEventListener('click', () => {
            this.scrollToBottom(true);
        });
    }
    
    handleInputChange() {
        const value = this.messageInput.value;
        const count = value.length;
        
        // Auto-resize textarea
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 150) + 'px';
        
        // Update character count
        this.charCount.textContent = `${count}/2000`;
        this.charCount.className = count > 1800 ? 'text-red-500 text-xs' : 'text-gray-400 text-xs';
        
        // Enable/disable send button
        this.sendButton.disabled = count === 0;
        this.updateSendButtonState(count > 0);
        
        // Handle typing indicator
        this.handleTypingIndicator();
    }
    
    handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (this.messageInput.value.trim()) {
                this.sendMessage();
            }
        }
    }
    
    handlePaste(e) {
        const items = e.clipboardData.items;
        
        for (let item of items) {
            if (item.type.indexOf('image') !== -1) {
                e.preventDefault();
                const file = item.getAsFile();
                this.handleFileUpload(file, 'image');
                break;
            }
        }
    }
    
    handleScroll() {
        const { scrollTop, scrollHeight, clientHeight } = this.messagesContainer;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
        
        if (isAtBottom) {
            this.scrollToBottomBtn.classList.add('hidden');
        } else {
            this.scrollToBottomBtn.classList.remove('hidden');
        }
    }
    
    handleOutsideClick(e) {
        if (!this.attachmentMenu.contains(e.target) && !document.getElementById('attachment-btn').contains(e.target)) {
            this.hideAttachmentMenu();
        }
        
        if (!this.emojiPicker.contains(e.target) && !document.getElementById('emoji-btn').contains(e.target)) {
            this.hideEmojiPicker();
        }
    }
    
    
    updateSendButtonState(enabled) {
        if (enabled) {
            this.sendButton.classList.remove('from-gray-300', 'to-gray-400');
            this.sendButton.classList.add('from-whatsapp-green', 'to-green-500', 'hover:from-whatsapp-dark-green', 'hover:to-green-600');
        } else {
            this.sendButton.classList.add('from-gray-300', 'to-gray-400');
            this.sendButton.classList.remove('from-whatsapp-green', 'to-green-500', 'hover:from-whatsapp-dark-green', 'hover:to-green-600');
        }
    }
    
    handleTypingIndicator() {
        if (!this.isTyping) {
            this.isTyping = true;
            // Send typing start event if needed
        }
        
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
        
        this.typingTimeout = setTimeout(() => {
            this.isTyping = false;
            // Send typing stop event if needed
        }, 1000);
    }
    
    async sendMessage() {
        const content = this.messageInput.value.trim();
        if (!content) {
            console.log('No message content to send');
            return;
        }
        
        console.log('Sending message:', content);
        
        // Play send sound
        this.playSound('send');
        
        // Disable input while sending
        this.setInputState(false);
        
        // Add message to UI immediately
        const messageId = this.addMessageToUI(content, 'sent', 'sending');
        
        // Clear input and hide suggestions
        this.messageInput.value = '';
        this.handleInputChange();
        this.hideSmartSuggestions();
        
        try {
            // Send to API
            console.log('Making API request to:', `${this.apiBaseUrl}/messages/`);
            const response = await this.sendToAPI(content);
            console.log('API response received:', response);
            
            // Update message status
            this.updateMessageStatus(messageId, 'sent');
            
            // Show typing indicator
            this.showTypingIndicator();
            
            // Handle AI response with delay for natural feel
            setTimeout(() => {
                this.hideTypingIndicator();
                
                if (response.ai_response) {
                    const aiMessageId = this.addMessageToUI(response.ai_response, 'received');
                    this.addMessageReactions(aiMessageId);
                    this.playSound('receive');
                    
                    // Show notification if page is not visible
                    if (document.hidden) {
                        this.showNotification('AI Assistant', response.ai_response);
                    }
                }
                
                // Handle follow-up questions
                if (response.needs_clarification && response.clarification_question) {
                    setTimeout(() => {
                        const clarificationId = this.addMessageToUI(response.clarification_question, 'received');
                        this.addMessageReactions(clarificationId);
                    }, 1000);
                }
                
                // Generate smart suggestions based on response
                this.generateContextualSuggestions(response);
                
            }, Math.random() * 1000 + 500); // Random delay between 0.5-1.5s
            
        } catch (error) {
            console.error('Failed to send message:', error);
            this.updateMessageStatus(messageId, 'failed');
            this.showErrorMessage('Failed to send message. Please try again.');
            this.playSound('error');
        } finally {
            this.setInputState(true);
        }
    }
    
    async sendToAPI(content) {
        const csrfToken = this.getCSRFToken();
        console.log('CSRF Token:', csrfToken ? 'Found' : 'Not found');
        console.log('User context:', this.userContext);
        
        const requestData = {
            content: content,
            conversation_id: this.conversationId,
            timestamp: new Date().toISOString(),
            user_context: this.userContext
        };
        
        console.log('Request data:', requestData);
        
        const response = await fetch(`${this.apiBaseUrl}/messages/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
            },
            body: JSON.stringify(requestData)
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', errorText);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Response data:', data);
        
        if (data.conversation_id) {
            this.conversationId = data.conversation_id;
        }
        
        return data;
    }
    
    addMessageToUI(content, type, status = 'sent') {
        const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `flex ${type === 'sent' ? 'justify-end' : 'justify-start'} mb-6`;
        messageDiv.id = messageId;
        
        const messageContent = document.createElement('div');
        messageContent.className = `message-${type} message-bubble`;
        
        // Message text with enhanced formatting
        const textDiv = document.createElement('div');
        textDiv.innerHTML = this.formatMessageContent(content);
        messageContent.appendChild(textDiv);
        
        // Message time and status
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        
        const timeContent = `
            <div class="flex items-center">
                <i class="fas fa-clock mr-1 text-xs"></i>
                <span>${timestamp}</span>
            </div>
            ${type === 'sent' ? `<div class="message-status">${this.getStatusIcon(status)}</div>` : ''}
        `;
        timeDiv.innerHTML = timeContent;
        messageContent.appendChild(timeDiv);
        
        messageDiv.appendChild(messageContent);
        this.messagesList.appendChild(messageDiv);
        
        // Add to messages array
        const messageObj = {
            id: messageId,
            content: content,
            type: type,
            timestamp: new Date().toISOString(),
            status: status
        };
        this.messages.push(messageObj);
        
        // Save to localStorage for persistence
        this.saveMessagesToLocalStorage();
        
        this.scrollToBottom();
        return messageId;
    }
    
    formatMessageContent(content) {
        // Enhanced message formatting
        let formatted = content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
            .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
            .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded">$1</code>') // Code
            .replace(/\n/g, '<br>') // Line breaks
            .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-blue-500 hover:underline">$1</a>'); // Links
        
        return formatted;
    }
    
    addMessageReactions(messageId) {
        const messageElement = document.getElementById(messageId);
        if (!messageElement) return;
        
        const reactionsDiv = document.createElement('div');
        reactionsDiv.className = 'message-reactions';
        
        const reactions = ['👍', '❤️', '😊', '🤔', '👎'];
        reactions.forEach(emoji => {
            const reactionBtn = document.createElement('button');
            reactionBtn.className = 'reaction-btn';
            reactionBtn.textContent = emoji;
            reactionBtn.addEventListener('click', () => {
                this.toggleReaction(messageId, emoji);
            });
            reactionsDiv.appendChild(reactionBtn);
        });
        
        messageElement.querySelector('.message-bubble').appendChild(reactionsDiv);
    }
    
    toggleReaction(messageId, emoji) {
        const messageElement = document.getElementById(messageId);
        const reactionBtn = messageElement.querySelector(`.reaction-btn:contains('${emoji}')`);
        
        if (reactionBtn.classList.contains('active')) {
            reactionBtn.classList.remove('active');
        } else {
            // Remove other active reactions
            messageElement.querySelectorAll('.reaction-btn.active').forEach(btn => {
                btn.classList.remove('active');
            });
            reactionBtn.classList.add('active');
        }
    }
    
    updateMessageStatus(messageId, status) {
        const messageElement = document.getElementById(messageId);
        if (messageElement) {
            const statusElement = messageElement.querySelector('.message-status');
            if (statusElement) {
                statusElement.innerHTML = this.getStatusIcon(status);
            }
            
            // Update in messages array
            const message = this.messages.find(m => m.id === messageId);
            if (message) {
                message.status = status;
            }
        }
    }
    
    getStatusIcon(status) {
        const icons = {
            'sending': '<i class="fas fa-clock text-gray-400 text-xs"></i>',
            'sent': '<i class="fas fa-check text-gray-400 text-xs"></i>',
            'delivered': '<i class="fas fa-check-double text-gray-400 text-xs"></i>',
            'read': '<i class="fas fa-check-double text-blue-400 text-xs"></i>',
            'failed': '<i class="fas fa-exclamation-triangle text-red-400 text-xs"></i>'
        };
        return icons[status] || '';
    }
    
    showErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'flex justify-center mb-6';
        errorDiv.innerHTML = `
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm max-w-md">
                <div class="flex items-center">
                    <i class="fas fa-exclamation-triangle mr-2"></i>
                    ${message}
                </div>
            </div>
        `;
        this.messagesList.appendChild(errorDiv);
        this.scrollToBottom();
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
    
    showTypingIndicator() {
        this.typingIndicator.classList.remove('hidden');
        this.scrollToBottom();
    }
    
    hideTypingIndicator() {
        this.typingIndicator.classList.add('hidden');
    }
    
    setInputState(enabled) {
        this.messageInput.disabled = !enabled;
        this.sendButton.disabled = !enabled || !this.messageInput.value.trim();
        
        if (enabled) {
            this.messageInput.focus();
        }
    }
    
    scrollToBottom(smooth = false) {
        const behavior = smooth ? 'smooth' : 'auto';
        setTimeout(() => {
            this.messagesContainer.scrollTo({
                top: this.messagesContainer.scrollHeight,
                behavior: behavior
            });
        }, 100);
    }
    
    // Enhanced attachment handling
    toggleAttachmentMenu() {
        this.attachmentMenu.classList.toggle('hidden');
        this.hideEmojiPicker();
    }
    
    hideAttachmentMenu() {
        this.attachmentMenu.classList.add('hidden');
    }
    
    handleAttachmentType(type) {
        this.hideAttachmentMenu();
        
        switch (type) {
            case 'image':
                document.getElementById('image-input').click();
                break;
            case 'document':
                document.getElementById('document-input').click();
                break;
            case 'location':
                this.shareLocation();
                break;
        }
    }
    
    async handleFileUpload(file, type) {
        if (!file) return;
        
        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            this.showErrorMessage('File size must be less than 10MB');
            return;
        }
        
        // Show upload progress
        const messageId = this.addMessageToUI(`📎 Uploading ${file.name}...`, 'sent', 'sending');
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', type);
            
            const response = await fetch(`${this.apiBaseUrl}/upload/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.getCSRFToken(),
                },
                body: formData
            });
            
            if (response.ok) {
                const data = await response.json();
                this.updateMessageStatus(messageId, 'sent');
                
                // Update message content with file info
                const messageElement = document.getElementById(messageId);
                const textDiv = messageElement.querySelector('.message-bubble > div');
                textDiv.innerHTML = this.formatFileMessage(file, data.url, type);
                
            } else {
                throw new Error('Upload failed');
            }
            
        } catch (error) {
            console.error('File upload failed:', error);
            this.updateMessageStatus(messageId, 'failed');
            this.showErrorMessage('Failed to upload file. Please try again.');
        }
    }
    
    formatFileMessage(file, url, type) {
        const fileSize = this.formatFileSize(file.size);
        const icon = type === 'image' ? 'fas fa-image' : 'fas fa-file-alt';
        
        return `
            <div class="flex items-center space-x-3 p-2 bg-white bg-opacity-50 rounded-lg">
                <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <i class="${icon} text-blue-600"></i>
                </div>
                <div class="flex-1">
                    <div class="font-medium text-sm">${file.name}</div>
                    <div class="text-xs text-gray-500">${fileSize}</div>
                </div>
                <a href="${url}" target="_blank" class="text-blue-500 hover:text-blue-600">
                    <i class="fas fa-external-link-alt"></i>
                </a>
            </div>
        `;
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    shareLocation() {
        if (!navigator.geolocation) {
            this.showErrorMessage('Geolocation is not supported by this browser');
            return;
        }
        
        const messageId = this.addMessageToUI('📍 Sharing location...', 'sent', 'sending');
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const locationUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
                
                // Update message with location
                const messageElement = document.getElementById(messageId);
                const textDiv = messageElement.querySelector('.message-bubble > div');
                textDiv.innerHTML = `
                    <div class="flex items-center space-x-3 p-2 bg-white bg-opacity-50 rounded-lg">
                        <div class="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                            <i class="fas fa-map-marker-alt text-red-600"></i>
                        </div>
                        <div class="flex-1">
                            <div class="font-medium text-sm">Current Location</div>
                            <div class="text-xs text-gray-500">Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}</div>
                        </div>
                        <a href="${locationUrl}" target="_blank" class="text-blue-500 hover:text-blue-600">
                            <i class="fas fa-external-link-alt"></i>
                        </a>
                    </div>
                `;
                
                this.updateMessageStatus(messageId, 'sent');
            },
            (error) => {
                console.error('Geolocation error:', error);
                this.updateMessageStatus(messageId, 'failed');
                this.showErrorMessage('Failed to get location. Please check permissions.');
            }
        );
    }
    
    async loadConversationHistory() {
        try {
            // First try to load from localStorage
            const savedMessages = this.loadMessagesFromLocalStorage();
            if (savedMessages && savedMessages.length > 0) {
                console.log('Loaded messages from localStorage:', savedMessages.length);
                this.messages = savedMessages;
                this.displayLocalMessages();
            } else {
                // If no saved messages, try to load from API
                const response = await fetch(`${this.apiBaseUrl}/messages/recent/`);
                if (response.ok) {
                    const data = await response.json();
                    this.displayConversationHistory(data.results || data);
                }
            }
        } catch (error) {
            console.error('Failed to load conversation history:', error);
        }
    }
    
    displayConversationHistory(messages) {
        // Clear existing messages except welcome message
        const existingMessages = this.messagesContainer.querySelectorAll('.message-bubble');
        existingMessages.forEach(msg => msg.remove());
        
        messages.forEach(message => {
            const type = message.sender ? 'sent' : 'received';
            this.addMessageToUI(message.content, type, 'delivered');
        });
    }
    
    displayLocalMessages() {
        // Clear existing messages except welcome message
        const welcomeMsg = document.querySelector('.bg-gradient-to-r.from-blue-500');
        const existingMessages = this.messagesContainer.querySelectorAll('.message-bubble');
        existingMessages.forEach(msg => msg.remove());
        
        // Remove the welcome message temporarily
        if (welcomeMsg) {
            welcomeMsg.parentElement.remove();
        }
        
        // Re-add all saved messages
        this.messages.forEach(message => {
            const messageId = message.id;
            const timestamp = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            const messageDiv = document.createElement('div');
            messageDiv.className = `flex ${message.type === 'sent' ? 'justify-end' : 'justify-start'} mb-6`;
            messageDiv.id = messageId;
            
            const messageContent = document.createElement('div');
            messageContent.className = `message-${message.type} message-bubble`;
            
            const textDiv = document.createElement('div');
            textDiv.innerHTML = this.formatMessageContent(message.content);
            messageContent.appendChild(textDiv);
            
            const timeDiv = document.createElement('div');
            timeDiv.className = 'message-time';
            const timeContent = `
                <div class="flex items-center">
                    <i class="fas fa-clock mr-1 text-xs"></i>
                    <span>${timestamp}</span>
                </div>
                ${message.type === 'sent' ? `<div class="message-status">${this.getStatusIcon(message.status)}</div>` : ''}
            `;
            timeDiv.innerHTML = timeContent;
            messageContent.appendChild(timeDiv);
            
            messageDiv.appendChild(messageContent);
            this.messagesList.appendChild(messageDiv);
        });
    }
    
    saveMessagesToLocalStorage() {
        try {
            localStorage.setItem('chatMessages', JSON.stringify(this.messages));
            localStorage.setItem('chatLastUpdated', new Date().toISOString());
        } catch (error) {
            console.error('Failed to save messages to localStorage:', error);
        }
    }
    
    loadMessagesFromLocalStorage() {
        try {
            const saved = localStorage.getItem('chatMessages');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Failed to load messages from localStorage:', error);
            return [];
        }
    }
    
    // Enhanced emoji functionality
    toggleEmojiPicker() {
        this.emojiPicker.classList.toggle('hidden');
        this.hideAttachmentMenu();
    }
    
    hideEmojiPicker() {
        this.emojiPicker.classList.add('hidden');
    }
    
    insertEmoji(emoji) {
        const cursorPos = this.messageInput.selectionStart;
        const textBefore = this.messageInput.value.substring(0, cursorPos);
        const textAfter = this.messageInput.value.substring(cursorPos);
        
        this.messageInput.value = textBefore + emoji + textAfter;
        this.messageInput.selectionStart = this.messageInput.selectionEnd = cursorPos + emoji.length;
        
        this.handleInputChange();
        this.messageInput.focus();
        this.hideEmojiPicker();
    }
    
    // Voice recording functionality
    async startVoiceRecording() {
        if (this.isRecording) return;
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            this.recordingStartTime = Date.now();
            
            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };
            
            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                this.handleVoiceRecording(audioBlob);
            };
            
            this.mediaRecorder.start();
            this.isRecording = true;
            
            // Show voice modal
            document.getElementById('voice-modal').classList.remove('hidden');
            this.updateRecordingTime();
            
        } catch (error) {
            console.error('Failed to start recording:', error);
            this.showErrorMessage('Microphone access denied. Please check permissions.');
        }
    }
    
    stopVoiceRecording() {
        if (!this.isRecording) return;
        
        this.mediaRecorder.stop();
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        this.isRecording = false;
        
        // Hide voice modal
        document.getElementById('voice-modal').classList.add('hidden');
    }
    
    cancelVoiceRecording() {
        if (this.isRecording) {
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            this.isRecording = false;
        }
        
        this.audioChunks = [];
        document.getElementById('voice-modal').classList.add('hidden');
    }
    
    async sendVoiceMessage() {
        if (this.audioChunks.length === 0) return;
        
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        const messageId = this.addMessageToUI('🎤 Voice message', 'sent', 'sending');
        
        try {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'voice-message.wav');
            
            const response = await fetch(`${this.apiBaseUrl}/upload/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.getCSRFToken(),
                },
                body: formData
            });
            
            if (response.ok) {
                this.updateMessageStatus(messageId, 'sent');
            } else {
                throw new Error('Upload failed');
            }
            
        } catch (error) {
            console.error('Voice message upload failed:', error);
            this.updateMessageStatus(messageId, 'failed');
            this.showErrorMessage('Failed to send voice message. Please try again.');
        }
        
        this.audioChunks = [];
        document.getElementById('voice-modal').classList.add('hidden');
    }
    
    updateRecordingTime() {
        if (!this.isRecording) return;
        
        const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        
        document.getElementById('recording-time').textContent = 
            `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        setTimeout(() => this.updateRecordingTime(), 1000);
    }
    
    handleVoiceRecording(audioBlob) {
        // Handle the recorded audio blob
        console.log('Voice recording completed:', audioBlob);
    }
    
    // Search functionality
    toggleSearch() {
        if (this.searchBar) {
            this.searchBar.classList.toggle('hidden');
            if (!this.searchBar.classList.contains('hidden')) {
                if (this.searchInput) {
                    this.searchInput.focus();
                }
            } else {
                this.clearSearch();
            }
        } else {
            console.warn('Search bar not found');
            // Fallback: create a simple search prompt
            const query = prompt('Search messages:');
            if (query) {
                this.performSearch(query);
            }
        }
    }
    
    hideSearch() {
        if (this.searchBar) {
            this.searchBar.classList.add('hidden');
        }
        this.clearSearch();
    }
    
    performSearch(query) {
        if (!query.trim()) {
            this.clearSearch();
            return;
        }
        
        this.searchResults = [];
        this.currentSearchIndex = 0;
        
        // Search through messages
        this.messages.forEach((message, index) => {
            if (message.content.toLowerCase().includes(query.toLowerCase())) {
                this.searchResults.push({
                    messageIndex: index,
                    messageId: message.id
                });
            }
        });
        
        if (this.searchResults.length > 0) {
            this.highlightSearchResults(query);
            this.navigateToSearchResult(0);
            
            // Show search results count
            console.log(`Found ${this.searchResults.length} results for "${query}"`);
        } else {
            console.log(`No results found for "${query}"`);
            this.showErrorMessage(`No results found for "${query}"`);
        }
    }
    
    highlightSearchResults(query) {
        try {
            // Remove existing highlights
            if (this.messagesContainer) {
                this.messagesContainer.querySelectorAll('.search-highlight').forEach(el => {
                    el.outerHTML = el.innerHTML;
                });
                
                // Add new highlights
                const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                this.messagesContainer.querySelectorAll('.message-bubble').forEach(bubble => {
                    const textContent = bubble.innerHTML;
                    bubble.innerHTML = textContent.replace(regex, '<span class="search-highlight">$1</span>');
                });
            }
        } catch (error) {
            console.error('Error highlighting search results:', error);
        }
    }
    
    navigateSearchResults(direction) {
        if (this.searchResults.length === 0) return;
        
        this.currentSearchIndex += direction;
        if (this.currentSearchIndex >= this.searchResults.length) {
            this.currentSearchIndex = 0;
        } else if (this.currentSearchIndex < 0) {
            this.currentSearchIndex = this.searchResults.length - 1;
        }
        
        this.navigateToSearchResult(this.currentSearchIndex);
    }
    
    navigateToSearchResult(index) {
        if (this.searchResults.length === 0) return;
        
        const result = this.searchResults[index];
        const messageElement = document.getElementById(result.messageId);
        
        if (messageElement && this.messagesContainer) {
            messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Highlight current result
            this.messagesContainer.querySelectorAll('.current-search-result').forEach(el => {
                el.classList.remove('current-search-result');
            });
            
            messageElement.classList.add('current-search-result');
        }
    }
    
    clearSearch() {
        if (this.searchInput) {
            this.searchInput.value = '';
        }
        this.searchResults = [];
        this.currentSearchIndex = 0;
        
        if (this.messagesContainer) {
            // Remove highlights
            this.messagesContainer.querySelectorAll('.search-highlight').forEach(el => {
                el.outerHTML = el.innerHTML;
            });
            
            this.messagesContainer.querySelectorAll('.current-search-result').forEach(el => {
                el.classList.remove('current-search-result');
            });
        }
    }
    
    // Smart suggestions functionality
    generateSmartSuggestions() {
        const input = this.messageInput.value.toLowerCase();
        const suggestions = [];
        
        // Context-based suggestions
        if (input.includes('guest') || input.includes('visitor')) {
            suggestions.push('I need guest permission for tonight');
            suggestions.push('Can my friend stay overnight?');
        }
        
        if (input.includes('leave') || input.includes('home')) {
            suggestions.push('I want to request leave for tomorrow');
            suggestions.push('I need to go home for the weekend');
        }
        
        if (input.includes('maintenance') || input.includes('repair') || input.includes('broken')) {
            suggestions.push('My room needs maintenance');
            suggestions.push('The AC is not working');
            suggestions.push('There is a plumbing issue');
        }
        
        if (input.includes('rule') || input.includes('policy') || input.includes('timing')) {
            suggestions.push('What are the hostel rules?');
            suggestions.push('What are the entry/exit timings?');
        }
        
        this.displaySmartSuggestions(suggestions);
    }
    
    generateContextualSuggestions(response) {
        const suggestions = [];
        
        if (response.ai_response) {
            const responseText = response.ai_response.toLowerCase();
            
            if (responseText.includes('form') || responseText.includes('application')) {
                suggestions.push('How do I fill the form?');
                suggestions.push('Where can I submit it?');
            }
            
            if (responseText.includes('approval') || responseText.includes('permission')) {
                suggestions.push('How long does approval take?');
                suggestions.push('Who approves the request?');
            }
            
            if (responseText.includes('rule') || responseText.includes('policy')) {
                suggestions.push('Are there any exceptions?');
                suggestions.push('What happens if I violate this?');
            }
        }
        
        if (suggestions.length > 0) {
            setTimeout(() => {
                this.displaySmartSuggestions(suggestions);
            }, 2000);
        }
    }
    
    displaySmartSuggestions(suggestions) {
        if (suggestions.length === 0) {
            this.hideSmartSuggestions();
            return;
        }
        
        this.suggestionsContainer.innerHTML = '';
        
        suggestions.slice(0, 3).forEach(suggestion => {
            const chip = document.createElement('button');
            chip.className = 'suggestion-chip';
            chip.textContent = suggestion;
            chip.addEventListener('click', () => {
                this.messageInput.value = suggestion;
                this.handleInputChange();
                this.hideSmartSuggestions();
                this.messageInput.focus();
            });
            this.suggestionsContainer.appendChild(chip);
        });
        
        this.smartSuggestions.classList.remove('hidden');
    }
    
    hideSmartSuggestions() {
        this.smartSuggestions.classList.add('hidden');
    }
    
    // Settings functionality
    loadSettings() {
        const defaultSettings = {
            notifications: true,
            sound: true,
            theme: 'light',
            fontSize: 14
        };
        
        const saved = localStorage.getItem('chatSettings');
        return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    }
    
    saveSettings() {
        try {
            const notificationsToggle = document.getElementById('notifications-toggle');
            const soundToggle = document.getElementById('sound-toggle');
            const themeSelect = document.getElementById('theme-select');
            const fontSizeSlider = document.getElementById('font-size-slider');
            
            const settings = {
                notifications: notificationsToggle ? notificationsToggle.checked : true,
                sound: soundToggle ? soundToggle.checked : true,
                theme: themeSelect ? themeSelect.value : 'light',
                fontSize: fontSizeSlider ? parseInt(fontSizeSlider.value) : 14
            };
            
            localStorage.setItem('chatSettings', JSON.stringify(settings));
            this.settings = settings;
            this.applySettings();
            
            console.log('Settings saved:', settings);
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showErrorMessage('Failed to save settings. Please try again.');
        }
    }
    
    resetSettings() {
        try {
            localStorage.removeItem('chatSettings');
            this.settings = this.loadSettings();
            this.applySettings();
            this.updateSettingsUI();
            
            console.log('Settings reset to defaults');
        } catch (error) {
            console.error('Error resetting settings:', error);
            this.showErrorMessage('Failed to reset settings. Please try again.');
        }
    }
    
    applySettings() {
        try {
            // Apply theme
            document.body.className = document.body.className.replace(/theme-\w+/g, '');
            document.body.classList.add(`theme-${this.settings.theme}`);
            
            // Apply font size
            document.documentElement.style.setProperty('--chat-font-size', `${this.settings.fontSize}px`);
            
            // Update UI
            this.updateSettingsUI();
        } catch (error) {
            console.error('Error applying settings:', error);
        }
    }
    
    updateSettingsUI() {
        try {
            const notificationsToggle = document.getElementById('notifications-toggle');
            const soundToggle = document.getElementById('sound-toggle');
            const themeSelect = document.getElementById('theme-select');
            const fontSizeSlider = document.getElementById('font-size-slider');
            
            if (notificationsToggle) {
                notificationsToggle.checked = this.settings.notifications;
            }
            if (soundToggle) {
                soundToggle.checked = this.settings.sound;
            }
            if (themeSelect) {
                themeSelect.value = this.settings.theme;
            }
            if (fontSizeSlider) {
                fontSizeSlider.value = this.settings.fontSize;
            }
        } catch (error) {
            console.error('Error updating settings UI:', error);
        }
    }
    
    // Utility functions
    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }
    
    showNotification(title, body) {
        if (!this.settings.notifications || Notification.permission !== 'granted') return;
        
        const notification = new Notification(title, {
            body: body,
            icon: '/static/img/logo.png',
            badge: '/static/img/badge.png'
        });
        
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
        
        setTimeout(() => notification.close(), 5000);
    }
    
    playSound(type) {
        if (!this.settings.sound) return;
        
        const sounds = {
            send: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT',
            receive: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT',
            error: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT'
        };
        
        if (sounds[type]) {
            const audio = new Audio(sounds[type]);
            audio.volume = 0.3;
            audio.play().catch(e => console.log('Sound play failed:', e));
        }
    }
    
    hideAllModals() {
        document.querySelectorAll('.fixed.inset-0').forEach(modal => {
            modal.classList.add('hidden');
        });
        this.hideAttachmentMenu();
        this.hideEmojiPicker();
        this.hideSmartSuggestions();
    }
    
    async clearChat() {
        try {
            // Clear conversation on server side
            const response = await fetch(`${this.apiBaseUrl}/messages/clear/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({
                    user_id: this.userContext.user_id
                })
            });
            
            if (response.ok) {
                // Clear local state
                this.messages = [];
                localStorage.removeItem('chatMessages');
                localStorage.removeItem('chatLastUpdated');
                this.messagesList.innerHTML = '';
                
                // Clear conversation context
                this.conversationId = null;
                
                // Re-add welcome message
                this.messagesList.innerHTML = `
                    <div class="flex justify-center">
                        <div class="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl shadow-lg p-6 max-w-md text-center">
                            <div class="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i class="fas fa-robot text-2xl"></i>
                            </div>
                            <h3 class="font-bold text-lg mb-2">Welcome to AI Assistant!</h3>
                            <p class="text-blue-100 text-sm mb-4">
                                I'm here to help you with all your hostel needs. Just type naturally and I'll understand!
                            </p>
                            <div class="grid grid-cols-2 gap-2 text-xs">
                                <div class="bg-white bg-opacity-10 rounded-lg p-2">
                                    <i class="fas fa-user-plus mb-1"></i>
                                    <div>Guest Requests</div>
                                </div>
                                <div class="bg-white bg-opacity-10 rounded-lg p-2">
                                    <i class="fas fa-calendar-alt mb-1"></i>
                                    <div>Leave Applications</div>
                                </div>
                                <div class="bg-white bg-opacity-10 rounded-lg p-2">
                                    <i class="fas fa-tools mb-1"></i>
                                    <div>Maintenance</div>
                                </div>
                                <div class="bg-white bg-opacity-10 rounded-lg p-2">
                                    <i class="fas fa-question-circle mb-1"></i>
                                    <div>Rules & Policies</div>
                                </div>
                            </div>
                            <div class="text-xs text-blue-200 mt-4 flex items-center justify-center">
                                <i class="fas fa-clock mr-1"></i>
                                <span id="welcome-time">${new Date().toLocaleTimeString()}</span>
                            </div>
                        </div>
                    </div>
                `;
                
                this.scrollToBottom();
                this.showNotification('Chat cleared successfully', 'success');
            } else {
                throw new Error('Failed to clear chat on server');
            }
        } catch (error) {
            console.error('Error clearing chat:', error);
            // Still clear locally even if server call fails
            this.messages = [];
            localStorage.removeItem('chatMessages');
            localStorage.removeItem('chatLastUpdated');
            this.messagesList.innerHTML = '';
            this.conversationId = null;
            this.showNotification('Chat cleared locally (server error)', 'warning');
        }
    }
    
    exportChat() {
        try {
            const chatData = {
                timestamp: new Date().toISOString(),
                user: this.userContext,
                messages: this.messages.map(msg => ({
                    content: msg.content,
                    type: msg.type,
                    timestamp: msg.timestamp,
                    status: msg.status
                })),
                conversation_id: this.conversationId,
                export_version: '1.0'
            };
            
            const dataStr = JSON.stringify(chatData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `chat-export-${new Date().toISOString().split('T')[0]}.json`;
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up the object URL
            setTimeout(() => {
                URL.revokeObjectURL(link.href);
            }, 100);
            
            // Show success notification
            this.showNotification('Chat Export', 'Chat exported successfully!');
            
            console.log('Chat exported successfully');
        } catch (error) {
            console.error('Error exporting chat:', error);
            this.showErrorMessage('Failed to export chat. Please try again.');
        }
    }
    
    startConnectionMonitoring() {
        setInterval(() => {
            this.checkConnection();
        }, 30000); // Check every 30 seconds
    }
    
    async checkConnection() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/health/`, {
                method: 'GET',
                cache: 'no-cache'
            });
            
            if (response.ok) {
                this.handleConnectionChange(true);
            } else {
                this.handleConnectionChange(false);
            }
        } catch (error) {
            this.handleConnectionChange(false);
        }
    }
    
    handleConnectionChange(isConnected) {
        this.isConnected = isConnected;
        
        if (isConnected) {
            this.statusIndicator.textContent = 'Online';
            this.statusIndicator.className = 'text-sm status-online';
            this.connectionModal.classList.add('hidden');
            
            // Process queued messages
            this.processMessageQueue();
        } else {
            this.statusIndicator.textContent = 'Offline';
            this.statusIndicator.className = 'text-sm status-offline';
            this.connectionModal.classList.remove('hidden');
        }
    }
    
    processMessageQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.sendToAPI(message.content)
                .then(response => {
                    this.updateMessageStatus(message.id, 'sent');
                })
                .catch(error => {
                    this.updateMessageStatus(message.id, 'failed');
                });
        }
    }
    
    markMessagesAsRead() {
        // Mark all received messages as read
        const receivedMessages = this.messagesContainer.querySelectorAll('.message-received');
        receivedMessages.forEach(message => {
            // Update read status if needed
        });
    }
    
    updateWelcomeTime() {
        const welcomeTimeElement = document.getElementById('welcome-time');
        if (welcomeTimeElement) {
            welcomeTimeElement.textContent = new Date().toLocaleTimeString();
        }
    }
    
    getCSRFToken() {
        // Try multiple methods to get CSRF token
        
        // Method 1: From meta tag (most reliable)
        const csrfMeta = document.querySelector('meta[name="csrf-token"]');
        if (csrfMeta) {
            return csrfMeta.getAttribute('content');
        }
        
        // Method 2: From cookie
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'csrftoken') {
                return value;
            }
        }
        
        // Method 3: From hidden input
        const csrfInput = document.querySelector('input[name="csrfmiddlewaretoken"]');
        if (csrfInput) {
            return csrfInput.value;
        }
        
        // Method 4: From Django's built-in function if available
        if (typeof window.django !== 'undefined' && window.django.jQuery) {
            const $ = window.django.jQuery;
            return $('[name=csrfmiddlewaretoken]').val();
        }
        
        console.warn('CSRF token not found - this may cause API requests to fail');
        return '';
    }
    
    getUserContext() {
        // Extract user context from the page
        const userProfileElement = document.querySelector('.bg-gradient-to-br.from-blue-400.to-purple-500');
        const nameElement = document.querySelector('.font-bold.text-white.text-lg');
        const roleElement = document.querySelector('.text-green-100.text-sm');
        const badgeElement = document.querySelector('.inline-flex.items-center.px-2.py-1.rounded-full');
        
        let userType = 'guest';
        let name = 'Guest User';
        let roomNumber = '';
        let designation = '';
        let email = '';
        
        // Try to extract from template variables (if available in window)
        if (window.userContext) {
            return window.userContext;
        }
        
        // Extract from DOM elements
        if (nameElement) {
            name = nameElement.textContent.trim();
        }
        
        if (roleElement) {
            const roleText = roleElement.textContent.trim();
            if (roleText.includes('Room')) {
                userType = 'student';
                roomNumber = roleText;
            } else if (roleText !== 'Visitor') {
                userType = 'staff';
                designation = roleText;
            }
        }
        
        if (badgeElement) {
            const badgeText = badgeElement.textContent.toLowerCase();
            if (badgeText.includes('student')) {
                userType = 'student';
            } else if (badgeText.includes('staff')) {
                userType = 'staff';
            }
        }
        
        return {
            user_id: name.replace(/\s+/g, '').toLowerCase(),
            name: name,
            role: userType,
            room_number: userType === 'student' ? roomNumber : null,
            designation: userType === 'staff' ? designation : null,
            email: email
        };
    }
}

// Initialize chat interface when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing chat...');
    
    // First, try to initialize basic functionality immediately
    initializeBasicChat();
    
    // Then try enhanced chat
    try {
        window.chatInterface = new EnhancedChatInterface();
        console.log('Enhanced chat interface initialized successfully');
    } catch (error) {
        console.error('Failed to initialize enhanced chat interface:', error);
        console.log('Using basic chat functionality...');
    }
});

// Basic chat functionality that always works
function initializeBasicChat() {
    console.log('Initializing basic chat functionality...');
    
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const messagesList = document.getElementById('messages-list');
    
    if (!messageForm || !messageInput || !sendButton) {
        console.error('Required chat elements not found');
        return;
    }
    
    console.log('Basic chat elements found');
    
    // Function to send message
    async function sendBasicMessage() {
        const content = messageInput.value.trim();
        if (!content) {
            console.log('No content to send');
            return;
        }
        
        console.log('Sending basic message:', content);
        
        // Disable controls
        messageInput.disabled = true;
        sendButton.disabled = true;
        sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        // Add message to UI
        addBasicMessage(content, 'sent');
        messageInput.value = '';
        
        try {
            // Get CSRF token
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            
            // Send to API
            const response = await fetch('/api/messages/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken,
                },
                body: JSON.stringify({
                    content: content,
                    user_context: window.userContext || {
                        user_id: 'basic_user',
                        name: 'User',
                        role: 'student'
                    }
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('Message sent successfully:', data);
                
                if (data.ai_response) {
                    addBasicMessage(data.ai_response, 'received');
                }
            } else {
                console.error('API error:', response.status);
                addBasicMessage('Sorry, there was an error. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Network error:', error);
            addBasicMessage('Network error. Please try again.', 'error');
        } finally {
            // Re-enable controls
            messageInput.disabled = false;
            sendButton.disabled = false;
            sendButton.innerHTML = '<i class="fas fa-paper-plane"></i>';
            messageInput.focus();
        }
    }
    
    // Add message to UI
    function addBasicMessage(content, type) {
        if (!messagesList) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `flex ${type === 'sent' ? 'justify-end' : 'justify-start'} mb-4`;
        
        const bubble = document.createElement('div');
        bubble.className = `max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
            type === 'sent' 
                ? 'bg-green-500 text-white' 
                : type === 'error'
                ? 'bg-red-100 text-red-800 border border-red-200'
                : 'bg-white text-gray-800 border border-gray-200'
        }`;
        bubble.textContent = content;
        
        messageDiv.appendChild(bubble);
        messagesList.appendChild(messageDiv);
        
        // Scroll to bottom
        const container = document.getElementById('messages-container');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }
    
    // Enable send button when there's text
    messageInput.addEventListener('input', () => {
        const hasText = messageInput.value.trim().length > 0;
        sendButton.disabled = !hasText;
        console.log('Input changed, send button enabled:', hasText);
    });
    
    // Handle Enter key
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            console.log('Enter key pressed');
            sendBasicMessage();
        }
    });
    
    // Handle form submission
    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log('Form submitted');
        sendBasicMessage();
    });
    
    // Handle send button click
    sendButton.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Send button clicked');
        sendBasicMessage();
    });
    
    // Force enable send button if there's already text
    if (messageInput.value.trim()) {
        sendButton.disabled = false;
    }
    
    console.log('Basic chat functionality initialized successfully');
}

// Fallback chat functionality
function initializeFallbackChat() {
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const messagesList = document.getElementById('messages-list');
    
    if (!messageForm || !messageInput || !sendButton) {
        console.error('Required chat elements not found for fallback');
        return;
    }
    
    console.log('Fallback chat elements found, setting up basic functionality');
    
    // Enable send button when there's text
    messageInput.addEventListener('input', () => {
        const hasText = messageInput.value.trim().length > 0;
        sendButton.disabled = !hasText;
        console.log('Input changed, send button enabled:', hasText);
    });
    
    // Handle Enter key
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (messageInput.value.trim()) {
                console.log('Enter key pressed, sending message');
                sendFallbackMessage();
            }
        }
    });
    
    // Handle form submission
    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log('Form submitted, sending message');
        sendFallbackMessage();
    });
    
    // Handle send button click
    sendButton.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Send button clicked, sending message');
        sendFallbackMessage();
    });
    
    async function sendFallbackMessage() {
        const content = messageInput.value.trim();
        if (!content) {
            console.log('No content to send');
            return;
        }
        
        console.log('Sending fallback message:', content);
        
        // Disable input
        messageInput.disabled = true;
        sendButton.disabled = true;
        
        // Add message to UI
        addFallbackMessage(content, 'sent');
        
        // Clear input
        messageInput.value = '';
        
        try {
            // Get CSRF token
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            console.log('CSRF token found:', !!csrfToken);
            
            // Send to API
            const response = await fetch('/api/messages/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken,
                },
                body: JSON.stringify({
                    content: content,
                    user_context: window.userContext || {
                        user_id: 'fallback_user',
                        name: 'Fallback User',
                        role: 'student'
                    }
                })
            });
            
            console.log('API response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('API response data:', data);
                
                if (data.ai_response) {
                    addFallbackMessage(data.ai_response, 'received');
                }
            } else {
                const errorText = await response.text();
                console.error('API error:', errorText);
                addFallbackMessage('Sorry, there was an error processing your message. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Network error:', error);
            addFallbackMessage('Network error. Please check your connection and try again.', 'error');
        } finally {
            // Re-enable input
            messageInput.disabled = false;
            sendButton.disabled = false;
            messageInput.focus();
        }
    }
    
    function addFallbackMessage(content, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `flex ${type === 'sent' ? 'justify-end' : 'justify-start'} mb-4`;
        
        const bubble = document.createElement('div');
        bubble.className = `max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
            type === 'sent' 
                ? 'bg-whatsapp-green text-white' 
                : type === 'error'
                ? 'bg-red-100 text-red-800 border border-red-200'
                : 'bg-white text-gray-800 border border-gray-200'
        }`;
        bubble.textContent = content;
        
        messageDiv.appendChild(bubble);
        messagesList.appendChild(messageDiv);
        
        // Scroll to bottom
        const container = document.getElementById('messages-container');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }
    
    console.log('Fallback chat functionality initialized');
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedChatInterface;
}