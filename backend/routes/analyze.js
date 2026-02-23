/**
 * Analyze Route — POST /api/analyze
 * 
 * Accepts user code and problem context, returns AI-powered
 * code analysis. Evaluates if the code is complete or a stub,
 * and provides appropriate feedback (rating, complexity, or brute/optimal approach).
 */

const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const { aiCache } = require('../services/cacheService');

router.post('/', async (req, res) => {
  try {
    const { code, language, problemName, difficulty } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const cacheKey = aiCache._makeKey('analyze_v2', { code, language, problemName });
    const cached = aiCache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

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
}
`;

    const response = await aiService.generate(prompt, cacheKey);
    const parsed = aiService.parseJSON(response);

    res.json(parsed);
  } catch (error) {
    console.error('❌ Analyze error:', error.message);
    res.status(500).json({ error: 'Analysis failed', message: error.message });
  }
});

module.exports = router;
