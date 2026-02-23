/**
 * Gemini AI Service — Direct REST API calls to Google Gemini
 * Runs in the background service worker context.
 */

const GEMINI_MODEL = 'gemini-2.0-flash-lite';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Get the stored API key
 */
async function getApiKey() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['geminiApiKey'], (result) => {
            resolve(result.geminiApiKey || null);
        });
    });
}

/**
 * Save API key
 */
async function setApiKey(key) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ geminiApiKey: key }, () => resolve(true));
    });
}

/**
 * Call Gemini API directly
 */
async function callGemini(prompt) {
    const apiKey = await getApiKey();
    if (!apiKey) {
        throw new Error('NO_API_KEY');
    }

    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: 'You are an expert competitive programming coach. Respond in structured JSON when asked.\n\n' + prompt
                }]
            }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 2048,
            }
        })
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 400 && err.error?.message?.includes('API key')) {
            throw new Error('INVALID_API_KEY');
        }
        throw new Error(err.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini');
    return text;
}

/**
 * Parse AI response as JSON, with fallback
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
 * Analyze code — replacement for POST /api/analyze
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

    const response = await callGemini(prompt);
    return parseGeminiJSON(response);
}

/**
 * Predict improvement — replacement for POST /api/predict
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

    const response = await callGemini(prompt);
    return parseGeminiJSON(response);
}
