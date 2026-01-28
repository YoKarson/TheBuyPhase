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
