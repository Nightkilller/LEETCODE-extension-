/**
 * LeetCode GraphQL Service
 * 
 * Fetches user profile data, submission stats, and contest
 * history from LeetCode's public GraphQL endpoint.
 */

const fetch = require('node-fetch');
const { profileCache } = require('./cacheService');

const LEETCODE_GRAPHQL = 'https://leetcode.com/graphql';

/**
 * Execute a GraphQL query against LeetCode
 */
async function queryLeetCode(query, variables = {}) {
  const response = await fetch(LEETCODE_GRAPHQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Referer': 'https://leetcode.com',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`LeetCode API returned ${response.status}`);
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(data.errors[0].message);
  }

  return data.data;
}

/**
 * Fetch complete user profile with stats
 */
async function getUserProfile(username) {
  const cacheKey = `profile:${username}`;
  const cached = profileCache.get(cacheKey);
  if (cached) return cached;

  const query = `
    query getUserProfile($username: String!) {
      matchedUser(username: $username) {
        username
        profile {
          realName
          ranking
          reputation
          starRating
        }
        submitStatsGlobal {
          acSubmissionNum {
            difficulty
            count
          }
        }
        userCalendar {
          streak
          totalActiveDays
          submissionCalendar
        }
        tagProblemCounts {
          advanced {
            tagName
            tagSlug
            problemsSolved
          }
          intermediate {
            tagName
            tagSlug
            problemsSolved
          }
          fundamental {
            tagName
            tagSlug
            problemsSolved
          }
        }
      }
    }
  `;

  const data = await queryLeetCode(query, { username });

  if (!data.matchedUser) {
    throw new Error(`User '${username}' not found on LeetCode`);
  }

  const user = data.matchedUser;
  const stats = user.submitStatsGlobal.acSubmissionNum;

  // Flatten topic stats from all levels
  const allTopics = [
    ...(user.tagProblemCounts?.fundamental || []),
    ...(user.tagProblemCounts?.intermediate || []),
    ...(user.tagProblemCounts?.advanced || []),
  ];

  const result = {
    username: user.username,
    realName: user.profile?.realName || '',
    ranking: user.profile?.ranking || 0,
    reputation: user.profile?.reputation || 0,
    starRating: user.profile?.starRating || 0,
    solved: {
      all: stats.find(s => s.difficulty === 'All')?.count || 0,
      easy: stats.find(s => s.difficulty === 'Easy')?.count || 0,
      medium: stats.find(s => s.difficulty === 'Medium')?.count || 0,
      hard: stats.find(s => s.difficulty === 'Hard')?.count || 0,
    },
    topicStats: allTopics.map(t => ({
      name: t.tagName,
      slug: t.tagSlug,
      solved: t.problemsSolved,
    })).sort((a, b) => b.solved - a.solved),
    calendar: user.userCalendar || { streak: 0, totalActiveDays: 0, submissionCalendar: "{}" }
  };

  profileCache.set(cacheKey, result);
  return result;
}

/**
 * Fetch user's contest rating history
 */
async function getContestHistory(username) {
  const cacheKey = `contest:${username}`;
  const cached = profileCache.get(cacheKey);
  if (cached) return cached;

  const query = `
    query userContestRankingInfo($username: String!) {
      userContestRanking(username: $username) {
        attendedContestsCount
        rating
        globalRanking
        topPercentage
      }
      userContestRankingHistory(username: $username) {
        contest {
          title
          startTime
        }
        rating
        ranking
      }
    }
  `;

  const data = await queryLeetCode(query, { username });

  const result = {
    current: data.userContestRanking || {
      attendedContestsCount: 0,
      rating: 0,
      globalRanking: 0,
      topPercentage: 100,
    },
    history: (data.userContestRankingHistory || []).map(entry => ({
      contest: entry.contest.title,
      date: new Date(entry.contest.startTime * 1000).toISOString().split('T')[0],
      rating: Math.round(entry.rating),
      ranking: entry.ranking,
    })),
  };

  profileCache.set(cacheKey, result);
  return result;
}

module.exports = { getUserProfile, getContestHistory };
