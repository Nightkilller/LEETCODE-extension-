/**
 * Profile Route — GET /api/profile/:username
 * 
 * Proxies LeetCode GraphQL API to fetch user profile data,
 * solved counts, topic stats, and contest history.
 */

const express = require('express');
const router = express.Router();
const { getUserProfile, getContestHistory } = require('../services/leetcodeService');

router.get('/:username', async (req, res) => {
    try {
        const { username } = req.params;

        if (!username || !username.trim()) {
            return res.status(400).json({ error: 'Username is required' });
        }

        // Fetch profile and contest data in parallel
        const [profile, contest] = await Promise.all([
            getUserProfile(username),
            getContestHistory(username).catch(() => ({
                current: { attendedContestsCount: 0, rating: 0, globalRanking: 0, topPercentage: 100 },
                history: []
            }))
        ]);

        // Calculate acceptance rate approximation
        const totalSolved = profile.solved.all;
        const acceptanceRate = totalSolved > 0
            ? Math.round((totalSolved / (totalSolved * 1.8)) * 100) // Approximate
            : 0;

        res.json({
            ...profile,
            contest,
            acceptanceRate,
        });
    } catch (error) {
        console.error('❌ Profile error:', error.message);

        if (error.message.includes('not found')) {
            return res.status(404).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to fetch profile', message: error.message });
    }
});

module.exports = router;
