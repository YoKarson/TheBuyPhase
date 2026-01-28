import { gridQuery } from './gridClient';

export async function getTeamStatistics(teamId, tournamentId) {
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
    tournamentIds: [tournamentId],
  });
  return data.teamStatistics;
}

export async function getPlayerStatistics(playerId, tournamentId) {
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
    tournamentIds: [tournamentId],
  });
  return data.playerStatistics;
}

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

export async function getSeriesMapData(seriesId, teamId) {
  const query = `
    query GetSeriesMapData($id: ID!) {
      seriesState(id: $id) {
        id
        finished
        games {
          id
          sequenceNumber
          finished
          map {
            name
          }
          teams {
            id
            name
            won
            score
          }
        }
      }
    }
  `;

  const data = await gridQuery('liveData', query, { id: seriesId });
  const games = data.seriesState?.games || [];

  // Extract map results for the specified team
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

export async function aggregateMapPool(seriesList, teamId) {
  // Fetch map data for all series
  const mapDataPromises = seriesList.map(series =>
    getSeriesMapData(series.id, teamId).catch(() => [])
  );

  const allMapData = await Promise.all(mapDataPromises);

  // Aggregate map stats
  const mapStats = new Map();

  for (const seriesMapData of allMapData) {
    for (const game of seriesMapData) {
      if (!mapStats.has(game.map)) {
        mapStats.set(game.map, { played: 0, wins: 0, losses: 0, roundsFor: 0, roundsAgainst: 0 });
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
  }

  // Convert to array and calculate win rates
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
