import { gridQuery } from './gridClient';

// VCT Americas Kickoff 2024 - Groups
const VCT_AMERICAS_TOURNAMENT_ID = '757073';

export async function getTournamentTeams() {
  // Get all series in the tournament to extract unique teams
  const query = `
    query GetSeriesByTournament($tournamentId: ID!) {
      allSeries(
        filter: {
          tournamentId: $tournamentId
        }
        first: 50
        orderBy: StartTimeScheduled
      ) {
        edges {
          node {
            id
            teams {
              baseInfo {
                id
                name
                logoUrl
              }
            }
          }
        }
      }
    }
  `;

  const data = await gridQuery('centralData', query, { tournamentId: VCT_AMERICAS_TOURNAMENT_ID });
  const allSeries = data.allSeries.edges.map(e => e.node);

  // Extract unique teams
  const teamMap = new Map();
  for (const series of allSeries) {
    for (const team of series.teams) {
      if (team.baseInfo?.id && !teamMap.has(team.baseInfo.id)) {
        teamMap.set(team.baseInfo.id, {
          id: team.baseInfo.id,
          name: team.baseInfo.name,
          logoUrl: team.baseInfo.logoUrl,
        });
      }
    }
  }

  return Array.from(teamMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTeamSeries(teamId) {
  // Get all series where this team played
  const query = `
    query GetSeriesByTournament($tournamentId: ID!) {
      allSeries(
        filter: {
          tournamentId: $tournamentId
        }
        first: 50
        orderBy: StartTimeScheduled
      ) {
        edges {
          node {
            id
            startTimeScheduled
            format {
              nameShortened
            }
            tournament {
              id
              name
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

  // Filter to series where this team played
  const teamSeries = allSeries.filter(series =>
    series.teams.some(t => t.baseInfo?.id === teamId)
  );

  return teamSeries;
}

export const TOURNAMENT_ID = VCT_AMERICAS_TOURNAMENT_ID;
