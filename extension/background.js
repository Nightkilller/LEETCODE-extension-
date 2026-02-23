/**
 * Background Service Worker
 * 
 * Handles extension messaging, tab detection, and
 * username storage for the popup dashboard.
 */

// Listen for messages from content script
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'STORE_USERNAME') {
        chrome.storage.local.set({ leetcodeUsername: message.username }, () => {
            sendResponse({ success: true });
        });
        return true; // Keep channel open for async response
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
});

// Track when user navigates to LeetCode problem pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('leetcode.com/problems/')) {
        // Notify content script (it may already be running)
        chrome.tabs.sendMessage(tabId, { type: 'PAGE_LOADED' }).catch(() => {
            // Content script may not be ready yet, ignore
        });
    }
});
