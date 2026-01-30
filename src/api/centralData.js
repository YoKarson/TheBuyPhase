import { gridQuery } from './gridClient';

// VCT Americas 2024 Stage 1 - only Playoffs has accessible series data
const VALORANT_2024_TOURNAMENT_IDS = [
  '757321',  // Stage 1 2024 - Playoffs
];

const CURRENT_TOURNAMENT_ID = '757321'; // Stage 1 - Playoffs

export const TOURNAMENT_IDS = VALORANT_2024_TOURNAMENT_IDS;
export const CURRENT_TOURNAMENT = CURRENT_TOURNAMENT_ID;

// Get teams from all Stage 1 tournaments (merged)
export async function getCurrentTournamentTeams() {
  const teamMap = new Map();

  // Query ALL Stage 1 tournaments and merge teams
  for (let i = 0; i < VALORANT_2024_TOURNAMENT_IDS.length; i++) {
    const tournamentId = VALORANT_2024_TOURNAMENT_IDS[i];

    if (i > 0) {
      await delay(800);
    }

    try {
      const query = `
        query GetSeriesByTournament($tournamentId: ID!) {
          allSeries(
            filter: { tournamentId: $tournamentId }
            first: 50
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

      const data = await gridQuery('centralData', query, { tournamentId });

      for (const edge of data.allSeries.edges) {
        for (const team of edge.node.teams) {
          if (team.baseInfo?.id && !teamMap.has(team.baseInfo.id)) {
            teamMap.set(team.baseInfo.id, {
              id: team.baseInfo.id,
              name: team.baseInfo.name,
              logoUrl: team.baseInfo.logoUrl,
            });
          }
        }
      }
      console.log(`Found ${teamMap.size} teams after tournament ${tournamentId}`);
    } catch (err) {
      console.warn(`Failed to fetch from tournament ${tournamentId}:`, err.message);
    }
  }

  return {
    tournament: { name: 'VCT Americas 2024 - Stage 1' },
    teams: Array.from(teamMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// Helper function for delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Get ALL series a team played across all 2024 tournaments
export async function getTeamAllSeries(teamId) {
  const allSeries = [];

  // Query each tournament for this team's series (with delays)
  for (let i = 0; i < VALORANT_2024_TOURNAMENT_IDS.length; i++) {
    const tournamentId = VALORANT_2024_TOURNAMENT_IDS[i];

    // Add delay between requests (except first one)
    if (i > 0) {
      await delay(800);
    }

    try {
      const query = `
        query GetTeamSeries($tournamentId: ID!) {
          allSeries(
            filter: { tournamentId: $tournamentId }
            first: 50
          ) {
            edges {
              node {
                id
                startTimeScheduled
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

      const data = await gridQuery('centralData', query, { tournamentId });

      // Filter to series where this team played
      const teamSeries = data.allSeries.edges
        .map(e => e.node)
        .filter(series => series.teams.some(t => t.baseInfo?.id === teamId));

      allSeries.push(...teamSeries);
    } catch (err) {
      console.warn(`Failed to fetch series from tournament ${tournamentId}:`, err.message);
    }
  }

  // Sort by date (most recent first)
  return allSeries.sort((a, b) =>
    new Date(b.startTimeScheduled) - new Date(a.startTimeScheduled)
  );
}
