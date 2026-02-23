/**
 * LeetCode AI Coach — Backend Server
 * 
 * Express.js server that proxies AI calls, LeetCode GraphQL,
 * and serves the problem dataset for the Chrome extension.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const analyzeRoutes = require('./routes/analyze');
const profileRoutes = require('./routes/profile');
const topicsRoutes = require('./routes/topics');
const relatedRoutes = require('./routes/related');
const predictRoutes = require('./routes/predict');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin: true,                    // Allow all origins (content scripts run on leetcode.com's origin)
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '1mb' }));

// ── Health Check ───────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    ai_provider: process.env.AI_PROVIDER || 'gemini',
    timestamp: new Date().toISOString()
  });
});

// ── Routes ─────────────────────────────────────────────────
app.use('/api/analyze', analyzeRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/topics', topicsRoutes);
app.use('/api/related', relatedRoutes);
app.use('/api/predict', predictRoutes);

// ── Global Error Handler ───────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.message);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ── Start ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 LeetCode AI Coach Backend`);
  console.log(`   Port:        ${PORT}`);
  console.log(`   AI Provider: ${process.env.AI_PROVIDER || 'gemini'}`);
  console.log(`   Health:      http://localhost:${PORT}/api/health\n`);
});
