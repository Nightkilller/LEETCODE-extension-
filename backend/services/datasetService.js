/**
 * Dataset Service — Problem dataset loader and query engine
 * 
 * Loads the curated problems.json and provides lookup,
 * search, and recommendation methods.
 */

const path = require('path');
const { datasetCache } = require('./cacheService');

let problems = null;

/**
 * Load and index the dataset (lazy, one-time)
 */
function loadDataset() {
    if (problems) return problems;

    try {
        problems = require(path.join(__dirname, '..', 'dataset', 'problems.json'));
        console.log(`📦 Dataset loaded: ${problems.length} problems`);
    } catch (err) {
        console.error('❌ Failed to load dataset:', err.message);
        problems = [];
    }
    return problems;
}

/**
 * Find a problem by its LeetCode slug
 */
function findBySlug(slug) {
    const cacheKey = `slug:${slug}`;
    const cached = datasetCache.get(cacheKey);
    if (cached) return cached;

    const dataset = loadDataset();
    const normalizedArg = (slug || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

    const problem = dataset.find(p => {
        const pSlug = (p.slug || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
        const pName = (p.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
        return pSlug === normalizedArg || pName === normalizedArg;
    });

    if (problem) datasetCache.set(cacheKey, problem);
    return problem || null;
}

/**
 * Find related/similar problems for a given problem slug
 */
function findRelated(slug) {
    const cacheKey = `related:${slug}`;
    const cached = datasetCache.get(cacheKey);
    if (cached) return cached;

    const dataset = loadDataset();
    const problem = findBySlug(slug);

    let similar = {};
    let topicMatches = [];
    let problemInfo = null;

    if (problem) {
        problemInfo = {
            name: problem.name,
            slug: problem.slug,
            difficulty: problem.difficulty,
            topics: problem.topics,
        };
        similar = problem.similar_problems || {};

        // Also find problems sharing the same topics
        topicMatches = dataset
            .filter(p => p.slug !== problem.slug)
            .map(p => {
                const sharedTopics = (p.topics || []).filter(t =>
                    (problem.topics || []).includes(t)
                );
                return { ...p, sharedTopics: sharedTopics.length };
            })
            .filter(p => p.sharedTopics > 0)
            .sort((a, b) => b.sharedTopics - a.sharedTopics)
            .slice(0, 10);

    } else {
        // Fallback: Exact match not found -> Match by topic heuristic
        const tokens = (slug || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(x => x.length > 2);
        problemInfo = {
            name: (slug || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            slug: slug,
            difficulty: 'Unknown',
            topics: ['Auto-Matched'],
        };

        topicMatches = dataset
            .map(p => {
                let matches = 0;
                (p.topics || []).forEach(t => {
                    const tNorm = t.toLowerCase();
                    if (tokens.some(token => tNorm.includes(token))) matches += 2;
                });
                const nNorm = (p.name || '').toLowerCase();
                if (tokens.some(token => nNorm.includes(token))) matches += 1;

                return { ...p, sharedTopics: matches };
            })
            .filter(p => p.sharedTopics > 0)
            .sort((a, b) => b.sharedTopics - a.sharedTopics)
            .slice(0, 10);
    }

    const formattedTopicMatches = topicMatches.map(p => ({
        name: p.name,
        slug: p.slug,
        platform: p.platform,
        difficulty: p.difficulty,
        topics: p.topics,
        link: p.link || `https://leetcode.com/problems/${p.slug}/`,
    }));

    const result = {
        problem: problemInfo,
        similar_problems: similar,
        topic_related: formattedTopicMatches,
        isFallback: !problem
    };

    datasetCache.set(cacheKey, result);
    return result;
}

/**
 * Get topic mastery stats given a list of solved problem slugs
 */
function getTopicStats(solvedSlugs = []) {
    const dataset = loadDataset();
    const topicCounts = {};
    const topicDifficulty = {};

    solvedSlugs.forEach(slug => {
        const problem = findBySlug(slug);
        if (!problem) return;

        (problem.topics || []).forEach(topic => {
            if (!topicCounts[topic]) {
                topicCounts[topic] = 0;
                topicDifficulty[topic] = { easy: 0, medium: 0, hard: 0 };
            }
            topicCounts[topic]++;
            const diff = (problem.difficulty || '').toLowerCase();
            if (topicDifficulty[topic][diff] !== undefined) {
                topicDifficulty[topic][diff]++;
            }
        });
    });

    // Calculate total problems per topic in dataset for mastery %
    const topicTotals = {};
    dataset.forEach(p => {
        (p.topics || []).forEach(topic => {
            topicTotals[topic] = (topicTotals[topic] || 0) + 1;
        });
    });

    return Object.entries(topicCounts)
        .map(([topic, solved]) => ({
            topic,
            solved,
            total: topicTotals[topic] || solved,
            mastery: Math.round((solved / (topicTotals[topic] || solved)) * 100),
            breakdown: topicDifficulty[topic],
        }))
        .sort((a, b) => b.solved - a.solved);
}

/**
 * Get all unique topics from the dataset
 */
function getAllTopics() {
    const dataset = loadDataset();
    const topics = new Set();
    dataset.forEach(p => (p.topics || []).forEach(t => topics.add(t)));
    return [...topics].sort();
}

module.exports = { loadDataset, findBySlug, findRelated, getTopicStats, getAllTopics };
