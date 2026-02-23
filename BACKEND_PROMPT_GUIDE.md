# Backend Prompt Structure & AI Integration Guide

## 🎯 Overview

This document explains the exact prompt structure used to communicate with the AI backend and how to get the best results.

---

## 📨 Backend API Prompt

### Complete Prompt Sent to AI

When you submit code through the UI, this is the exact prompt sent to the AI:

```
You are a DSA engine that returns data ONLY in the required JSON format.

INPUT:
- Problem: {problemName} (Difficulty: {difficulty})
- Language: {language}
- User code:
\`\`\`
{userCode}
\`\`\`

GOAL:
Generate only:
1) Brute force solution code
2) Optimal solution code
3) Time & Space complexity of the USER'S code

STRICT RULES:
- Do NOT return explanations
- Do NOT return intuition
- Do NOT return approach text
- Do NOT return optimality reasoning
- Output must be pure JSON ONLY
- Do NOT wrap JSON in markdown block like \`\`\`json
- Code must be in the same language as the user's code
- Code must be clean and copy-paste ready

BLANK CODE CASE:
If the user code is empty or only comments:
- timeComplexity = "N/A"
- spaceComplexity = "N/A"

OUTPUT FORMAT (FOLLOW EXACTLY):
{
  "bruteForce": {
    "code": "FULL CODE HERE"
  },
  "optimal": {
    "code": "FULL CODE HERE"
  },
  "complexity": {
    "time": "TIME COMPLEXITY OF USER CODE",
    "space": "SPACE COMPLEXITY OF USER CODE"
  }
}
```

---

## 🔄 Request/Response Flow

### Step 1: User Submits Code

**Frontend sends POST request:**
```
URL: http://localhost:3000/api/analyze
Method: POST
Header: Content-Type: application/json

Body: {
  "code": "user's solution code",
  "language": "javascript",
  "problemName": "Two Sum",
  "difficulty": "Easy"
}
```

### Step 2: Backend Constructs Prompt

**Backend builds the full prompt from template above**

### Step 3: AI Processes Request

**AI receives prompt and must return exactly this JSON:**
```json
{
  "bruteForce": {
    "code": "complete brute force solution code"
  },
  "optimal": {
    "code": "complete optimized solution code"
  },
  "complexity": {
    "time": "O(n²) for brute force, O(n) for optimal",
    "space": "O(1) for brute force, O(n) for optimal"
  }
}
```

### Step 4: Backend Parses Response

**Parse JSON and cache the result**

### Step 5: Frontend Displays Results

**Render in UI with proper formatting and styling**

---

## 💡 Prompt Engineering Best Practices

### What Works Well ✅

```javascript
// Example 1: Simple clear code
function twoSum(nums, target) {
    const map = new Map();
    for (let i = 0; i < nums.length; i++) {
        if (map.has(target - nums[i])) {
            return [map.get(target - nums[i]), i];
        }
        map.set(nums[i], i);
    }
    return [];
}

// Result: Gets optimal solution immediately
```

```python
# Example 2: Incomplete solution
def search(arr, target):
    # TODO: implement binary search
    pass

# Result: Generates full solution for binary search
```

### What Doesn't Work Well ❌

```javascript
// Problem 1: Too vague
function solve(x) {
    return x;
}

// Result: Cannot determine problem, may fail
```

```python
# Problem 2: Only comments
# implement merge sort
# handle edge cases
# sort the array

# Result: Gets N/A complexity, generic solution
```

---

## 🎯 Real-World Examples

### Example 1: Two Sum (JavaScript)

**Input Code:**
```javascript
function twoSum(nums, target) {
    for (let i = 0; i < nums.length; i++) {
        for (let j = i + 1; j < nums.length; j++) {
            if (nums[i] + nums[j] === target) {
                return [i, j];
            }
        }
    }
    return [];
}
```

**AI Prompt Generated:**
```
You are a DSA engine...
Problem: Two Sum (Easy)
Language: javascript
User code:
function twoSum(nums, target) {
    for (let i = 0; i < nums.length; i++) {
        for (let j = i + 1; j < nums.length; j++) {
            if (nums[i] + nums[j] === target) {
                return [i, j];
            }
        }
    }
    return [];
}
```

