/**
 * Side Panel Logic
 * Handles tabs, communication with content script, and AI calls
 * using a clean chat-like interface.
 * No backend server needed — calls Gemini API directly via background.js.
 */

/** Send a message to background.js and await the response */
function bgMessage(msg) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(msg, (response) => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            if (response && !response.success) return reject(new Error(response.error || 'Unknown error'));
            resolve(response);
        });
    });
}

// State
let currentProblem = null;
let currentCode = null;
let currentLanguage = null;
let profileDataCache = null;

// ── Display Helpers (safe show/hide that handles the .hidden class) ───
function showEl(el, displayType = 'block') {
    if (!el) return;
    el.classList.remove('hidden');
    el.style.display = displayType;
}
function hideEl(el) {
    if (!el) return;
    el.classList.add('hidden');
    el.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    setupThemeToggle();
    setupTabs();
    setupCopyDelegation();
    setupSettings();

    // Bind actions
    document.getElementById('refreshContextBtn').addEventListener('click', fetchContextFromPage);
    document.getElementById('analyzeBtn').addEventListener('click', runAnalysis);
    document.getElementById('retrySimilarBtn').addEventListener('click', loadSimilarQuestions);

    document.getElementById('saveUsernameBtn').addEventListener('click', () => {
        const val = document.getElementById('manualUsername').value.trim();
        if (val) {
            chrome.storage.local.set({ leetcodeUsername: val }, () => {
                profileLoaded = false;
                loadProfileStats();
            });
        }
    });

    // Initial fetch
    fetchContextFromPage();

    // Check API key on startup
    checkApiKeyOnStartup();
});

// ── Settings Modal ────────────────────────────────────────────────
function setupSettings() {
    const overlay = document.getElementById('settingsOverlay');
    const openBtn = document.getElementById('settingsBtn');
    const saveBtn = document.getElementById('apiKeySaveBtn');
    const cancelBtn = document.getElementById('apiKeyCancelBtn');
    const input = document.getElementById('apiKeyInput');
    const status = document.getElementById('apiKeyStatus');
    const providerSelect = document.getElementById('providerSelect');

    openBtn.addEventListener('click', async () => {
        // Load existing config
        const res = await bgMessage({ type: 'GET_AI_CONFIG' });
        const config = res.data || {};
        providerSelect.value = config.provider || 'groq';
        if (config.key) {
            input.value = config.key;
            status.innerHTML = '<span style="color:var(--color-success);">✅ Key saved</span>';
        } else {
            input.value = '';
            status.innerHTML = '<span style="color:var(--color-warning);">⚠️ No key set</span>';
        }
        overlay.style.display = 'flex';
    });

    cancelBtn.addEventListener('click', () => {
        overlay.style.display = 'none';
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.style.display = 'none';
    });

    saveBtn.addEventListener('click', async () => {
        const key = input.value.trim();
        const provider = providerSelect.value;
        if (!key) {
            status.innerHTML = '<span style="color:var(--color-wrong);">❌ Please enter a key</span>';
            return;
        }
        saveBtn.textContent = 'Saving...';
        try {
            await bgMessage({ type: 'SET_AI_PROVIDER', provider });
            await bgMessage({ type: 'SET_API_KEY', key });
            status.innerHTML = `<span style="color:var(--color-success);">✅ ${provider === 'groq' ? 'Groq' : 'Gemini'} key saved!</span>`;
            saveBtn.textContent = 'Save';
            setTimeout(() => { overlay.style.display = 'none'; }, 800);
        } catch (err) {
            status.innerHTML = `<span style="color:var(--color-wrong);">❌ ${err.message}</span>`;
            saveBtn.textContent = 'Save';
        }
    });
}

async function checkApiKeyOnStartup() {
    try {
        const res = await bgMessage({ type: 'GET_API_KEY' });
        if (!res.key) {
            // Auto-open settings if no key
            setTimeout(() => {
                document.getElementById('settingsOverlay').style.display = 'flex';
                document.getElementById('apiKeyStatus').innerHTML =
                    '<span style="color:var(--color-warning);">⚠️ Please set your Gemini API key to use AI features</span>';
            }, 500);
        }
    } catch (e) { }
}

