/**
 * Cache Service — In-memory LRU cache with TTL
 * 
 * Caches AI responses and profile data to reduce
 * redundant API calls and improve response times.
 */

class CacheService {
    constructor(maxSize = 100, defaultTTL = 300000) { // 5 min default TTL
        this.cache = new Map();
        this.maxSize = maxSize;
        this.defaultTTL = defaultTTL;
    }

    /**
     * Generate a deterministic cache key from an object
     */
    _makeKey(prefix, data) {
        const str = typeof data === 'string' ? data : JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Convert to 32-bit integer
        }
        return `${prefix}:${hash}`;
    }

    /**
     * Get a cached value if it exists and hasn't expired
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        // Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, entry);
        return entry.value;
    }

    /**
     * Set a cache entry with optional TTL override
     */
    set(key, value, ttl = this.defaultTTL) {
        // Evict oldest if at capacity
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }

        this.cache.set(key, {
            value,
            expiresAt: Date.now() + ttl,
        });
    }

    /**
     * Check if a key exists and is valid
     */
    has(key) {
        return this.get(key) !== null;
    }

    /**
     * Clear entire cache
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Get cache stats
     */
    stats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
        };
    }
}

// Export singleton instances for different cache domains
module.exports = {
    aiCache: new CacheService(50, 600000),       // 10 min TTL for AI responses
    profileCache: new CacheService(20, 300000),   // 5 min TTL for profiles
    datasetCache: new CacheService(200, 3600000), // 1 hour TTL for dataset lookups
};
