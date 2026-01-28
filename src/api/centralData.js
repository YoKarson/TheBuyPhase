import { gridQuery } from './gridClient';

// All VCT Americas 2024 tournament IDs for comprehensive scouting
const VALORANT_2024_TOURNAMENT_IDS = [
  '757073',  // Kickoff 2024 - Groups A
  '757074',  // Kickoff 2024 - Playoffs
  '757101',  // Kickoff 2024 - Play-Ins
  '757371',  // Kickoff 2024 (main)
  '757481',  // Stage 1 2024 (main)
  '757320',  // Stage 1 2024 - Omega Group
  '757321',  // Stage 1 2024 - Playoffs
  '774782',  // Stage 2 2024 (main)
  '774783',  // Stage 2 2024 - Regular Season
];

// The "current" tournament - Stage 2 2024 Regular Season (has actual series)
const CURRENT_TOURNAMENT_ID = '774783';

export const TOURNAMENT_IDS = VALORANT_2024_TOURNAMENT_IDS;
export const CURRENT_TOURNAMENT = CURRENT_TOURNAMENT_ID;

// Get teams from the current tournament (with fallback)
export async function getCurrentTournamentTeams() {
  // Try multiple tournament IDs in case one doesn't have series
  const tournamentsToTry = [
    '774783',  // Stage 2 2024 - Regular Season
    '774782',  // Stage 2 2024 (main)
    '757321',  // Stage 1 2024 - Playoffs
    '757073',  // Kickoff 2024 - Groups A
  ];

  for (const tournamentId of tournamentsToTry) {
    try {
      const query = `
        query GetSeriesByTournament($tournamentId: ID!) {
          tournament(id: $tournamentId) {
            id
            name
            startDate
            endDate
          }
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

      // Extract unique teams
      const teamMap = new Map();
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

      // If we found teams, return them
      if (teamMap.size > 0) {
        console.log(`Found ${teamMap.size} teams in tournament ${tournamentId}`);
        return {
          tournament: data.tournament,
          teams: Array.from(teamMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
        };
      }
    } catch (err) {
      console.warn(`Failed to fetch from tournament ${tournamentId}:`, err.message);
    }
  }

  // Fallback: return empty
  return {
    tournament: { name: 'VCT Americas 2024' },
    teams: [],
  };
}

// Get ALL series a team played across all 2024 tournaments
export async function getTeamAllSeries(teamId) {
  const allSeries = [];

  // Query each tournament for this team's series
  for (const tournamentId of VALORANT_2024_TOURNAMENT_IDS) {
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