// ── Theme ─────────────────────────────────────────────────────────
function setupThemeToggle() {
    const btn = document.getElementById('themeToggle');
    const stored = localStorage.getItem('lc-coach-theme');
    if (stored === 'light') document.body.classList.add('light');

    btn.addEventListener('click', () => {
        document.body.classList.toggle('light');
        localStorage.setItem('lc-coach-theme', document.body.classList.contains('light') ? 'light' : 'dark');
    });
}

// ── Tabs ──────────────────────────────────────────────────────────
function setupTabs() {
    const buttons = document.querySelectorAll('.tab-btn');
    const panes = document.querySelectorAll('.tab-pane');

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));

            // Hide all panes (display:none) 
            panes.forEach(p => {
                p.style.display = 'none';
            });

            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            const targetPane = document.getElementById(targetId);

            // Show as flex column (critical — removing 'hidden' alone 
            // defaults to display:block which breaks the flex layout)
            targetPane.style.display = 'flex';

            // Lazy load
            if (targetId === 'tab-similar' && currentProblem) {
                loadSimilarQuestions();
            } else if (targetId === 'tab-stats') {
                loadProfileStats();
            }
        });
    });

    // Initialize: hide inactive panes, show active one properly
    panes.forEach(p => {
        if (p.classList.contains('active')) {
            p.classList.remove('hidden');
            p.style.display = 'flex';
        } else {
            p.style.display = 'none';
        }
    });
}

// ── Comms with Content Script ─────────────────────────────────────
async function fetchContextFromPage() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || (!tab.url.includes('leetcode.com/problems/') && !tab.url.includes('localhost'))) {
            showNoProblemState();
            return;
        }

        const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_DATA' });
        if (response && response.problem) {

            // Detect if problem changed to clear old cache
            if (currentProblem && currentProblem.slug !== response.problem.slug) {
                similarLoadedFor = null;
                document.getElementById('similarContent').innerHTML = '';

                // Reset Chat History, keeping just the first helper message
                const history = document.getElementById('chatHistory');
                history.innerHTML = '<div class="text-center text-xs text-dim mt-2">Read your code and click Analyze below.</div>';
            }

            currentProblem = response.problem;
            currentCode = response.code;
            currentLanguage = response.language || 'Unknown';
            if (response.username) {
                const uLabel = document.getElementById('headerUsername');
                uLabel.textContent = response.username;
                uLabel.style.display = 'inline-flex';
            }
            showAnalysisState();
        } else {
            showNoProblemState();
        }
    } catch (err) {
        console.log('Content script error:', err);
        showNoProblemState();
    }
}

function showNoProblemState() {
    const nps = document.getElementById('noProblemState');
    const as = document.getElementById('analysisState');
    nps.classList.remove('hidden');
    nps.style.display = 'flex';
    as.classList.add('hidden');
    as.style.display = 'none';
    document.getElementById('headerContext').textContent = 'Waiting for LeetCode';
}

function showAnalysisState() {
    const nps = document.getElementById('noProblemState');
    const as = document.getElementById('analysisState');
    nps.classList.add('hidden');
    nps.style.display = 'none';
    as.classList.remove('hidden');
    as.style.display = 'flex';

    document.getElementById('probName').textContent = currentProblem.name || 'Unknown Problem';

    const diffEl = document.getElementById('probDiff');
    diffEl.textContent = currentProblem.difficulty || 'Easy';
    diffEl.className = 'diff-badge';
    if (currentProblem.difficulty === 'Easy') diffEl.classList.add('text-easy');
    if (currentProblem.difficulty === 'Medium') diffEl.classList.add('text-medium');
    if (currentProblem.difficulty === 'Hard') diffEl.classList.add('text-hard');

    document.getElementById('headerContext').textContent = currentLanguage;
}

