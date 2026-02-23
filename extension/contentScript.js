/**
 * Content Script — LeetCode Page Detection & DOM Extraction
 * 
 * Runs on leetcode.com/problems/* pages.
 * Extracts problem info, user code, and username.
 * Listens for requests from the Side Panel to supply data.
 */

// ── State ──────────────────────────────────────────────────
let extractionTimer = null;
let currentProblem = {
  name: '',
  slug: '',
  difficulty: '',
  code: '',
  language: '',
  username: '',
};

// ── Initialization ─────────────────────────────────────────
function init() {
  if (!isLeetCodeProblemPage()) return;

  // Debounced extraction: wait for page to fully render
  clearTimeout(extractionTimer);
  extractionTimer = setTimeout(() => {
    extractProblemData();
  }, 1500);
}

/**
 * Check if current page is a LeetCode problem page
 */
function isLeetCodeProblemPage() {
  return window.location.pathname.match(/^\/problems\/[^/]+/);
}

/**
 * Extract problem slug from URL
 */
function getProblemSlug() {
  const match = window.location.pathname.match(/\/problems\/([^/]+)/);
  return match ? match[1] : '';
}

// ── DOM Extraction ─────────────────────────────────────────

/**
 * Extract all problem data from the page DOM (Async version for code injection)
 */
async function extractProblemDataAsync() {
  currentProblem.slug = getProblemSlug();
  currentProblem.name = extractProblemName();
  currentProblem.difficulty = extractDifficulty();
  currentProblem.code = await extractCode();
  currentProblem.language = extractLanguage();
  currentProblem.username = extractUsername();

  // Store in extension storage for popup/navigator use
  chrome.runtime.sendMessage({
    type: 'STORE_PROBLEM',
    problem: {
      name: currentProblem.name,
      slug: currentProblem.slug,
      difficulty: currentProblem.difficulty,
    }
  }).catch(() => { });

  // Store username
  if (currentProblem.username) {
    chrome.runtime.sendMessage({
      type: 'STORE_USERNAME',
      username: currentProblem.username,
    }).catch(() => { });
  }

  console.log('🧠 LeetCode AI Coach — Problem extracted:', currentProblem.name);
}

/**
 * Extract all problem data from the page DOM (Legacy Sync wrapper)
 */
function extractProblemData() {
  extractProblemDataAsync();
}

/**
 * Extract problem name from page
 */
function extractProblemName() {
  const selectors = [
    '[data-cy="question-title"]',
    '.text-title-large a',
    'div[class*="title"] a',
    'h4[class*="title"]',
    'div.flex-1 span.mr-2',
    'a[class*="mr-2"]',
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.textContent.trim()) {
      return el.textContent.trim();
    }
  }

  return currentProblem.slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Extract problem difficulty
 */
function extractDifficulty() {
  const selectors = [
    'div[class*="text-difficulty-easy"]',
    'div[class*="text-difficulty-medium"]',
    'div[class*="text-difficulty-hard"]',
    'div[class*="text-olive"]',
    'div[class*="text-yellow"]',
    'div[class*="text-pink"]',
    'span[class*="text-olive"]',
    'span[class*="text-yellow"]',
    'span[class*="text-pink"]',
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const text = el.textContent.trim().toLowerCase();
      if (text.includes('easy')) return 'Easy';
      if (text.includes('medium')) return 'Medium';
      if (text.includes('hard')) return 'Hard';
    }
  }

  const diffEl = document.querySelector('div[diff]');
  if (diffEl) return diffEl.getAttribute('diff');

  return 'Unknown';
}

/**
 * Extract user's code from the editor using DOM-only strategies.
 * NO inline script injection — avoids CSP violations entirely.
 */
