/**
 * Related Route — GET /api/related/:problemSlug
 * 
 * Looks up a problem in the dataset and returns similar
 * problems from LeetCode, GFG, Codeforces, and AtCoder.
 */

const express = require('express');
const router = express.Router();
const { findRelated, findBySlug } = require('../services/datasetService');

router.get('/:problemSlug', async (req, res) => {
    try {
        const { problemSlug } = req.params;

        if (!problemSlug) {
            return res.status(400).json({ error: 'Problem slug is required' });
        }

        const result = findRelated(problemSlug);

        if (!result.problem) {
            // If not in dataset, return minimal info
            return res.json({
                problem: {
                    name: problemSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                    slug: problemSlug,
                    difficulty: 'Unknown',
                    topics: [],
                },
                similar_problems: { leetcode: [], gfg: [], codeforces: [], coding_ninjas: [] },
                topic_related: [],
                message: 'Problem not found in dataset. For full cross-platform recommendations, the dataset needs to be expanded.'
            });
        }

        res.json(result);
    } catch (error) {
        console.error('❌ Related error:', error.message);
        res.status(500).json({ error: 'Failed to find related problems', message: error.message });
    }
});

module.exports = router;