// ── Core Function: Chat-like Analyze Code ──────────────────────────
async function runAnalysis() {
    // Try mapping the latest code state again before analyzing
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_DATA' });
        if (response) {
            currentCode = response.code;
            currentLanguage = response.language;
        }
    } catch (e) { }

    if (!currentCode || currentCode.trim().length === 0) {
        appendSystemMessage("⚠️ No code detected. Please write code in the LeetCode editor first.");
        return;
    }

    const btn = document.getElementById('analyzeBtn');
    btn.disabled = true;
    btn.innerHTML = `<div class="spinner border-t-primary-inv w-4 h-4 mr-2"></div> Analyzing...`;

    // 1. Append user's code to chat
    appendUserMessage(currentCode, currentLanguage);

    // 2. Append temporary loading bubble
    const loadingId = appendLoadingBubble();

    try {
        const response = await bgMessage({
            type: 'CALL_ANALYZE',
            payload: {
                code: currentCode,
                language: currentLanguage,
                problemName: currentProblem.name,
                difficulty: currentProblem.difficulty
            }
        });

        const data = response.data;

        // Remove loading
        document.getElementById(loadingId).remove();

        // 3. Append AI response
        appendMessageAI(data);

    } catch (err) {
        console.error(err);
        document.getElementById(loadingId).remove();
        appendSystemMessage("❌ Analysis failed: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> Analyze Latest Code`;
    }
}

// Chat UI Helpers
function scrollToBottom() {
    const history = document.getElementById('chatHistory');
    history.scrollTop = history.scrollHeight;
}

function appendUserMessage(code, lang) {
    const history = document.getElementById('chatHistory');
    const div = document.createElement('div');
    div.className = "self-end max-w-[90%] bg-surface rounded-l-xl rounded-tr-xl p-3 border border-subtle";

    // truncation if too long
    const displayCode = code.length > 300 ? code.substring(0, 300) + '\n... (truncated)' : code;

    div.innerHTML = `
    <div class="text-[10px] text-dim uppercase font-bold mb-1 mr-1 text-right">${lang}</div>
    <pre class="code-font text-xs overflow-x-auto whitespace-pre-wrap text-muted bg-primary p-2 rounded">${escapeHTML(displayCode)}</pre>
  `;
    history.appendChild(div);
    scrollToBottom();
}

function appendSystemMessage(msg) {
    const history = document.getElementById('chatHistory');
    const div = document.createElement('div');
    div.className = "text-center text-xs text-error my-2";
    div.textContent = msg;
    history.appendChild(div);
    scrollToBottom();
}

function appendLoadingBubble() {
    const history = document.getElementById('chatHistory');
    const id = 'loader-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = "self-start w-full max-w-[95%] bg-card rounded-r-xl rounded-tl-xl p-4 border border-subtle shadow-sm flex flex-col gap-3";
    div.innerHTML = `
      <div class="flex justify-between items-center border-b border-subtle pb-2">
        <div class="bg-surface skeleton-pulse rounded" style="width: 100px; height: 16px;"></div>
        <div class="spinner border-2 border-border-subtle border-t-accent" style="width: 16px; height: 16px;"></div>
      </div>
      <div class="flex flex-col gap-2 mt-2">
         <div class="bg-surface skeleton-pulse rounded" style="width: 100%; height: 12px;"></div>
         <div class="bg-surface skeleton-pulse rounded" style="width: 80%; height: 12px;"></div>
         <div class="bg-surface skeleton-pulse rounded" style="width: 60%; height: 12px;"></div>
      </div>
    `;
    history.appendChild(div);
    scrollToBottom();
    return id;
}

