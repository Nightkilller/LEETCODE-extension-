/**
 * LeetCode GraphQL Service — Direct calls from extension
 * Replaces backend/services/leetcodeService.js
 */

const LEETCODE_GRAPHQL = 'https://leetcode.com/graphql';

async function queryLeetCode(query, variables = {}) {
    const response = await fetch(LEETCODE_GRAPHQL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Referer': 'https://leetcode.com',
        },
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) throw new Error(`LeetCode API returned ${response.status}`);
    const data = await response.json();
    if (data.errors) throw new Error(data.errors[0].message);
    return data.data;
}

async function getUserProfile(username) {
    const query = `
    query getUserProfile($username: String!) {
      matchedUser(username: $username) {
        username
        profile { realName ranking reputation starRating }
        submitStatsGlobal {
          acSubmissionNum { difficulty count }
        }
        userCalendar { streak totalActiveDays submissionCalendar }
        tagProblemCounts {
          advanced { tagName tagSlug problemsSolved }
          intermediate { tagName tagSlug problemsSolved }
          fundamental { tagName tagSlug problemsSolved }
        }
      }
    }`;

    const data = await queryLeetCode(query, { username });
    if (!data.matchedUser) throw new Error(`User '${username}' not found on LeetCode`);

    const user = data.matchedUser;
    const stats = user.submitStatsGlobal.acSubmissionNum;
    const allTopics = [
        ...(user.tagProblemCounts?.fundamental || []),
        ...(user.tagProblemCounts?.intermediate || []),
        ...(user.tagProblemCounts?.advanced || []),
    ];

    const totalSolved = stats.find(s => s.difficulty === 'All')?.count || 0;

    return {
        username: user.username,
        realName: user.profile?.realName || '',
        ranking: user.profile?.ranking || 0,
        reputation: user.profile?.reputation || 0,
        starRating: user.profile?.starRating || 0,
        solved: {
            all: totalSolved,
            easy: stats.find(s => s.difficulty === 'Easy')?.count || 0,
            medium: stats.find(s => s.difficulty === 'Medium')?.count || 0,
            hard: stats.find(s => s.difficulty === 'Hard')?.count || 0,
        },
        topicStats: allTopics.map(t => ({
            name: t.tagName, slug: t.tagSlug, solved: t.problemsSolved,
        })).sort((a, b) => b.solved - a.solved),
        calendar: user.userCalendar || { streak: 0, totalActiveDays: 0, submissionCalendar: '{}' },
        acceptanceRate: totalSolved > 0 ? Math.round((totalSolved / (totalSolved * 1.8)) * 100) : 0,
    };
}

async function getContestHistory(username) {
    const query = `
    query userContestRankingInfo($username: String!) {
      userContestRanking(username: $username) {
        attendedContestsCount rating globalRanking topPercentage
      }
      userContestRankingHistory(username: $username) {
        contest { title startTime }
        rating ranking
      }
    }`;

    const data = await queryLeetCode(query, { username });

    return {
        current: data.userContestRanking || {
            attendedContestsCount: 0, rating: 0, globalRanking: 0, topPercentage: 100,
        },
        history: (data.userContestRankingHistory || []).map(entry => ({
            contest: entry.contest.title,
            date: new Date(entry.contest.startTime * 1000).toISOString().split('T')[0],
            rating: Math.round(entry.rating),
            ranking: entry.ranking,
        })),
    };
}