**Expected Response:**
```json
{
  "bruteForce": {
    "code": "function twoSum(nums, target) {\n    for (let i = 0; i < nums.length; i++) {\n        for (let j = i + 1; j < nums.length; j++) {\n            if (nums[i] + nums[j] === target) {\n                return [i, j];\n            }\n        }\n    }\n    return [];\n}"
  },
  "optimal": {
    "code": "function twoSum(nums, target) {\n    const map = new Map();\n    for (let i = 0; i < nums.length; i++) {\n        const complement = target - nums[i];\n        if (map.has(complement)) {\n            return [map.get(complement), i];\n        }\n        map.set(nums[i], i);\n    }\n    return [];\n}"
  },
  "complexity": {
    "time": "O(n²) brute force → O(n) optimal",
    "space": "O(1) brute force → O(n) optimal"
  }
}
```

---

### Example 2: Merge Arrays (Python)

**Input Code:**
```python
def merge(nums1, m, nums2, n):
    for i in range(n):
        nums1[m + i] = nums2[i]
    nums1.sort()
```

**AI Prompt Generated:**
```
You are a DSA engine...
Problem: Merge Arrays
Language: python
User code:
def merge(nums1, m, nums2, n):
    for i in range(n):
        nums1[m + i] = nums2[i]
    nums1.sort()
```

**Expected Response:**
```json
{
  "bruteForce": {
    "code": "def merge(nums1, m, nums2, n):\n    for i in range(n):\n        nums1[m + i] = nums2[i]\n    nums1.sort()"
  },
  "optimal": {
    "code": "def merge(nums1, m, nums2, n):\n    p1, p2, p = m - 1, n - 1, m + n - 1\n    while p1 >= 0 and p2 >= 0:\n        if nums1[p1] > nums2[p2]:\n            nums1[p] = nums1[p1]\n            p1 -= 1\n        else:\n            nums1[p] = nums2[p2]\n            p2 -= 1\n        p -= 1\n    while p2 >= 0:\n        nums1[p] = nums2[p2]\n        p2 -= 1\n        p -= 1"
  },
  "complexity": {
    "time": "O((m+n) log(m+n)) brute → O(m+n) optimal",
    "space": "O(1) for both"
  }
}
```

---

## 🔧 Backend Implementation

### File: `backend/routes/analyze.js`

```javascript
const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');

router.post('/', async (req, res) => {
  try {
    const { code, language, problemName, difficulty } = req.body;

    // Validate input
    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'Code is required' });
    }

    // Build prompt
    const prompt = `You are a DSA engine that returns data ONLY in the required JSON format.

INPUT:
- Problem: ${problemName || 'Unknown'} (Difficulty: ${difficulty || 'Unknown'})
- Language: ${language || 'Unknown'}
- User code:
\`\`\`
${code}
\`\`\`

GOAL:
Generate only:
1) Brute force solution code
2) Optimal solution code
3) Time & Space complexity of the USER'S code

STRICT RULES:
- Do NOT return explanations
- Output must be pure JSON ONLY
- Do NOT wrap JSON in markdown block
- Code must be in the same language as the user's code

OUTPUT FORMAT (FOLLOW EXACTLY):
{
  "bruteForce": {
    "code": "FULL CODE HERE"
  },
  "optimal": {
    "code": "FULL CODE HERE"
  },
  "complexity": {
    "time": "TIME COMPLEXITY",
    "space": "SPACE COMPLEXITY"
  }
}`;

    // Call AI service
    const response = await aiService.generate(prompt);
    
    // Parse response
    const parsed = aiService.parseJSON(response);

    res.json(parsed);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ 
      error: 'Analysis failed', 
      message: error.message 
    });
  }
});

module.exports = router;
```

---

## 🎓 AI Service Integration

### Supported Providers

The system supports multiple AI providers:

1. **Groq** (Recommended - Fastest)
   - Provider: Groq Cloud
   - Model: llama-3.3-70b-versatile
   - Speed: Very Fast (<1s)
   - Cost: Free/Cheap

2. **OpenAI** (Most Reliable)
   - Provider: OpenAI
   - Model: gpt-4o-mini
   - Speed: Moderate (2-3s)
   - Cost: Low

3. **Google Gemini** (Alternative)
   - Provider: Google AI
   - Model: gemini-2.0-flash-lite
   - Speed: Fast (1-2s)
   - Cost: Free

### Set Provider in `.env`

```env
AI_PROVIDER=groq
GROQ_API_KEY=your_groq_key
# OR
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_key
# OR
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_key
```

---

## 📊 Expected Quality Metrics

### Code Quality
```
✅ 95%+ syntactically correct code
✅ Follows language conventions
✅ Includes proper variable names
✅ Clean and readable format
✅ Copy-paste ready
```

### Solution Accuracy
```
✅ Brute force correctly inefficient
✅ Optimal solution factually superior
✅ Time complexity matches actual algorithm
✅ Space complexity accurate
✅ Both approaches solve the problem
```

### Response Time
```
Groq:    500ms - 1s
Gemini:  1s - 2s
OpenAI:  2s - 5s (depending on load)
```

---

## ⚠️ Error Handling

### What Backend Returns on Error

```json
{
  "error": "Analysis failed",
  "message": "Detailed error message"
}
```

### Common Errors

1. **Invalid JSON Response**
   - AI returned non-JSON text
   - Solution: Fallback to generic response

2. **Timeout**
   - AI took too long
   - Solution: Return cached result if available

3. **Empty Code**
   - User submitted blank code
   - Solution: Return `{ "complexity": { "time": "N/A", "space": "N/A" } }`

4. **Unsupported Language**
   - Language not in supported list
   - Solution: Try anyway, AI usually handles it

---

## 🔒 Security Considerations

### Input Sanitization
```javascript
// Always sanitize before sending to AI
const sanitizedCode = code
  .trim()
  .substring(0, 10000); // Limit size