function appendMessageAI(data) {
    console.log('🤖 AI Response data:', JSON.stringify(data, null, 2));

    const history = document.getElementById('chatHistory');

    // Clear the chat history so we only display the latest analysis cleanly
    history.innerHTML = '<div class="text-center text-xs text-dim mt-2">Analysis complete.</div>';

    const div = document.createElement('div');
    div.className = "w-full flex flex-col gap-4";

    if (data.raw && !data.bruteForce && !data.optimal) {
        div.innerHTML = `
          <div class="status-bar" id="status-bar" style="border-color: rgba(248, 113, 113, 0.3); background-color: rgba(248, 113, 113, 0.08); color: var(--color-wrong);">
             ⚠️ Error understanding AI Response
          </div>
          <div class="text-xs text-dim leading-relaxed whitespace-pre-wrap mt-2 p-2 bg-card rounded border border-subtle">${escapeHTML(data.raw)}</div>
        `;
        history.appendChild(div);
        scrollToBottom();
        return;
    }

    if (data.error) {
        div.innerHTML = `
          <div class="status-bar w-full" style="border-color: rgba(248, 113, 113, 0.3); background-color: rgba(248, 113, 113, 0.08); color: var(--color-wrong);">
             ❌ ${escapeHTML(data.error)}: ${escapeHTML(data.message || '')}
          </div>
        `;
        history.appendChild(div);
        scrollToBottom();
        return;
    }

    // 1. Complexity Cards
    const comp = data.complexity || {};
    const timeC = comp.time || 'N/A';
    const spaceC = comp.space || 'N/A';

    const cardsHTML = `
        <div class="complexity-grid w-full">
            <div class="glass-card card-time">
                <div class="card-icon">⚡</div>
                <div class="card-title">Time</div>
                <div class="card-value">${escapeHTML(timeC)}</div>
            </div>
            <div class="glass-card card-space">
                <div class="card-icon">💾</div>
                <div class="card-title">Space</div>
                <div class="card-value">${escapeHTML(spaceC)}</div>
            </div>
        </div>
        <div class="divider"></div>
    `;
    div.innerHTML = cardsHTML;

    // 2. Accordion container
    const accordionContainer = document.createElement('div');
    accordionContainer.className = 'accordion-container w-full';

    const bruteFrag = buildSolutionAccordion(false, 'Brute Force', false, data.bruteForce);
    const optimalFrag = buildSolutionAccordion(true, 'Optimized Solution', true, data.optimal);

    if (bruteFrag) accordionContainer.appendChild(bruteFrag);
    if (optimalFrag) accordionContainer.appendChild(optimalFrag);

    div.appendChild(accordionContainer);
    history.appendChild(div);
    scrollToBottom();
}

/**
 * Build a solution accordion using DOM APIs.
 * Code is set via textContent — preserves all whitespace, prevents XSS.
 */
function buildSolutionAccordion(isOpen, title, isOptimal, sol) {
    if (!sol || !sol.code || sol.code === 'null') return null;

    const formattedCode = formatAICode(sol.code);

    // Icon SVG strings (safe static content)
    const iconSvg = isOptimal
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2ea043" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b949e" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';

    // Build details element
    const details = document.createElement('details');
    details.className = 'accordion';
    if (isOpen) details.open = true;

    // Summary
    const summary = document.createElement('summary');
    summary.innerHTML = `
        <div class="accordion-title">
            ${iconSvg}
            ${escapeHTML(title)}
        </div>
        <svg class="accordion-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
    `;
    details.appendChild(summary);

    // Accordion body
    const body = document.createElement('div');
    body.className = 'accordion-body';

    // Code wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'code-wrapper';

    // Code header
    const header = document.createElement('div');
    header.className = 'code-header';

    const langBadge = document.createElement('span');
    langBadge.className = 'lang-badge';
    langBadge.textContent = currentLanguage || 'Code';

    const actions = document.createElement('div');
    actions.className = 'code-actions';

    // Copy button (the only action button we need)
    const copyBtn = document.createElement('button');
    copyBtn.className = 'action-btn copy-btn';
    copyBtn.title = 'Copy Code';
    copyBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span class="copy-label">Copy</span>
    `;

    actions.appendChild(copyBtn);
    header.appendChild(langBadge);
    header.appendChild(actions);
    wrapper.appendChild(header);

    // Pre > Code — using textContent for safe, formatted output
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.textContent = formattedCode;
    pre.appendChild(code);
    wrapper.appendChild(pre);

    body.appendChild(wrapper);
    details.appendChild(body);

    return details;
}

// ── Event Delegation for Copy Buttons (works on dynamically injected elements) ──
function setupCopyDelegation() {
    const chatHistory = document.getElementById('chatHistory');
    chatHistory.addEventListener('click', (e) => {
        const copyBtn = e.target.closest('.copy-btn');
        if (!copyBtn) return;

        const wrapper = copyBtn.closest('.code-wrapper');
        if (!wrapper) return;

        const codeNode = wrapper.querySelector('code');
        if (!codeNode) return;

        const text = codeNode.textContent;
        const originalHTML = copyBtn.innerHTML;

        const showSuccess = () => {
            copyBtn.classList.add('copied');
            copyBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span class="copy-label">Copied ✓</span>
            `;
            setTimeout(() => {
                copyBtn.classList.remove('copied');
                copyBtn.innerHTML = originalHTML;
            }, 2000);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(showSuccess).catch(err => {
                console.error('Clipboard API failed:', err);
                fallbackCopyTextToClipboard(text, showSuccess);
            });
        } else {
            fallbackCopyTextToClipboard(text, showSuccess);
        }
    });
}

