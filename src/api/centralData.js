import { gridQuery } from './gridClient';

// Cloud9 organization ID
const C9_ORG_ID = '1';

export async function getC9Organization() {
  const query = `
    query GetC9Organization($id: ID!) {
      organization(id: $id) {
        id
        name
        teams {
          id
          name
        }
      }
    }
  `;

  const data = await gridQuery('centralData', query, { id: C9_ORG_ID });
  return data.organization;
}

export async function getC9ValorantTeam() {
  const org = await getC9Organization();
  // Find the main Valorant team (not Cloud9 White, etc.)
  // We'll need to filter by title - for now return all teams
  return org?.teams || [];
}

export async function getUpcomingSeries(teamName = 'Cloud9') {
  // Get series scheduled from now onwards
  const now = new Date().toISOString();
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const query = `
    query GetUpcomingSeries($gte: String!, $lte: String!) {
      allSeries(
        filter: {
          startTimeScheduled: {
            gte: $gte
            lte: $lte
          }
        }
        orderBy: StartTimeScheduled
        first: 50
      ) {
        totalCount
        edges {
          node {
            id
            startTimeScheduled
            title {
              name
            }
            format {
              name
              nameShortened
            }
            tournament {
              id
              name
              nameShortened
            }
            teams {
              baseInfo {
                id
                name
                logoUrl
              }
              scoreAdvantage
            }
          }
        }
      }
    }
  `;

  const data = await gridQuery('centralData', query, { gte: now, lte: nextWeek });

  // Filter to only Valorant series that include the specified team
  const allSeries = data.allSeries.edges.map(edge => edge.node);

  return allSeries.filter(series =>
    series.title?.name?.toLowerCase() === 'valorant' &&
    series.teams.some(team =>
      team.baseInfo?.name?.toLowerCase().includes(teamName.toLowerCase())
    )
  );
}

export async function getRecentSeries(teamName = 'Cloud9', days = 30) {
  const now = new Date().toISOString();
  const pastDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const query = `
    query GetRecentSeries($gte: String!, $lte: String!) {
      allSeries(
        filter: {
          startTimeScheduled: {
            gte: $gte
            lte: $lte
          }
        }
        orderBy: StartTimeScheduled
        first: 50
      ) {
        totalCount
        edges {
          node {
            id
            startTimeScheduled
            title {
              name
            }
            format {
              name
              nameShortened
            }
            tournament {
              id
              name
              nameShortened
            }
            teams {
              baseInfo {
                id
                name
                logoUrl
              }
              scoreAdvantage
            }
          }
        }
      }
    }
  `;

  const data = await gridQuery('centralData', query, { gte: pastDate, lte: now });

  const allSeries = data.allSeries.edges.map(edge => edge.node);

  // Filter to only Valorant series that include the specified team
  return allSeries.filter(series =>
    series.title?.name?.toLowerCase() === 'valorant' &&
    series.teams.some(team =>
      team.baseInfo?.name?.toLowerCase().includes(teamName.toLowerCase())
    )
  );
}
