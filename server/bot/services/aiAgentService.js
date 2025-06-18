const RAGService = require('./ragService');
const ContextService = require('./contextService');
const CONFIG = require('../utils/config');

class AIAgentService {
    constructor(openaiService) {
        this.openaiService = openaiService;
        this.ragService = new RAGService(openaiService);
        this.contextService = new ContextService(openaiService);
        this.initialized = false;
    }

    async initialize(knowledgeBaseContent) {
        if (this.initialized) return;

        await this.ragService.initialize(knowledgeBaseContent);
        this.initialized = true;

        console.log('[AIAgentService] Initialized with optimized RAG and context management');
    }

    async generateResponse(conversationId, conversationHistory, userQuery, detectedLanguage) {
        try {
            // Step 1: Get relevant knowledge base chunks (instead of entire knowledge base)
            const relevantKnowledge = await this.ragService.findRelevantChunks(userQuery, 3);
            const knowledgeContext = relevantKnowledge.join('\n\n');

            // Step 2: Get optimized conversation context (summarized + recent)
            const optimizedContext = await this.contextService.getContextWithinTokenLimit(
                conversationId,
                conversationHistory,
                userQuery,
                1500 // Max tokens for context
            );

            // Step 3: Create efficient system prompt
            const systemPrompt = this.createOptimizedSystemPrompt(detectedLanguage, knowledgeContext);

            // Step 4: Construct messages with minimal token usage
            const messages = [
                { role: "system", content: systemPrompt },
                ...optimizedContext,
                { role: "user", content: userQuery }
            ];

            // Step 5: Log token savings
            this.logTokenSavings(knowledgeContext, optimizedContext, userQuery);

            // Step 6: Get completion
            const response = await this.openaiService.getCompletion(messages);

            return response;

        } catch (error) {
            console.error('[AIAgentService] Error generating response:', error);
            throw error;
        }
    }

    createOptimizedSystemPrompt(detectedLanguage, relevantKnowledge) {
        return `You are an IntelliGate support assistant. Respond in ${detectedLanguage} when appropriate.

Response Guidelines:
1. Adapt response style based on query complexity
2. Use 1-3 sentences for simple answers, 1-2 paragraphs for complex ones
3. Professional tone for technical queries, conversational for general questions
4. Always paraphrase knowledge base content using original phrasing
5. Current date: ${new Date().toLocaleDateString()}

IMPORTANT: 
- If no relevant information exists, respond: NO_ANSWER
- If user needs support team, respond: NEED_SUPPORT

Relevant Knowledge Base:
${relevantKnowledge}

Note: Respond naturally based on conversation flow.`;
    }

    logTokenSavings(knowledgeContext, optimizedContext, userQuery) {
        // Estimate token savings
        const knowledgeTokens = this.contextService.estimateTokenCount(knowledgeContext);
        const contextTokens = optimizedContext.reduce((sum, msg) =>
            sum + this.contextService.estimateTokenCount(msg.content), 0);
        const queryTokens = this.contextService.estimateTokenCount(userQuery);

        const totalTokens = knowledgeTokens + contextTokens + queryTokens;

        console.log(`[AIAgentService] Token usage optimization:
        - Knowledge chunks: ~${knowledgeTokens} tokens (vs full KB which could be 5000+)
        - Context: ~${contextTokens} tokens (${optimizedContext.length} messages)
        - Query: ~${queryTokens} tokens
        - Total: ~${totalTokens} tokens
        - Estimated savings: ~${Math.max(0, 5000 - totalTokens)} tokens per request`);
    }

    // Method to analyze and improve RAG performance
    async analyzeQuery(query) {
        try {
            const analysis = await this.openaiService.openai.chat.completions.create({
                model: CONFIG.OPENAI_MODEL,
                messages: [
                    {
                        role: "system",
                        content: "Analyze the user query and identify key topics, keywords, and intent. Return a concise analysis."
                    },
                    { role: "user", content: `Analyze this query: "${query}"` }
                ],
                temperature: 0.3,
                max_tokens: 100
            });

            return analysis.choices[0].message.content;
        } catch (error) {
            console.error('[AIAgentService] Query analysis failed:', error);
            return null;
        }
    }

    // Enhanced RAG search using query analysis
    async getEnhancedContext(query) {
        try {
            // First, analyze the query to understand intent
            const queryAnalysis = await this.analyzeQuery(query);

            // Use both original query and analysis for better retrieval
            const searchQueries = [query];
            if (queryAnalysis) {
                searchQueries.push(queryAnalysis);
            }

            const allRelevantChunks = [];

            for (const searchQuery of searchQueries) {
                const chunks = await this.ragService.findRelevantChunks(searchQuery, 2);
                allRelevantChunks.push(...chunks);
            }

            // Remove duplicates and limit to top chunks
            const uniqueChunks = [...new Set(allRelevantChunks)];
            return uniqueChunks.slice(0, 3);

        } catch (error) {
            console.error('[AIAgentService] Enhanced context retrieval failed:', error);
            return await this.ragService.findRelevantChunks(query, 3);
        }
    }

    // Get performance metrics
    getPerformanceMetrics() {
        return {
            knowledgeChunks: this.ragService.knowledgeChunks.length,
            cachedSummaries: this.contextService.conversationSummaries.size,
            initialized: this.initialized
        };
    }
}

module.exports = AIAgentService; 