function fallbackCopyTextToClipboard(text, successCallback) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const ok = document.execCommand('copy');
        if (ok) successCallback();
    } catch (err) {
        console.error('Fallback copy failed:', err);
    }
    document.body.removeChild(textArea);
}

/**
 * Formats AI-generated code for display:
 * - Converts literal \n sequences to real newlines
 * - Normalizes line endings
 * - Trims leading/trailing blank lines
 * - Removes common leading whitespace (dedent)
 * - If code is still single-line, intelligently inserts line breaks
 */
function formatAICode(rawCode) {
    if (!rawCode || typeof rawCode !== 'string') return '';

    let code = rawCode;

    // Step 1: Convert literal \n and \t sequences to real characters
    // (AI responses often contain these as escaped two-char sequences)
    code = code.replace(/\\n/g, '\n');
    code = code.replace(/\\t/g, '\t');

    // Step 2: Normalize line endings
    code = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Step 3: If still a single line (no real newlines), try to intelligently break
    if (!code.includes('\n') || code.split('\n').filter(l => l.trim()).length <= 1) {
        code = smartFormatSingleLine(code);
    }

    // Step 4: Trim leading and trailing blank lines
    const lines = code.split('\n');

    let firstNonEmpty = 0;
    while (firstNonEmpty < lines.length && lines[firstNonEmpty].trim() === '') firstNonEmpty++;
    let lastNonEmpty = lines.length - 1;
    while (lastNonEmpty >= 0 && lines[lastNonEmpty].trim() === '') lastNonEmpty--;

    if (firstNonEmpty > lastNonEmpty) return code; // Return as-is if nothing found

    const trimmedLines = lines.slice(firstNonEmpty, lastNonEmpty + 1);

    // Step 5: Detect common leading whitespace (dedent)
    const nonEmptyLines = trimmedLines.filter(l => l.trim().length > 0);
    if (nonEmptyLines.length === 0) return code;

    const leadingSpaces = nonEmptyLines.map(l => {
        const match = l.match(/^(\s*)/);
        return match ? match[1].length : 0;
    });
    const minIndent = Math.min(...leadingSpaces);

    const dedentedLines = trimmedLines.map(l =>
        l.length >= minIndent ? l.slice(minIndent) : l
    );

    return dedentedLines.join('\n');
}

/**
 * Attempts to turn a single-line code string into properly indented multi-line code.
 * Handles C/C++/Java/JS style braces and semicolons.
 */