```

### Response Validation
```javascript
// Validate response structure
if (!response.bruteForce || !response.optimal) {
  throw new Error('Invalid response structure');
}
```

### Rate Limiting
```javascript
// Prevent abuse
const cache = new Map();
const cacheKey = `${hash(code)}_${language}`;
if (cache.has(cacheKey)) {
  return cache.get(cacheKey);
}
```

---

## 📈 Performance Tips

### Caching Strategy
```javascript
// Cache results to avoid redundant API calls
const aiCache = new Map();
const cacheKey = createHash(code, language);

if (aiCache.has(cacheKey)) {
  return aiCache.get(cacheKey); // Instant response
}

// If not cached, call AI
const result = await aiService.generate(prompt);
aiCache.set(cacheKey, result); // Store for future use
return result;
```

### Optimal Configuration
```javascript
const config = {
  maxTokens: 2000,        // Sufficient for most solutions
  temperature: 0.3,        // Lower = more consistent
  timeout: 30000,          // 30 second timeout
  retries: 2,              // Retry failed requests
  cacheTTL: 3600000        // Cache for 1 hour
};
```

---

## 🎯 Debugging Tips

### Enable Logging
```javascript
// In aiService.js
console.log('🔍 Prompt:', prompt.substring(0, 100) + '...');
console.log('📨 Response:', response.substring(0, 100) + '...');
console.log('✅ Parsed:', JSON.stringify(parsed, null, 2));
```

### Test with curl
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "code": "function test() { return 1; }",
    "language": "javascript",
    "problemName": "Test",
    "difficulty": "Easy"
  }'
```

### Check API Response Format
```javascript
// Ensure valid JSON
try {
  JSON.parse(response);
  console.log('✅ Valid JSON');
} catch {
  console.log('❌ Invalid JSON');
}
```

---

## 📋 Checklist for Implementation

- [ ] Backend server running on port 3000
- [ ] AI provider configured (Groq/OpenAI/Gemini)
- [ ] API key set in `.env` file
- [ ] `/api/analyze` endpoint working
- [ ] Request validation implemented
- [ ] Response caching enabled
- [ ] Error handling in place
- [ ] Logging configured
- [ ] Frontend connected to backend URL
- [ ] Copy button working
- [ ] Results displaying correctly

---

## 🚀 Deployment Checklist

- [ ] Test with multiple languages
- [ ] Test with edge cases (empty code, huge code)
- [ ] Monitor API rate limits
- [ ] Set up error alerts
- [ ] Configure cache strategy
- [ ] Add request throttling
- [ ] Implement user authentication (optional)
- [ ] Set up analytics tracking
- [ ] Document API for users
- [ ] Prepare support guidelines

---

## ✅ Success Criteria

Your implementation is successful when:

1. ✅ Code submits successfully
2. ✅ Backend generates solutions in <5 seconds
3. ✅ UI displays brute force solution
4. ✅ UI displays optimized solution
5. ✅ Complexity analysis is accurate
6. ✅ Copy button works without errors
7. ✅ Expand/collapse works smoothly
8. ✅ Error messages are helpful
9. ✅ No console errors in DevTools
10. ✅ Works across multiple browsers

---

## 🎉 Conclusion

With this prompt structure and backend implementation, your LeetCode Extension will:
- Analyze user code accurately
- Generate multiple solution approaches
- Provide complexity analysis
- Deliver results quickly
- Handle errors gracefully
- Provide excellent user experience

You're now ready to integrate and deploy! 🚀
