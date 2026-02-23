# Quick Reference Guide - LeetCode Extension

## 🎯 One-Minute Overview

**What?** A code analysis tool that automatically generates brute force and optimized solutions for any coding problem.

**How?** Submit your code → Get two solutions + complexity analysis → Copy code instantly.

---

## 📝 Proper Prompt for Backend

When you submit code for analysis, the system automatically sends this prompt to the AI:

```
You are a DSA (Data Structures & Algorithms) engine.
Return ONLY valid JSON with no explanations.

Input:
- Problem: {problem_name}
- Language: {programming_language}
- User Code: {submitted_code}

Output Requirements:
1. Brute force solution (inefficient but simple approach)
2. Optimal solution (most efficient approach)
3. Time & Space complexity

Response Format (MUST FOLLOW EXACTLY):
{
  "bruteForce": {
    "code": "complete working code"
  },
  "optimal": {
    "code": "complete working code"
  },
  "complexity": {
    "time": "O(notation)",
    "space": "O(notation)"
  }
}

Rules:
✓ Return valid JSON only
✓ No markdown code blocks
✓ Code must work independently
✓ Match the user's programming language
✓ No explanations or comments outside code
✗ No text before or after JSON
```

---

## 🎮 How to Use (Step-by-Step)

### Step 1: Open the Interface
```
Open: /Users/adityagupta/Desktop/LEETCODE Extension/demo_ui.html
In: Any modern web browser (Chrome, Firefox, Safari, Edge)
```

### Step 2: Fill the Form
```
Problem Name: "Two Sum" (or any problem name)
Language:     Select from dropdown (C++, Java, Python, JavaScript, TypeScript)
Code:         Paste your solution (can be any approach)
```

### Step 3: Click Analyze
```
Button: "Analyze Code"
Status: Shows loading spinner
Wait:   Usually 2-5 seconds
```

### Step 4: View Results
```
Results include:
1. Brute Force Solution - expandable section
2. Optimized Solution - expandable section
3. Complexity Cards - time and space analysis
```

### Step 5: Copy Code
```
Location: Top-right of each code block
Button:   "Copy" (changes to "Copied!" with checkmark)
Action:   Paste anywhere you need it
```

---

## 🔍 Features at a Glance

| Feature | Details |
|---------|---------|
| **Expand/Collapse** | Click title or arrow to toggle code visibility |
| **Language Badge** | Shows detected language in orange |
| **Copy Button** | Copies exact code to clipboard |
| **Feedback** | Shows "Copied!" message for 2 seconds |
| **Scrollable Code** | Max height 500px, smooth scrolling |
| **Dark Theme** | Professional dark interface |
| **Complexity Cards** | Time & Space shown side-by-side |
| **Error Messages** | Clear feedback if something goes wrong |

---

## 📊 Output Structure

The interface displays:

```
┌─────────────────────────────────────────┐
│        BRUTE FORCE SOLUTION             │
│  [C++ ▼]              [Copy button]     │
│  ─────────────────────────────────────  │
│  class Solution {                       │
│    public: int solve() { ... }          │
│  };                                     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│       OPTIMIZED SOLUTION                │
│  [C++ ▼]              [Copy button]     │
│  ─────────────────────────────────────  │
│  class Solution {                       │
│    public: int solve() { ... }          │
│  };                                     │
└─────────────────────────────────────────┘

┌──────────────────┬──────────────────┐
│ TIME COMPLEXITY  │ SPACE COMPLEXITY │
│      O(n)        │      O(n)        │
└──────────────────┴──────────────────┘
```

---

## 🚀 Keyboard Shortcuts

```
Tab              → Move between form fields
Enter (at input) → Focus on Analyze button
Click Copy       → Copy code to clipboard
Click Title      → Expand/Collapse section
```

---

## 💻 Supported Languages

```
1. C++
2. Java
3. Python
4. JavaScript
5. TypeScript
```

(More can be added - just update the select dropdown)

---

## ⚠️ Important Notes

### What Works
✅ Valid, syntactically correct code submissions  
✅ Any algorithm complexity level  
✅ Any data structure problem  
✅ Code in any of the 5 supported languages  
✅ Multiple solutions for same problem  

### What Doesn't Work
❌ Incomplete or pseudo code only  
❌ Comments-only submissions  
❌ Unsupported programming languages  
❌ Without internet connection (needs API)  
❌ If backend server is down  

### Tips for Best Results
1. **Clear Code**: Submit readable, formatted code
2. **Complete Solution**: Include all necessary code
3. **Right Language**: Select the exact language used
4. **Problem Info**: Provide problem name for context
5. **Wait Patiently**: AI takes 2-5 seconds to analyze

---

## 🔧 Configuration

### Change Backend URL
In the HTML file, find this line:
```javascript
const API_BASE = 'http://localhost:3000/api';
```

Change to your backend address:
```javascript
const API_BASE = 'http://your-server:3000/api';
```

### Customize Colors
Edit CSS variables in the style section:
```css
:root {
    --bg-primary: #0f1115;    /* Main background */
    --accent: #3b82f6;         /* Button colors */
    /* ... more variables ... */
}
```

---

## 📋 Developer Reference

### Backend API Contract

**Endpoint:** `POST /api/analyze`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "code": "function code() { ... }",
  "language": "javascript",
  "problemName": "Two Sum",
  "difficulty": "Easy"
}
```

**Success Response (200):**
```json
{
  "bruteForce": {
    "code": "..."
  },
  "optimal": {
    "code": "..."
  },
  "complexity": {
    "time": "O(n²)",
    "space": "O(1)"
  }
}
```

**Error Response (400/500):**
```json
{
  "error": "Error message",
  "message": "Detailed error"
}
```

---

## 🎓 Example Workflow

### Example: Two Sum Problem

**Input:**
```javascript
// Language: javascript
// Problem: Two Sum

function twoSum(nums, target) {
    const map = new Map();
    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];
        if (map.has(complement)) {
            return [map.get(complement), i];
        }
        map.set(nums[i], i);
    }
    return [];
}
```

**Results You'll See:**

1. **Brute Force Section** (expands):
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

2. **Optimized Section** (expands):
```javascript
function twoSum(nums, target) {
    const map = new Map();
    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];
        if (map.has(complement)) {
            return [map.get(complement), i];
        }
        map.set(nums[i], i);
    }
    return [];
}
```

3. **Complexity:**
- Time: O(n²) → O(n)
- Space: O(1) → O(n)

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Please enter code" error | Paste code in textarea |
| "Select language" error | Choose from dropdown |
| Backend connection error | Start server: `npm start` in backend folder |
| Copy button not working | Try different browser or check console |
| Results not showing | Check browser console for errors |
| Analyze button disabled | Wait for previous request to finish |

---

## 📞 Support

If something doesn't work:

1. **Check Console**: Press F12 → Console tab for errors
2. **Verify Backend**: Is `npm start` running?
3. **Check Network**: Open DevTools → Network tab
4. **Restart Browser**: Close and reopen the page
5. **Clear Cache**: Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

---

## ✅ Checklist Before Submitting Code

- [ ] Code is syntactically complete
- [ ] Language is selected in dropdown
- [ ] Problem name is entered
- [ ] Backend server is running (`npm start`)
- [ ] Internet connection is active
- [ ] Browser console has no errors (F12)
- [ ] All required fields filled

---

## 🎉 You're Ready!

You now have everything you need to use the LeetCode Extension UI. 

**Next Steps:**
1. Start your backend server
2. Open `demo_ui.html` in browser
3. Submit code for analysis
4. Copy solutions instantly
5. Learn from multiple approaches!

Happy coding! 🚀