function smartFormatSingleLine(code) {
    let result = '';
    let indent = 0;
    const TAB = '    '; // 4 spaces

    for (let i = 0; i < code.length; i++) {
        const ch = code[i];
        const next = code[i + 1] || '';

        if (ch === '{') {
            result += ' {\n';
            indent++;
            result += TAB.repeat(indent);
            // Skip whitespace after brace
            while (i + 1 < code.length && code[i + 1] === ' ') i++;
        } else if (ch === '}') {
            indent = Math.max(0, indent - 1);
            result = result.trimEnd() + '\n' + TAB.repeat(indent) + '}';
            // Add newline after } unless followed by else/catch/etc
            const remaining = code.slice(i + 1).trimStart();
            if (remaining && !remaining.startsWith('else') && !remaining.startsWith('catch') &&
                !remaining.startsWith('while') && !remaining.startsWith(')') && !remaining.startsWith(';')) {
                result += '\n' + TAB.repeat(indent);
            }
        } else if (ch === ';') {
            result += ';\n';
            // Skip whitespace after semicolon
            while (i + 1 < code.length && code[i + 1] === ' ') i++;
            // Don't add indent if next char is }
            const nextNonSpace = code.slice(i + 1).trimStart()[0];
            if (nextNonSpace !== '}' && nextNonSpace !== undefined) {
                result += TAB.repeat(indent);
            }
        } else {
            result += ch;
        }
    }

    return result.trim();
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag]));
}

// ── Similar Questions ─────────────────────────────────────────────
let similarLoadedFor = null;

async function loadSimilarQuestions() {
    if (!currentProblem || !currentProblem.slug) {
        showEl(document.getElementById('similarEmpty'));
        return;
    }
    if (similarLoadedFor === currentProblem.slug) return;

    const loading = document.getElementById('similarLoading');
    const empty = document.getElementById('similarEmpty');
    const content = document.getElementById('similarContent');

    content.innerHTML = '';
    hideEl(empty);
    showEl(loading);

    try {
        const relRes = await bgMessage({ type: 'GET_RELATED', slug: currentProblem.slug });
        const data = relRes.data;

        let allP = [];
        if (data.similar_problems) {
            if (data.similar_problems.leetcode) allP.push(...data.similar_problems.leetcode.map(p => ({ ...p, plat: 'LeetCode' })));
            if (data.similar_problems.gfg) allP.push(...data.similar_problems.gfg.map(p => ({ ...p, plat: 'GFG' })));
            if (data.similar_problems.coding_ninjas) allP.push(...data.similar_problems.coding_ninjas.map(p => ({ ...p, plat: 'Coding Ninjas' })));
            if (data.similar_problems.codeforces) allP.push(...data.similar_problems.codeforces.map(p => ({ ...p, plat: 'Codeforces' })));
            if (data.similar_problems.cses) allP.push(...data.similar_problems.cses.map(p => ({ ...p, plat: 'CSES' })));
            if (data.similar_problems.interviewbit) allP.push(...data.similar_problems.interviewbit.map(p => ({ ...p, plat: 'InterviewBit' })));
        }

        // Add topic related as fallback if explicitly related is low
        if (allP.length < 5 && data.topic_related && data.topic_related.length > 0) {
            const addTarget = 5 - allP.length;
            const toAdd = data.topic_related.slice(0, addTarget).map(p => ({ ...p, plat: p.platform === 'leetcode' ? 'LeetCode' : p.platform.toUpperCase() }));
            allP.push(...toAdd);
        }

        hideEl(loading);

        if (allP.length === 0) {
            showEl(empty);
            return;
        }

        const html = allP.map(p => `
      <a href="${p.link}" target="_blank" class="card-similar group">
        <div class="flex justify-between items-center mb-1">
          <span class="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${p.plat === 'LeetCode' ? 'bg-warning bg-opacity-20 text-warning' :
                p.plat === 'GFG' ? 'bg-success bg-opacity-20 text-success' :
                    p.plat === 'Coding Ninjas' ? 'bg-[#F6821F] bg-opacity-20 text-[#F6821F]' :
                        p.plat === 'Codeforces' ? 'bg-[#ff4040] bg-opacity-20 text-[#ff4040]' :
                            p.plat === 'CSES' ? 'bg-primary border border-subtle text-primary' :
                                p.plat === 'InterviewBit' ? 'bg-[#56CCF2] bg-opacity-20 text-[#56CCF2]' :
                                    'bg-accent bg-opacity-10 text-accent'
            }">${p.plat}</span>
          <span class="text-[10px] font-semibold ${p.difficulty === 'Easy' ? 'text-easy' : p.difficulty === 'Medium' ? 'text-medium' : 'text-hard'}">${p.difficulty || '—'}</span>
        </div>
        <div class="font-medium text-sm text-primary group-hover:text-accent transition duration-200">${p.name}</div>
      </a>
    `).join('');

        content.innerHTML = html;
        similarLoadedFor = currentProblem.slug;

    } catch (err) {
        hideEl(loading);
        showEl(empty);
    }
}

