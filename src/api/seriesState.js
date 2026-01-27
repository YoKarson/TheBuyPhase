import { gridQuery } from './gridClient';

export async function getSeriesState(seriesId) {
  // Start with minimal fields to test what's available
  const query = `
    query GetSeriesState($id: ID!) {
      seriesState(id: $id) {
        id
        started
        finished
        teams {
          id
          name
          won
          score
        }
        games {
          id
          sequenceNumber
          started
          finished
          map {
            name
          }
          teams {
            id
            name
            side
            won
            score
            kills
            deaths
            players {
              id
              name
              kills
              deaths
            }
          }
        }
      }
    }
  `;

  const data = await gridQuery('liveData', query, { id: seriesId });
  return data.seriesState;
}

// Compute scouting metrics from series state (basic version)
export function computeScoutingMetrics(seriesState, teamName) {
  if (!seriesState?.games) return null;

  const metrics = {
    teamName,
    gamesPlayed: 0,
    gamesWon: 0,
    totalKills: 0,
    totalDeaths: 0,
    players: {},
  };

  for (const game of seriesState.games) {
    if (!game.finished) continue;

    const team = game.teams.find(t =>
      t.name.toLowerCase().includes(teamName.toLowerCase())
    );
    if (!team) continue;

    metrics.gamesPlayed++;
    if (team.won) metrics.gamesWon++;
    metrics.totalKills += team.kills || 0;
    metrics.totalDeaths += team.deaths || 0;

    // Player stats from game level
    for (const player of team.players || []) {
      if (!metrics.players[player.id]) {
        metrics.players[player.id] = {
          name: player.name,
          kills: 0,
          deaths: 0,
        };
      }
      metrics.players[player.id].kills += player.kills || 0;
      metrics.players[player.id].deaths += player.deaths || 0;
    }
  }

  // Compute derived stats
  metrics.kd = metrics.totalDeaths > 0
    ? (metrics.totalKills / metrics.totalDeaths).toFixed(2)
    : metrics.totalKills.toFixed(2);

  // Player stats array
  metrics.playerStats = Object.values(metrics.players).map(p => ({
    ...p,
    kd: p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : p.kills.toFixed(2),
  })).sort((a, b) => b.kills - a.kills);

  return metrics;
}
