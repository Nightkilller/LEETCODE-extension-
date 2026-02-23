/**
 * AI Service — Direct REST API calls to Gemini or Groq
 * Runs in the background service worker context.
 * Supports multiple AI providers.
 */

const PROVIDERS = {
    gemini: {
        name: 'Gemini (Google)',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent',
    },
    groq: {
        name: 'Groq (Fast & Free)',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        model: 'llama-3.3-70b-versatile',
    }
};

/**
 * Get stored provider and key
 */
async function getAIConfig() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['aiProvider', 'aiApiKey'], (result) => {
            resolve({
                provider: result.aiProvider || 'groq',
                key: result.aiApiKey || null,
            });
        });
    });
}

// Compat aliases used by background.js
async function getApiKey() {
    const config = await getAIConfig();
    return config.key;
}

async function setApiKey(key) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ aiApiKey: key }, () => resolve(true));
    });
}

async function setAIProvider(provider) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ aiProvider: provider }, () => resolve(true));
    });
}

/**
 * Call AI provider
 */
async function callAI(prompt) {
    const config = await getAIConfig();
    if (!config.key) throw new Error('NO_API_KEY');

    if (config.provider === 'groq') {
        return callGroq(prompt, config.key);
    } else {
        return callGemini(prompt, config.key);
    }
}

/**
 * Call Groq REST API (OpenAI-compatible)
 */
async function callGroq(prompt, apiKey) {
    const response = await fetch(PROVIDERS.groq.endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: PROVIDERS.groq.model,
            messages: [
                { role: 'system', content: 'You are an expert competitive programming coach. Respond in structured JSON when asked.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 2000,
        })
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 401) throw new Error('INVALID_API_KEY');
        throw new Error(err.error?.message || `Groq API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

/**
 * Call Gemini REST API
 */
async function callGemini(prompt, apiKey) {
    const response = await fetch(`${PROVIDERS.gemini.endpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: 'You are an expert competitive programming coach. Respond in structured JSON when asked.\n\n' + prompt
                }]
            }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
        })
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 400 && err.error?.message?.includes('API key')) throw new Error('INVALID_API_KEY');
        throw new Error(err.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Parse AI response as JSON
 */
function parseGeminiJSON(text) {
    try {
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) return JSON.parse(jsonMatch[1]);
        return JSON.parse(text);
    } catch {
        return { raw: text };
    }
}

/**
 * Analyze code
 */
async function analyzeCode({ code, language, problemName, difficulty }) {
    const prompt = `You are a DSA engine that returns data ONLY in the required JSON format.
STRICT RULES:
- Do NOT return explanations
- Do NOT return intuition
- Do NOT return approach text
- Do NOT return optimality reasoning
- Output must be pure JSON ONLY
- Do NOT wrap JSON in markdown block like \`\`\`json
- Code must be in the same language as the user's code
- Code must be clean and copy-paste ready

INPUT:
- Problem: ${problemName}
- Language: ${language}
- User code: ${code}

GOAL:
Generate only:
1) Brute force solution code
2) Optimal solution code
3) Time & Space complexity of the USER'S code

OUTPUT FORMAT (REQUIRED):
{
  "bruteForce": {
    "code": "FULL CODE HERE"
  },
  "optimal": {
    "code": "FULL CODE HERE"
  },
  "complexity": {
    "time": "TIME COMPLEXITY OF USER CODE",
    "space": "SPACE COMPLEXITY OF USER CODE"
  }
}`;

    const response = await callAI(prompt);
    return parseGeminiJSON(response);
}

/**
 * Predict improvement
 */
async function predictImprovement({ username, profileData, topicStats, contestData }) {
    const prompt = `You are an expert competitive programming coach. Based on this user's LeetCode profile, generate a personalized improvement plan.

User: ${username}
Problems Solved: ${JSON.stringify(profileData?.solved || {})}
Contest Rating: ${contestData?.current?.rating || 'N/A'}
Contests Attended: ${contestData?.current?.attendedContestsCount || 0}
Top Percentage: ${contestData?.current?.topPercentage || 'N/A'}%

Topic Mastery (topic: solved count):
${(topicStats || []).map(t => `- ${t.topic || t.name}: ${t.solved} solved`).join('\n')}

Respond in JSON format:
{
  "strengths": ["<topic 1>", "<topic 2>"],
  "weaknesses": ["<topic 1>", "<topic 2>"],
  "insight": "<2-3 sentence personalized insight>",
  "roadmap": [
    {
      "week": 1,
      "focus": "<topic>",
      "problems": <number>,
      "goal": "<specific goal>"
    }
  ],
  "ratingPrediction": {
    "current": <current_rating_or_0>,
    "predicted30Days": <predicted_rating>,
    "predicted90Days": <predicted_rating>,
    "confidence": "<low/medium/high>"
  },
  "dailyPlan": {
    "problemsPerDay": <number>,
    "contestsPerWeek": <number>,
    "focusHoursPerDay": <number>
  }
}`;

    const response = await callAI(prompt);
    return parseGeminiJSON(response);
}
