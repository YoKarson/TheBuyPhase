import { gridQuery } from './gridClient';
import { TOURNAMENT_IDS } from './centralData';

// Get team statistics across ALL 2024 tournaments
export async function getTeamStatistics(teamId) {
  const query = `
    query TeamStatistics($teamId: ID!, $tournamentIds: [ID!]) {
      teamStatistics(teamId: $teamId, filter: { tournamentIds: { in: $tournamentIds } }) {
        series {
          count
          kills {
            sum
            avg
          }
        }
        game {
          count
          wins {
            value
            count
            percentage
            streak {
              max
              current
            }
          }
        }
        segment {
          type
          count
          deaths {
            sum
            avg
          }
        }
      }
    }
  `;

  const data = await gridQuery('statistics', query, {
    teamId,
    tournamentIds: TOURNAMENT_IDS,
  });
  return data.teamStatistics;
}

// Get player statistics across ALL 2024 tournaments
export async function getPlayerStatistics(playerId) {
  const query = `
    query PlayerStatistics($playerId: ID!, $tournamentIds: [ID!]) {
      playerStatistics(playerId: $playerId, filter: { tournamentIds: { in: $tournamentIds } }) {
        series {
          count
          kills {
            sum
            avg
          }
        }
        game {
          count
        }
        segment {
          type
          count
          deaths {
            sum
          }
        }
      }
    }
  `;

  const data = await gridQuery('statistics', query, {
    playerId,
    tournamentIds: TOURNAMENT_IDS,
  });
  return data.playerStatistics;
}

// Get players from a series
export async function getTeamPlayers(seriesId, teamId) {
  const query = `
    query GetTeamPlayers($id: ID!) {
      seriesState(id: $id) {
        games {
          teams {
            id
            players {
              id
              name
            }
          }
        }
      }
    }
  `;

  const data = await gridQuery('liveData', query, { id: seriesId });

  const playerMap = new Map();
  for (const game of data.seriesState?.games || []) {
    const team = game.teams?.find(t => t.id === teamId);
    if (team?.players) {
      for (const player of team.players) {
        if (!playerMap.has(player.id)) {
          playerMap.set(player.id, player);
        }
      }
    }
  }

  return Array.from(playerMap.values());
}

// Get map data from a single series
export async function getSeriesMapData(seriesId, teamId) {
  const query = `
    query GetSeriesMapData($id: ID!) {
      seriesState(id: $id) {
        games {
          finished
          map {
            name
          }
          teams {
            id
            won
            score
          }
        }
      }
    }
  `;

  const data = await gridQuery('liveData', query, { id: seriesId });
  const games = data.seriesState?.games || [];

  return games
    .filter(game => game.finished && game.map?.name)
    .map(game => {
      const team = game.teams?.find(t => t.id === teamId);
      const opponent = game.teams?.find(t => t.id !== teamId);
      return {
        map: game.map.name,
        won: team?.won || false,
        score: team?.score || 0,
        opponentScore: opponent?.score || 0,
      };
    });
}

// Aggregate map pool from ALL series
export async function aggregateMapPool(seriesList, teamId) {
  const mapStats = new Map();

  // Fetch map data for each series with delays to avoid rate limiting
  for (let i = 0; i < seriesList.length; i++) {
    const series = seriesList[i];
    try {
      // Add delay between requests (except first one)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const mapData = await getSeriesMapData(series.id, teamId);

      for (const game of mapData) {
        if (!mapStats.has(game.map)) {
          mapStats.set(game.map, {
            played: 0,
            wins: 0,
            losses: 0,
            roundsFor: 0,
            roundsAgainst: 0,
          });
        }
        const stats = mapStats.get(game.map);
        stats.played++;
        if (game.won) {
          stats.wins++;
        } else {
          stats.losses++;
        }
        stats.roundsFor += game.score;
        stats.roundsAgainst += game.opponentScore;
      }
    } catch (err) {
      console.warn(`Failed to get map data for series ${series.id}:`, err.message);
    }
  }

  // Convert to array with calculated stats
  return Array.from(mapStats.entries())
    .map(([map, stats]) => ({
      map,
      played: stats.played,
      wins: stats.wins,
      losses: stats.losses,
      winRate: stats.played > 0 ? (stats.wins / stats.played * 100).toFixed(0) : 0,
      roundsFor: stats.roundsFor,
      roundsAgainst: stats.roundsAgainst,
      roundDiff: stats.roundsFor - stats.roundsAgainst,
    }))
    .sort((a, b) => b.played - a.played);
}
