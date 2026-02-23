/**
 * AI Service — Abstraction layer over OpenAI and Google Gemini
 * 
 * Reads AI_PROVIDER from env to route prompts to the correct SDK.
 * Includes response caching to avoid redundant API calls.
 */

const { aiCache } = require('./cacheService');

class AIService {
    constructor() {
        this.provider = process.env.AI_PROVIDER || 'groq';
        this.openaiClient = null;
        this.geminiModel = null;
        this.groqClient = null;
    }

    /**
     * Lazy-initialize the AI client on first use
     */
    async _getClient() {
        if (this.provider === 'openai') {
            if (!this.openaiClient) {
                const OpenAI = require('openai');
                this.openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            }
            return this.openaiClient;
        } else if (this.provider === 'groq') {
            if (!this.groqClient) {
                const Groq = require('groq-sdk');
                this.groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
            }
            return this.groqClient;
        } else {
            if (!this.geminiModel) {
                const { GoogleGenerativeAI } = require('@google/generative-ai');
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                this.geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
            }
            return this.geminiModel;
        }
    }

    /**
     * Send a prompt to the configured AI provider
     * @param {string} prompt - The full prompt text
     * @param {string} cacheKey - Optional cache key to avoid re-calling
     * @returns {string} AI response text
     */
    async generate(prompt, cacheKey = null) {
        // Check cache first
        if (cacheKey) {
            const cached = aiCache.get(cacheKey);
            if (cached) {
                console.log('💾 AI cache hit:', cacheKey.substring(0, 40));
                return cached;
            }
        }

        let result;

        try {
            if (this.provider === 'openai') {
                result = await this._callOpenAI(prompt);
            } else if (this.provider === 'groq') {
                result = await this._callGroq(prompt);
            } else {
                result = await this._callGemini(prompt);
            }
        } catch (error) {
            console.error(`❌ AI ${this.provider} error:`, error.message);
            throw new Error(`AI service error: ${error.message}`);
        }

        // Cache the result
        if (cacheKey && result) {
            aiCache.set(cacheKey, result);
        }

        return result;
    }

    /**
     * Call Groq Cloud
     */
    async _callGroq(prompt) {
        const client = await this._getClient();
        const response = await client.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: 'You are an expert competitive programming coach. Respond in structured JSON when asked.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 2000,
        });
        return response.choices[0].message.content;
    }

    /**
     * Call OpenAI GPT-4o-mini
     */
    async _callOpenAI(prompt) {
        const client = await this._getClient();
        const response = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are an expert competitive programming coach. Respond in structured JSON when asked.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 2000,
        });
        return response.choices[0].message.content;
    }

    /**
     * Call Google Gemini
     */
    async _callGemini(prompt) {
        const model = await this._getClient();
        const fullPrompt = 'You are an expert competitive programming coach. Respond in structured JSON when asked.\n\n' + prompt;
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        return response.text();
    }

    /**
     * Parse AI response as JSON, with fallback
     */
    parseJSON(text) {
        try {
            // Try to extract JSON from markdown code blocks
            const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[1]);
            }
            return JSON.parse(text);
        } catch {
            // Return as structured text if JSON parsing fails
            return { raw: text };
        }
    }
}

module.exports = new AIService();
