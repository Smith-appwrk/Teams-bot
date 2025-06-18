const { OpenAI } = require('openai');
const CONFIG = require('../utils/config');

class RAGService {
    constructor(openaiService) {
        this.openaiService = openaiService;
        this.knowledgeBase = '';
        this.knowledgeChunks = [];
        this.chunkEmbeddings = [];
        this.initialized = false;
    }

    async initialize(knowledgeBaseContent) {
        if (this.initialized) return;

        this.knowledgeBase = knowledgeBaseContent;
        this.knowledgeChunks = this.chunkText(knowledgeBaseContent);

        console.log(`[RAGService] Initialized with ${this.knowledgeChunks.length} knowledge chunks`);
        this.initialized = true;
    }

    chunkText(text, maxChunkSize = 500) {
        const sections = text.split(/#{1,3}\s/); // Split by markdown headers
        const chunks = [];

        for (const section of sections) {
            if (section.trim().length === 0) continue;

            if (section.length <= maxChunkSize) {
                chunks.push(section.trim());
            } else {
                // Split larger sections by paragraphs
                const paragraphs = section.split('\n\n');
                let currentChunk = '';

                for (const paragraph of paragraphs) {
                    if ((currentChunk + paragraph).length <= maxChunkSize) {
                        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
                    } else {
                        if (currentChunk) chunks.push(currentChunk.trim());
                        currentChunk = paragraph;
                    }
                }

                if (currentChunk) chunks.push(currentChunk.trim());
            }
        }

        return chunks;
    }

    async findRelevantChunks(query, maxChunks = 3) {
        try {
            // Use semantic similarity to find most relevant chunks
            const relevantChunks = [];

            // Simple keyword-based scoring for now (can be enhanced with embeddings)
            const queryWords = query.toLowerCase().split(/\s+/);

            for (const chunk of this.knowledgeChunks) {
                let score = 0;
                const chunkLower = chunk.toLowerCase();

                // Score based on keyword matches
                for (const word of queryWords) {
                    if (word.length < 3) continue; // Skip short words
                    const regex = new RegExp(`\\b${word}`, 'gi');
                    const matches = (chunkLower.match(regex) || []).length;
                    score += matches * word.length; // Longer words get higher scores
                }

                // Boost score for exact phrase matches
                if (chunkLower.includes(query.toLowerCase())) {
                    score += query.length * 2;
                }

                if (score > 0) {
                    relevantChunks.push({ chunk, score });
                }
            }

            // Sort by score and return top chunks
            const topChunks = relevantChunks
                .sort((a, b) => b.score - a.score)
                .slice(0, maxChunks)
                .map(item => item.chunk);

            console.log(`[RAGService] Found ${topChunks.length} relevant chunks for query: "${query}"`);
            return topChunks;

        } catch (error) {
            console.error('[RAGService] Error finding relevant chunks:', error);
            // Fallback to first few chunks
            return this.knowledgeChunks.slice(0, maxChunks);
        }
    }

    // Enhanced semantic search using OpenAI embeddings (optional upgrade)
    async findRelevantChunksWithEmbeddings(query, maxChunks = 3) {
        try {
            // This would require creating embeddings for all chunks first
            // For now, using the keyword-based approach above
            return await this.findRelevantChunks(query, maxChunks);
        } catch (error) {
            console.error('[RAGService] Error with embedding-based search:', error);
            return await this.findRelevantChunks(query, maxChunks);
        }
    }

    async getContextForQuery(query, maxChunks = 3) {
        const relevantChunks = await this.findRelevantChunks(query, maxChunks);
        return relevantChunks;
    }
}

module.exports = RAGService; 