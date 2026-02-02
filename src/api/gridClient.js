const API_KEY = import.meta.env.VITE_GRID_API_KEY;

const ENDPOINTS = {
  centralData: 'https://api-op.grid.gg/central-data/graphql',
  liveData: 'https://api-op.grid.gg/live-data-feed/series-state/graphql',
  statistics: 'https://api-op.grid.gg/statistics-feed/graphql',
};

const MAX_RETRIES = 3;
const BASE_DELAY = 1000;

export async function gridQuery(endpoint, query, variables = {}, extraHeaders = {}) {
  const url = ENDPOINTS[endpoint];

  if (!url) {
    throw new Error(`Unknown endpoint: ${endpoint}`);
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          ...extraHeaders,
        },
        body: JSON.stringify({ query, variables }),
      });

      if (response.status === 429 || response.status >= 500) {
        if (attempt < MAX_RETRIES) {
          const delay = BASE_DELAY * Math.pow(2, attempt);
          console.warn(`Rate limited (${response.status}), retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      if (!response.ok) {
        throw new Error(`GRID API error: ${response.status} ${response.statusText}`);
      }

      const json = await response.json();

      if (json.errors) {
        const errorMsg = json.errors.map(e => e.message).join(', ');
        const isRateLimit = errorMsg.toLowerCase().includes('rate limit');

        if (isRateLimit && attempt < MAX_RETRIES) {
          const retryDelay = BASE_DELAY * Math.pow(2, attempt);
          console.warn(`GraphQL rate limit hit, retrying in ${retryDelay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }

        throw new Error(`GraphQL error: ${errorMsg}`);
      }

      return json.data;
    } catch (err) {
      if (attempt < MAX_RETRIES && (err.message?.includes('fetch') || err.message?.includes('rate limit'))) {
        const retryDelay = BASE_DELAY * Math.pow(2, attempt);
        console.warn(`Error, retrying in ${retryDelay}ms (attempt ${attempt + 1}/${MAX_RETRIES}):`, err.message);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      throw err;
    }
  }
}
