// Simple localStorage cache with expiration

const CACHE_PREFIX = 'buyphase_';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

export function getCached(key) {
  try {
    const item = localStorage.getItem(CACHE_PREFIX + key);
    if (!item) return null;

    const { data, timestamp } = JSON.parse(item);

    // Check if expired
    if (Date.now() - timestamp > CACHE_DURATION) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

export function setCache(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch (err) {
    // localStorage might be full or disabled
    console.warn('Failed to cache:', err.message);
  }
}

export function clearCache() {
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore errors
  }
}
