# LeetCode AI Coach Extension 🚀

An AI-powered Chrome Extension that acts as your personal coding assistant right inside the LeetCode side panel. Analyzes your code, suggests Brute Force and Optimized solutions, shows Time/Space complexity, and finds similar problems on LeetCode, GFG, Coding Ninjas, Codeforces, and more.

**No server needed** — runs entirely in your browser with your own free Gemini API key.

---

## Features 🌟
- **AI Code Analysis** — Instant feedback powered by Google Gemini
- **GFG-Style Code Blocks** — Dark theme, syntax indentation, 1-click copy
- **Complexity Cards** — Time & Space complexity at a glance
- **Similar Problems** — Cross-platform: LeetCode, GFG, Coding Ninjas, Codeforces
- **Profile Stats** — Your LeetCode progress, heatmap, and contest rating
- **AI Improvement Roadmap** — Personalized study plan based on your profile
- **100% Free** — No backend server, no subscriptions

---

## Quick Start (3 Steps) ⚡

### Step 1: Get Your Free Gemini API Key
1. Go to **[Google AI Studio](https://aistudio.google.com/app/apikey)**
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the generated key (starts with `AIza...`)

### Step 2: Install the Extension
1. Download or clone this repo
2. Open Chrome → go to `chrome://extensions`
3. Turn on **Developer mode** (toggle in top right)
4. Click **"Load unpacked"** → select the `extension/` folder

### Step 3: Paste Your API Key
1. Click the extension icon → the side panel will open
2. A **settings dialog** will appear automatically on first launch
3. Paste your Gemini API key → click **Save Key**
4. Done! Navigate to any LeetCode problem and start coding 🎉

---

## How to Use 📖

### Analyze Tab
1. Open any LeetCode problem page
2. Write or paste your solution code
3. Open the side panel (click the extension icon)
4. Click **"Analyze Latest Code"**
5. AI will return:
   - ✅ Brute Force solution
   - ⚡ Optimized solution
   - 📊 Time & Space complexity of YOUR code

### Similar Tab
- Click the **"Similar"** tab to see related problems across platforms
- Problems are pulled from a built-in dataset of 46 curated questions

### Stats Tab
- Enter your LeetCode username to see:
  - Solved count (Easy / Medium / Hard)
  - Contest rating & ranking
  - Topic mastery breakdown
  - AI-generated improvement roadmap

---

## Changing Your API Key 🔑
Click the **⚙️ gear icon** in the top-right corner of the side panel at any time to update or change your API key.

---

## Project Structure 📁
```
extension/              ← Chrome Extension (load this folder)
├── background.js       ← Message hub (routes AI & data calls)
├── contentScript.js    ← Reads code from LeetCode pages
├── manifest.json       ← Extension config
├── services/
│   ├── geminiService.js    ← Direct Gemini API calls
│   ├── leetcodeService.js  ← LeetCode GraphQL queries
│   └── datasetService.js   ← Local problem dataset
├── data/
│   └── problems.json       ← 46 curated problems with cross-platform links
└── sidepanel/
    ├── index.html      ← UI layout
    ├── sidepanel.css    ← Styling
    └── sidepanel.js     ← UI logic

backend/                ← (Legacy) Not needed anymore
```

---

### Important Notes
- **Free Tier**: The Gemini API free tier allows generous usage. You will NOT be charged.
- **Privacy**: Your API key is stored locally in Chrome storage. It is NEVER sent anywhere except Google's Gemini API.
- **No Server Needed**: The entire extension runs in your browser. No backend, no hosting, no cost.

---

<p align="center"><b>Made by ADITYA with 🧠</b></p>
