import { gridQuery } from './gridClient';

export async function getSeriesState(seriesId) {
  const query = `
    query GetSeriesState($id: ID!) {
      seriesState(id: $id) {
        id
        format
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
            id
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
            firstKill
            players {
              id
              name
              character {
                name
              }
              kills
              deaths
              killAssistsGiven
              firstKill
              money
              loadoutValue
            }
          }
          segments {
            id
            type
            sequenceNumber
            started
            finished
            teams {
              id
              name
              side
              won
              kills
              deaths
              firstKill
              winType
              players {
                id
                name
                kills
                deaths
                firstKill
              }
            }
          }
        }
      }
    }
  `;

  const data = await gridQuery('liveData', query, { id: seriesId });
  return data.seriesState;
}

// Compute scouting metrics from series state
export function computeScoutingMetrics(seriesState, teamName) {
  if (!seriesState?.games) return null;

  const metrics = {
    teamName,
    gamesPlayed: 0,
    gamesWon: 0,
    roundsPlayed: 0,
    roundsWon: 0,
    attackRoundsWon: 0,
    attackRoundsPlayed: 0,
    defenseRoundsWon: 0,
    defenseRoundsPlayed: 0,
    firstBloodRounds: 0,
    firstBloodWins: 0,
    firstBloodLosses: 0,
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

    // Process rounds (segments)
    for (const segment of game.segments || []) {
      if (segment.type !== 'round' || !segment.finished) continue;

      const segmentTeam = segment.teams.find(t =>
        t.name.toLowerCase().includes(teamName.toLowerCase())
      );
      if (!segmentTeam) continue;

      metrics.roundsPlayed++;
      if (segmentTeam.won) metrics.roundsWon++;

      // Track attack/defense
      const isAttack = segmentTeam.side?.toLowerCase() === 'attack';
      if (isAttack) {
        metrics.attackRoundsPlayed++;
        if (segmentTeam.won) metrics.attackRoundsWon++;
      } else {
        metrics.defenseRoundsPlayed++;
        if (segmentTeam.won) metrics.defenseRoundsWon++;
      }

      // First blood analysis
      if (segmentTeam.firstKill) {
        metrics.firstBloodRounds++;
        if (segmentTeam.won) {
          metrics.firstBloodWins++;
        } else {
          metrics.firstBloodLosses++;
        }
      }

      // Player stats
      for (const player of segmentTeam.players || []) {
        if (!metrics.players[player.id]) {
          metrics.players[player.id] = {
            name: player.name,
            kills: 0,
            deaths: 0,
            firstKills: 0,
            rounds: 0,
          };
        }
        metrics.players[player.id].kills += player.kills || 0;
        metrics.players[player.id].deaths += player.deaths || 0;
        metrics.players[player.id].rounds++;
        if (player.firstKill) {
          metrics.players[player.id].firstKills++;
        }
      }
    }
  }

  // Compute derived stats
  metrics.winRate = metrics.roundsPlayed > 0
    ? (metrics.roundsWon / metrics.roundsPlayed * 100).toFixed(1)
    : 0;
  metrics.attackWinRate = metrics.attackRoundsPlayed > 0
    ? (metrics.attackRoundsWon / metrics.attackRoundsPlayed * 100).toFixed(1)
    : 0;
  metrics.defenseWinRate = metrics.defenseRoundsPlayed > 0
    ? (metrics.defenseRoundsWon / metrics.defenseRoundsPlayed * 100).toFixed(1)
    : 0;
  metrics.firstBloodConversion = metrics.firstBloodRounds > 0
    ? (metrics.firstBloodWins / metrics.firstBloodRounds * 100).toFixed(1)
    : 0;

  // Player stats array
  metrics.playerStats = Object.values(metrics.players).map(p => ({
    ...p,
    kd: p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : p.kills.toFixed(2),
    firstKillRate: p.rounds > 0 ? (p.firstKills / p.rounds * 100).toFixed(1) : 0,
  })).sort((a, b) => b.kills - a.kills);

  return metrics;
}
