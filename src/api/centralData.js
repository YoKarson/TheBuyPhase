import { gridQuery } from './gridClient';

// Cloud9 organization ID
const C9_ORG_ID = '1';

// VCT Americas Kickoff 2024 - Groups (has C9 matches)
const VCT_AMERICAS_TOURNAMENT_ID = '757073';

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

export async function getC9Matches() {
  const query = `
    query GetSeriesByTournament($tournamentId: ID!) {
      allSeries(
        filter: {
          tournamentId: $tournamentId
        }
        first: 50
        orderBy: StartTimeScheduled
      ) {
        totalCount
        edges {
          node {
            id
            startTimeScheduled
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

  const data = await gridQuery('centralData', query, { tournamentId: VCT_AMERICAS_TOURNAMENT_ID });
  const allSeries = data.allSeries.edges.map(e => e.node);

  // Filter to C9 matches only
  const c9Matches = allSeries.filter(series =>
    series.teams.some(t => t.baseInfo?.name?.toLowerCase().includes('cloud9'))
  );

  console.log('C9 matches found:', c9Matches.length);

  return c9Matches;
}
