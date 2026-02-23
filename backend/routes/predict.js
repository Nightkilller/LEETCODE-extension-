/**
 * Predict Route — POST /api/predict
 * 
 * Uses AI to generate a personalized DSA improvement roadmap,
 * rating growth prediction, and actionable recommendations
 * based on user's profile and topic mastery stats.
 */

const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const { aiCache } = require('../services/cacheService');

router.post('/', async (req, res) => {
    try {
        const { username, profileData, topicStats, contestData } = req.body;

        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }

        // Build cache key
        const cacheKey = aiCache._makeKey('predict', {
            username,
            solved: profileData?.solved?.all || 0,
            rating: contestData?.current?.rating || 0,
        });

        const cached = aiCache.get(cacheKey);
        if (cached) {
            return res.json({ ...cached, cached: true });
        }

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
  "insight": "<2-3 sentence personalized insight like: You are strong in Arrays and Binary Search. Your weakest area is Dynamic Programming. Solving 25 DP problems can increase your contest rating by ~150.>",
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

        const response = await aiService.generate(prompt, cacheKey);
        const parsed = aiService.parseJSON(response);

        res.json(parsed);
    } catch (error) {
        console.error('❌ Predict error:', error.message);
        res.status(500).json({ error: 'Prediction failed', message: error.message });
    }
});

module.exports = router;
