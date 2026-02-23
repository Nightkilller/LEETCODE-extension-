/**
 * Background Service Worker — Message Hub
 *
 * Routes all API calls through the service worker.
 * Imports: geminiService.js, leetcodeService.js, datasetService.js
 */

importScripts(
    'services/geminiService.js',
    'services/leetcodeService.js',
    'services/datasetService.js'
);

// Open side panel on extension icon click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    // ── Existing handlers ───────────────────────────────────

    if (message.type === 'STORE_USERNAME') {
        chrome.storage.local.set({ leetcodeUsername: message.username }, () => {
            sendResponse({ success: true });
        });
        return true;
    }

    if (message.type === 'GET_USERNAME') {
        chrome.storage.local.get(['leetcodeUsername'], (result) => {
            sendResponse({ username: result.leetcodeUsername || null });
        });
        return true;
    }

    if (message.type === 'STORE_PROBLEM') {
        chrome.storage.local.set({
            currentProblem: message.problem,
            lastUpdated: Date.now()
        }, () => {
            sendResponse({ success: true });
        });
        return true;
    }

    if (message.type === 'GET_CURRENT_PROBLEM') {
        chrome.storage.local.get(['currentProblem'], (result) => {
            sendResponse({ problem: result.currentProblem || null });
        });
        return true;
    }

    if (message.type === 'OPEN_NAVIGATOR') {
        chrome.tabs.create({
            url: chrome.runtime.getURL('practiceNavigator/navigator.html')
        });
        sendResponse({ success: true });
        return true;
    }

    // ── API Key management ──────────────────────────────────

    if (message.type === 'SET_API_KEY') {
        setApiKey(message.key).then(() => sendResponse({ success: true }));
        return true;
    }

    if (message.type === 'GET_API_KEY') {
        getApiKey().then(key => sendResponse({ key }));
        return true;
    }

    // ── AI: Analyze code ────────────────────────────────────

    if (message.type === 'CALL_ANALYZE') {
        analyzeCode(message.payload)
            .then(result => sendResponse({ success: true, data: result }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    // ── AI: Predict improvement ─────────────────────────────

    if (message.type === 'CALL_PREDICT') {
        predictImprovement(message.payload)
            .then(result => sendResponse({ success: true, data: result }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    // ── LeetCode: Profile ───────────────────────────────────

    if (message.type === 'GET_PROFILE') {
        (async () => {
            try {
                const [profile, contest] = await Promise.all([
                    getUserProfile(message.username),
                    getContestHistory(message.username).catch(() => ({
                        current: { attendedContestsCount: 0, rating: 0, globalRanking: 0, topPercentage: 100 },
                        history: []
                    }))
                ]);
                sendResponse({ success: true, data: { ...profile, contest } });
            } catch (err) {
                sendResponse({ success: false, error: err.message });
            }
        })();
        return true;
    }

    // ── Dataset: Related problems ───────────────────────────

    if (message.type === 'GET_RELATED') {
        findRelated(message.slug)
            .then(result => sendResponse({ success: true, data: result }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    // ── Dataset: Topic stats ────────────────────────────────

    if (message.type === 'GET_TOPICS') {
        getTopicStats(message.solvedProblems || [])
            .then(result => sendResponse({ success: true, data: result }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }
});

// Track when user navigates to LeetCode problem pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('leetcode.com/problems/')) {
        chrome.tabs.sendMessage(tabId, { type: 'PAGE_LOADED' }).catch(() => { });
    }
});
