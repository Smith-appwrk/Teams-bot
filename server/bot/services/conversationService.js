class ConversationService {
    constructor(messageRetentionCount) {
        this.conversationHistory = new Map();
        this.MESSAGE_RETENTION_COUNT = messageRetentionCount;
        this.CONVERSATION_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours
    }

    addMessageToHistory(conversationId, message) {
        if (!this.conversationHistory.has(conversationId)) {
            this.conversationHistory.set(conversationId, []);
        }

        const history = this.conversationHistory.get(conversationId);
        history.push(message);

        if (history.length > this.MESSAGE_RETENTION_COUNT) {
            this.conversationHistory.set(
                conversationId,
                history.slice(history.length - this.MESSAGE_RETENTION_COUNT)
            );
        }
    }

    getConversationHistory(conversationId) {
        return this.conversationHistory.get(conversationId) || [];
    }

    cleanupOldConversations() {
        const currentTime = Date.now();
        let deletedCount = 0;

        for (const [conversationId, history] of this.conversationHistory.entries()) {
            if (history.length === 0) {
                this.conversationHistory.delete(conversationId);
                deletedCount++;
                continue;
            }

            const lastMessageTime = Math.max(...history.map(msg => msg.timestamp || 0));
            if (currentTime - lastMessageTime > this.CONVERSATION_RETENTION_MS) {
                this.conversationHistory.delete(conversationId);
                deletedCount++;
            }
        }

        if (deletedCount > 0) {
            console.log({
                type: 'ConversationCleanup',
                deletedConversations: deletedCount,
                timestamp: new Date().toISOString()
            });
        }
    }
}

module.exports = ConversationService; 