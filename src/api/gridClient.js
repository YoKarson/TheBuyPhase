const API_KEY = import.meta.env.VITE_GRID_API_KEY;

const ENDPOINTS = {
  centralData: 'https://api-op.grid.gg/central-data/graphql',
  liveData: 'https://api-op.grid.gg/live-data-feed/series-state/graphql',
  statistics: 'https://api-op.grid.gg/statistics-feed/graphql',
};

export async function gridQuery(endpoint, query, variables = {}) {
  const url = ENDPOINTS[endpoint];

  if (!url) {
    throw new Error(`Unknown endpoint: ${endpoint}`);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GRID API error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();

  if (json.errors) {
    throw new Error(`GraphQL error: ${json.errors.map(e => e.message).join(', ')}`);
  }

  return json.data;
}
