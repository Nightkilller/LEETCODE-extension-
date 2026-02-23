# LeetCode AI Coach Extension 🚀

An AI-powered Chrome Extension that acts as your personal coding assistant right inside the LeetCode side panel. It analyzes your code, suggests Brute Force and Optimized solutions, provides Time/Space complexity, and finds similar problems across multiple platforms (LeetCode, GFG, Coding Ninjas, etc.).

## Features 🌟
- **AI Code Analysis**: Get instant feedback on your code using Google Gemini.
- **GFG Style Code Blocks**: Beautiful, easy-to-read dark mode code snippets with 1-click copy.
- **Complexity Breakdown**: See Time and Space complexity at a glance.
- **Similar Problems**: Automatically finds related questions on other platforms.
- **Profile Stats**: Visualizes your LeetCode progress and heatmaps natively.
- **Smart Formatting**: Handles edge-case AI outputs to ensure code always looks perfect.

## Project Structure 📁
This project has two main parts:
1. `extension/` - The frontend Chrome Extension (HTML/CSS/JS).
2. `backend/` - The Node.js/Express server that talks to the Gemini API.

---

## 1. Hosting the Backend (Render.com) ☁️

To use this extension anywhere, the backend needs to be hosted online. We recommend **Render.com** (it's free!).

### Deployment Steps:
1. Ensure this entire project is pushed to your GitHub repository.
2. Go to [Render.com](https://render.com) and sign in with GitHub.
3. Click **New** -> **Web Service**.
4. Connect the repository you just created.
5. Provide the following settings:
   - **Name**: `leetcode-ai-coach-backend` (or whatever you prefer)
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
6. Scroll down to **Environment Variables** and add:
   - Key: `GEMINI_API_KEY` | Value: *(Your actual Gemini API Key)*
   - Key: `NODE_ENV` | Value: `production`
7. Click **Create Web Service**.
8. Once deployed, Render will give you a URL (e.g., `https://your-app.onrender.com`). **Copy this URL**.

---

## 2. Setting Up the Extension (Frontend) 🧩

Once your backend is live, you must tell your extension where to find it.

### Step-by-step:
1. Open the `extension/sidepanel/sidepanel.js` file.
2. At the very top (Line 7), change the `API_BASE` variable to your new Render URL:
   ```javascript
   // Change this:
   const API_BASE = 'http://localhost:3000/api';
   
   // To this:
   const API_BASE = 'https://your-app.onrender.com/api';
   ```
3. Open `extension/manifest.json`.
4. Update the `host_permissions` array (Line 15) to include your Render domain:
   ```json
   "host_permissions": [
       "https://leetcode.com/*",
       "https://your-app.onrender.com/*"
   ]
   ```

### Installing in Chrome:
1. Open Google Chrome and navigate to `chrome://extensions`.
2. Turn on **Developer mode** (toggle in the top right corner).
3. Click **Load unpacked** in the top left.
4. Select the `extension/` folder from this project.
5. Go to any LeetCode problem, open the Chrome Side Panel (via the browser toolbar or extension icon), and start coding!

---

## Local Development 🛠️
If you want to run the backend locally instead of on Render:
1. Open a terminal in the `backend/` directory.
2. Run `npm install`.
3. Create a `.env` file inside `backend/` and add your key: `GEMINI_API_KEY=your_key_here`.
4. Run `node server.js`.
5. Ensure the extension is pointing to `http://localhost:3000/api` as explained above.

---

### Important Notes
- **Free Hosting Limits**: Render's free tier spins down the server after 15 minutes of inactivity. When you use the extension for the first time in a while, it might take 30-50 seconds for the backend to "wake up".
- **Security**: **NEVER** commit your `.env` file or hardcode your API keys into the frontend `extension/` code. The `.gitignore` is already set up to protect your `.env` file.

---

<p align="center"><b>Made by ADITYA with 🧠</b></p>