// ── Profile Stats ─────────────────────────────────────────────────
let profileLoaded = false;

async function loadProfileStats() {
    if (profileLoaded) return;

    const loading = document.getElementById('statsLoading');
    const content = document.getElementById('statsContent');
    const fallback = document.getElementById('statsUsernameFallback');

    showEl(loading);
    hideEl(content);
    hideEl(fallback);

    try {
        const result = await chrome.storage.local.get(['leetcodeUsername']);
        let username = result.leetcodeUsername;

        // Retry fetching from page if not in storage
        if (!username && currentProblem) {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                const pData = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_DATA' });
                if (pData && pData.username) username = pData.username;
            } catch (e) { }
        }

        if (!username) {
            hideEl(loading);
            showEl(fallback);
            return;
        }

        const uLabel = document.getElementById('headerUsername');
        uLabel.textContent = username;
        showEl(uLabel, 'inline-flex');

        const profRes = await bgMessage({ type: 'GET_PROFILE', username });
        profileDataCache = profRes.data;

        const solved = profileDataCache.solved || { all: 0, easy: 0, medium: 0, hard: 0 };
        const total = Math.max(1, solved.all);

        const statTotalSvg = document.getElementById('statTotalSvg');
        if (statTotalSvg) statTotalSvg.textContent = solved.all || 0;

        const cntEasy = document.getElementById('cntEasy');
        if (cntEasy) cntEasy.textContent = `${solved.easy || 0}`;
        const cntMed = document.getElementById('cntMed');
        if (cntMed) cntMed.textContent = `${solved.medium || 0}`;
        const cntHard = document.getElementById('cntHard');
        if (cntHard) cntHard.textContent = `${solved.hard || 0}`;

        // Ring Math (circumference = 282.74)
        const C = 282.74;
        const eLen = ((solved.easy || 0) / total) * C;
        const mLen = ((solved.medium || 0) / total) * C;
        const hLen = ((solved.hard || 0) / total) * C;

        const rE = document.getElementById('ringEasy');
        const rM = document.getElementById('ringMed');
        const rH = document.getElementById('ringHard');

        if (rE && rM && rH) {
            rE.style.strokeDasharray = `${eLen} ${C}`;
            rE.style.strokeDashoffset = `0`;

            rM.style.strokeDasharray = `${mLen} ${C}`;
            rM.style.strokeDashoffset = `-${eLen}`;

            rH.style.strokeDasharray = `${hLen} ${C}`;
            rH.style.strokeDashoffset = `-${eLen + mLen}`;
        }

        const statRating2 = document.getElementById('statRating2');
        const statGlobalRanking = document.getElementById('statGlobalRanking');

        if (profileDataCache.contest && profileDataCache.contest.current && statRating2) {
            statRating2.textContent = Math.round(profileDataCache.contest.current.rating || 0);
            statGlobalRanking.textContent = `Top ${profileDataCache.contest.current.topPercentage || '--'}%`;
        } else if (statRating2) {
            statRating2.textContent = 'N/A';
            statGlobalRanking.textContent = 'Unrated';
        }

        // Calendar / Heatmap Logic
        const cal = profileDataCache.calendar || {};
        const activeDaysEl = document.getElementById('statActiveDays');
        if (activeDaysEl) activeDaysEl.textContent = cal.totalActiveDays || 0;

        const streakEl = document.getElementById('statStreakExact');
        if (streakEl) streakEl.textContent = cal.streak || 0;

        let totalSubs = 0;
        const heatGrid = document.getElementById('calendarHeatmap');
        if (heatGrid && cal.submissionCalendar) {
            try {
                const subCal = JSON.parse(cal.submissionCalendar) || {};
                const timestamps = Object.keys(subCal).sort((a, b) => a - b);

                totalSubs = Object.values(subCal).reduce((acc, v) => acc + v, 0);
                const statTotalSubs = document.getElementById('statTotalSubs');
                if (statTotalSubs) statTotalSubs.textContent = totalSubs;

                heatGrid.innerHTML = '';
                // 52 columns
                const nowSecs = Math.floor(Date.now() / 1000);
                const daySecs = 86400;

                for (let c = 0; c < 52; c++) {
                    const colDiv = document.createElement('div');
                    colDiv.className = 'heatmap-col';
                    for (let r = 0; r < 7; r++) {
                        const cell = document.createElement('div');
                        cell.className = 'heatmap-cell';
                        // approximate day lookup (going backwards)
                        const daysAgo = (51 - c) * 7 + (6 - r);
                        const targetTs = nowSecs - (daysAgo * daySecs);

                        let count = 0;
                        for (let t of timestamps) {
                            if (Math.abs(t - targetTs) < daySecs) {
                                count += subCal[t];
                            }
                        }

                        let level = 0;
                        if (count === 1) level = 1;
                        else if (count > 1 && count <= 3) level = 2;
                        else if (count > 3 && count <= 6) level = 3;
                        else if (count > 6) level = 4;

                        cell.setAttribute('data-level', level);
                        cell.title = `${count} submissions on ${new Date(targetTs * 1000).toLocaleDateString()}`;
                        colDiv.appendChild(cell);
                    }
                    heatGrid.appendChild(colDiv);
                }
            } catch (e) { console.error('Heatmap error', e); }
        }

        // Topic Bubbles
        const tContainer = document.getElementById('topicBubbles');
        if (tContainer && profileDataCache.topicStats) {
            tContainer.innerHTML = '';
            // Get top 15 topics
            const topTopics = profileDataCache.topicStats.slice(0, 15);
            if (topTopics.length > 0) {
                const maxCount = topTopics[0].solved || 1;
                topTopics.forEach(t => {
                    const bubble = document.createElement('div');
                    bubble.className = 'topic-bubble';
                    bubble.textContent = t.name;
                    // Scale sizes smoothly based on solved ratio
                    const ratio = Math.max(0.4, t.solved / maxCount);
                    const size = 35 + (ratio * 45); // e.g. 35px to 80px
                    bubble.style.width = `${size}px`;
                    bubble.style.height = `${size}px`;
                    bubble.style.fontSize = `${9 + (ratio * 5)}px`; // 9px to 14px text

                    tContainer.appendChild(bubble);
                });
            }
        }

        const statAcc = document.getElementById('statAcceptance');
        if (statAcc) statAcc.textContent = profileDataCache.acceptanceRate || '--%';

        hideEl(loading);
        showEl(content, 'flex');
        profileLoaded = true;

        const genBtn = document.getElementById('genRoadmapBtn');
        if (genBtn) genBtn.addEventListener('click', generateFeedback);

    } catch (err) {
        hideEl(loading);
        showEl(fallback); // Ask manual input on fail
    }
}

async function generateFeedback() {
    const btn = document.getElementById('genRoadmapBtn');
    const tip = document.getElementById('statRoadmap');
    if (!btn || !tip) return;

    btn.textContent = 'Generating...';
    btn.disabled = true;

    try {
        const result = await chrome.storage.local.get(['leetcodeUsername']);

        const predRes = await bgMessage({
            type: 'CALL_PREDICT',
            payload: {
                username: result.leetcodeUsername,
                profileData: profileDataCache,
                topicStats: profileDataCache.topicStats || [],
                contestData: profileDataCache.contest
            }
        });
        const data = predRes.data;

        tip.textContent = data.insight || 'Keep practicing consistently to improve your rating!';
        hideEl(btn);

    } catch (err) {
        tip.textContent = 'Failed to generate insight.';
        btn.textContent = 'Try Again';
        btn.disabled = false;
    }
}