async function extractCode() {
  // Strategy 1: DOM scraping — Monaco .view-line elements
  try {
    const lines = document.querySelectorAll('.view-line');
    if (lines.length > 0) {
      const lineArray = Array.from(lines).map(line => {
        const top = parseInt(line.style.top, 10) || 0;
        return { text: line.textContent, top };
      });
      lineArray.sort((a, b) => a.top - b.top);
      const code = lineArray.map(l => l.text).join('\n');
      if (code.trim()) return code;
    }
  } catch (e) { }

  // Strategy 2: CodeMirror line elements
  try {
    const cmLines = document.querySelectorAll('.CodeMirror-line');
    if (cmLines.length > 0) {
      const code = Array.from(cmLines).map(line => line.textContent).join('\n');
      if (code.trim()) return code;
    }
  } catch (e) { }

  // Strategy 3: Textarea fallback
  try {
    const textarea = document.querySelector('textarea[name="code"]');
    if (textarea && textarea.value.trim()) return textarea.value;
  } catch (e) { }

  // Strategy 4: CodeMirror instance
  try {
    const cm = document.querySelector('.CodeMirror');
    if (cm && cm.CodeMirror) return cm.CodeMirror.getValue();
  } catch (e) { }

  // Strategy 5: React Fiber traversal (content script CAN access DOM properties)
  try {
    const editorNode = document.querySelector('.monaco-editor');
    if (editorNode) {
      const reactKey = Object.keys(editorNode).find(key => key.startsWith('__reactFiber$'));
      if (reactKey) {
        let node = editorNode[reactKey];
        let depth = 0;
        while (node && depth < 50) {
          if (node.memoizedProps && typeof node.memoizedProps.value === 'string' && node.memoizedProps.value.trim()) {
            return node.memoizedProps.value;
          }
          node = node.return;
          depth++;
        }
      }
    }
  } catch (e) { }

  // Strategy 6: localStorage scrape
  try {
    const slug = getProblemSlug();
    if (slug) {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes(slug)) {
          if (key.includes('_code') || key === `${slug}_1`) {
            const val = localStorage.getItem(key);
            if (val && val.trim()) return val;
          }
          if (key.includes('editor')) {
            try {
              const data = JSON.parse(localStorage.getItem(key));
              if (data && data.code) return data.code;
            } catch (e2) { }
          }
        }
      }
    }
  } catch (e) { }

  return '';
}

/**
 * Extract currently selected language
 */
function extractLanguage() {
  const selectors = [
    'button[id*="headlessui-listbox-button"]',
    'button[class*="rounded items-center"]',
    '[data-cy="lang-select"]',
    '.ant-select-selection-item'
  ];

  for (const sel of selectors) {
    const els = document.querySelectorAll(sel);
    for (const el of els) {
      const text = el.textContent.trim().toLowerCase();
      if (['python', 'python3', 'java', 'javascript', 'typescript', 'c++', 'c', 'go', 'rust', 'kotlin', 'swift', 'ruby', 'scala', 'c#', 'php'].some(lang => text.includes(lang))) {
        return text;
      }
    }
  }
  return 'unknown';
}

/**
 * Extract logged-in username
 */
function extractUsername() {
  const selectors = [
    'a[href*="/u/"] span',
    'a[class*="navbar"] img[alt]',
    '#navbar_user_avatar',
    'img[class*="avatar"]',
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const link = el.closest('a');
      if (link && link.href) {
        const match = link.href.match(/\/u\/([^/]+)/);
        if (match) return match[1];
      }
      if (el.alt) return el.alt;
      if (el.textContent.trim()) return el.textContent.trim();
    }
  }

  try {
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const match = script.textContent.match(/"username"\s*:\s*"([^"]+)"/);
      if (match) return match[1];
    }
  } catch (e) { }

  return '';
}

// ── Observers & Lifecycle ──────────────────────────────────

// Watch for SPA navigation
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    init();
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Listen for messages from background/side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PAGE_LOADED') {
    init();
    sendResponse({ ok: true });
  }

  // Side panel asks for data (Async handling required)
  if (message.type === 'GET_PAGE_DATA') {
    (async () => {
      try {
        await extractProblemDataAsync();
      } catch (e) { }

      sendResponse({
        problem: {
          name: currentProblem.name,
          slug: currentProblem.slug,
          difficulty: currentProblem.difficulty
        },
        code: currentProblem.code,
        language: currentProblem.language,
        username: currentProblem.username
      });
    })();
    return true; // Keep message channel open for async response
  }
});

// Initial run
init();
