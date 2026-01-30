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

// Get detailed data from a single series (map, agents, rounds)
export async function getSeriesDetailedData(seriesId, teamId) {
  const query = `
    query GetSeriesDetailed($id: ID!) {
      seriesState(id: $id) {
        games {
          finished
          map {
            name
          }
          teams {
            id
            name
            won
            score
            players {
              id
              name
              character {
                name
              }
            }
          }
          segments {
            id
            type
            teams {
              id
              side
              won
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
    }
  `;

  const data = await gridQuery('liveData', query, { id: seriesId });
  const games = data.seriesState?.games || [];

  return games
    .filter(game => game.finished && game.map?.name)
    .map(game => {
      const team = game.teams?.find(t => t.id === teamId);
      const opponent = game.teams?.find(t => t.id !== teamId);
      const rounds = (game.segments || [])
        .filter(s => s.type === 'round')
        .map(s => {
          const teamRound = s.teams?.find(t => t.id === teamId);
          const oppRound = s.teams?.find(t => t.id !== teamId);
          return {
            roundNum: parseInt(s.id.replace('round-', '')),
            side: teamRound?.side,
            won: teamRound?.won || false,
            players: teamRound?.players || [],
            oppPlayers: oppRound?.players || [],
          };
        });

      return {
        map: game.map.name,
        won: team?.won || false,
        score: team?.score || 0,
        opponentScore: opponent?.score || 0,
        agents: (team?.players || []).map(p => ({
          id: p.id,
          name: p.name,
          agent: p.character?.name || 'unknown',
        })),
        opponentAgents: (opponent?.players || []).map(p => ({
          id: p.id,
          name: p.name,
          agent: p.character?.name || 'unknown',
        })),
        rounds,
      };
    });
}

// Analyze round data for attack/defense splits and pistol rounds
export function analyzeRounds(allGameData) {
  const analysis = {
    attack: { wins: 0, total: 0 },
    defense: { wins: 0, total: 0 },
    pistol: { attack: { wins: 0, total: 0 }, defense: { wins: 0, total: 0 } },
  };

  for (const game of allGameData) {
    for (const round of game.rounds) {
      if (round.side === 'attacker') {
        analysis.attack.total++;
        if (round.won) analysis.attack.wins++;
      } else if (round.side === 'defender') {
        analysis.defense.total++;
        if (round.won) analysis.defense.wins++;
      }

      // Pistol rounds: round 1 (first half) and round 13 (second half)
      if (round.roundNum === 1 || round.roundNum === 13) {
        if (round.side === 'attacker') {
          analysis.pistol.attack.total++;
          if (round.won) analysis.pistol.attack.wins++;
        } else if (round.side === 'defender') {
          analysis.pistol.defense.total++;
          if (round.won) analysis.pistol.defense.wins++;
        }
      }
    }
  }

  return analysis;
}

// Analyze agent compositions and player agent pools
export function analyzeAgents(allGameData) {
  // Track compositions per map: "jett,omen,killjoy,sova,fade" -> { count, wins, maps }
  const compositions = new Map();
  // Track per-player agent usage
  const playerAgents = new Map();

  for (const game of allGameData) {
    // Build comp string (sorted agent names for deduplication)
    const compAgents = game.agents.map(a => a.agent).sort();
    const compKey = compAgents.join(', ');

    if (!compositions.has(compKey)) {
      compositions.set(compKey, { count: 0, wins: 0, maps: {} });
    }
    const comp = compositions.get(compKey);
    comp.count++;
    if (game.won) comp.wins++;
    comp.maps[game.map] = (comp.maps[game.map] || 0) + 1;

    // Track per-player agent usage
    for (const p of game.agents) {
      if (!playerAgents.has(p.name)) {
        playerAgents.set(p.name, new Map());
      }
      const agentMap = playerAgents.get(p.name);
      if (!agentMap.has(p.agent)) {
        agentMap.set(p.agent, { count: 0, wins: 0 });
      }
      const agentStat = agentMap.get(p.agent);
      agentStat.count++;
      if (game.won) agentStat.wins++;
    }
  }

  // Convert compositions to sorted array
  const compArray = Array.from(compositions.entries())
    .map(([agents, data]) => ({
      agents,
      count: data.count,
      wins: data.wins,
      winRate: data.count > 0 ? (data.wins / data.count * 100).toFixed(0) : 0,
      maps: data.maps,
    }))
    .sort((a, b) => b.count - a.count);

  // Convert player agents to sorted array
  const playerArray = Array.from(playerAgents.entries())
    .map(([name, agentMap]) => ({
      name,
      agents: Array.from(agentMap.entries())
        .map(([agent, data]) => ({
          agent,
          count: data.count,
          wins: data.wins,
        }))
        .sort((a, b) => b.count - a.count),
    }));

  return { compositions: compArray, playerAgents: playerArray };
}

// Fetch detailed data for all series (returns raw game data for further analysis)
export async function fetchAllSeriesData(seriesList, teamId) {
  const allGameData = [];

  for (let i = 0; i < seriesList.length; i++) {
    const series = seriesList[i];
    try {
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      const gameData = await getSeriesDetailedData(series.id, teamId);
      allGameData.push(...gameData);
    } catch (err) {
      console.warn(`Failed to get data for series ${series.id}:`, err.message);
    }
  }

  return allGameData;
}

// Aggregate map pool from fetched game data
export function aggregateMapPool(allGameData) {
  const mapStats = new Map();

  for (const game of allGameData) {
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
