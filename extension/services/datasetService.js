/**
 * Dataset Service — Local problem dataset lookup
 * Replaces backend/services/datasetService.js
 * Loads extension/data/problems.json at startup.
 */

let problems = null;

async function loadDataset() {
    if (problems) return problems;
    try {
        const url = chrome.runtime.getURL('data/problems.json');
        const res = await fetch(url);
        problems = await res.json();
        console.log(`📦 Dataset loaded: ${problems.length} problems`);
    } catch (err) {
        console.error('❌ Failed to load dataset:', err.message);
        problems = [];
    }
    return problems;
}

function normalizeSlug(str) {
    return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

async function findBySlug(slug) {
    const dataset = await loadDataset();
    const norm = normalizeSlug(slug);
    return dataset.find(p =>
        normalizeSlug(p.slug) === norm || normalizeSlug(p.name) === norm
    ) || null;
}

async function findRelated(slug) {
    const dataset = await loadDataset();
    const problem = await findBySlug(slug);

    let similar = {};
    let topicMatches = [];
    let problemInfo = null;

    if (problem) {
        problemInfo = {
            name: problem.name, slug: problem.slug,
            difficulty: problem.difficulty, topics: problem.topics,
        };
        similar = problem.similar_problems || {};

        topicMatches = dataset
            .filter(p => p.slug !== problem.slug)
            .map(p => {
                const shared = (p.topics || []).filter(t => (problem.topics || []).includes(t));
                return { ...p, sharedTopics: shared.length };
            })
            .filter(p => p.sharedTopics > 0)
            .sort((a, b) => b.sharedTopics - a.sharedTopics)
            .slice(0, 10);
    } else {
        const tokens = (slug || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(x => x.length > 2);
        problemInfo = {
            name: (slug || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            slug, difficulty: 'Unknown', topics: ['Auto-Matched'],
        };
        topicMatches = dataset
            .map(p => {
                let matches = 0;
                (p.topics || []).forEach(t => {
                    if (tokens.some(token => t.toLowerCase().includes(token))) matches += 2;
                });
                if (tokens.some(token => (p.name || '').toLowerCase().includes(token))) matches += 1;
                return { ...p, sharedTopics: matches };
            })
            .filter(p => p.sharedTopics > 0)
            .sort((a, b) => b.sharedTopics - a.sharedTopics)
            .slice(0, 10);
    }

    const formattedTopicMatches = topicMatches.map(p => ({
        name: p.name, slug: p.slug, platform: p.platform,
        difficulty: p.difficulty, topics: p.topics,
        link: p.link || `https://leetcode.com/problems/${p.slug}/`,
    }));

    return {
        problem: problemInfo,
        similar_problems: similar,
        topic_related: formattedTopicMatches,
        isFallback: !problem,
    };
}

async function getTopicStats(solvedSlugs = []) {
    const dataset = await loadDataset();
    const topicCounts = {};
    const topicDifficulty = {};

    for (const slug of solvedSlugs) {
        const problem = await findBySlug(slug);
        if (!problem) continue;
        (problem.topics || []).forEach(topic => {
            if (!topicCounts[topic]) {
                topicCounts[topic] = 0;
                topicDifficulty[topic] = { easy: 0, medium: 0, hard: 0 };
            }
            topicCounts[topic]++;
            const diff = (problem.difficulty || '').toLowerCase();
            if (topicDifficulty[topic][diff] !== undefined) topicDifficulty[topic][diff]++;
        });
    }

    const topicTotals = {};
    dataset.forEach(p => (p.topics || []).forEach(topic => {
        topicTotals[topic] = (topicTotals[topic] || 0) + 1;
    }));

    const allTopicsSet = new Set();
    dataset.forEach(p => (p.topics || []).forEach(t => allTopicsSet.add(t)));
    const allTopics = [...allTopicsSet].sort();

    const topicStats = Object.entries(topicCounts).map(([topic, solved]) => ({
        topic, solved,
        total: topicTotals[topic] || solved,
        mastery: Math.round((solved / (topicTotals[topic] || solved)) * 100),
        breakdown: topicDifficulty[topic],
    })).sort((a, b) => b.solved - a.solved);

    const strong = topicStats.filter(t => t.mastery >= 60).slice(0, 5);
    const weak = topicStats.filter(t => t.mastery < 40)
        .concat(allTopics.filter(topic => !topicStats.find(t => t.topic === topic))
            .map(topic => ({ topic, solved: 0, total: 1, mastery: 0, breakdown: { easy: 0, medium: 0, hard: 0 } })))
        .sort((a, b) => a.mastery - b.mastery).slice(0, 5);

    return { topicStats, strongTopics: strong, weakTopics: weak, totalTopics: allTopics.length };
}
