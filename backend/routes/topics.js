/**
 * Topics Route — POST /api/topics
 * 
 * Accepts solved problem slugs, cross-references the dataset,
 * and returns topic mastery stats with weak area detection.
 */

const express = require('express');
const router = express.Router();
const { getTopicStats, getAllTopics } = require('../services/datasetService');

router.post('/', async (req, res) => {
    try {
        const { solvedProblems = [] } = req.body;

        const topicStats = getTopicStats(solvedProblems);
        const allTopics = getAllTopics();

        // Identify weak and strong topics
        const strong = topicStats
            .filter(t => t.mastery >= 60)
            .slice(0, 5);

        const weak = topicStats
            .filter(t => t.mastery < 40)
            .concat(
                // Include topics with 0 problems solved
                allTopics
                    .filter(topic => !topicStats.find(t => t.topic === topic))
                    .map(topic => ({ topic, solved: 0, total: 1, mastery: 0, breakdown: { easy: 0, medium: 0, hard: 0 } }))
            )
            .sort((a, b) => a.mastery - b.mastery)
            .slice(0, 5);

        res.json({
            topicStats,
            strongTopics: strong,
            weakTopics: weak,
            totalTopics: allTopics.length,
        });
    } catch (error) {
        console.error('❌ Topics error:', error.message);
        res.status(500).json({ error: 'Failed to compute topics', message: error.message });
    }
});

module.exports = router;
