import { gridQuery } from './gridClient';
import { TOURNAMENT_IDS } from './centralData';

// Track whether the API supports enhanced fields (firstKill, firstDeath)
let enhancedQuerySupported = null; // null = untested, true/false = tested

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

// Enhanced query with firstKill field
const ENHANCED_SERIES_QUERY = `
  query GetSeriesDetailed($id: ID!) {
    seriesState(id: $id) {
      games {
        finished
        map { name }
        teams {
          id
          name
          won
          score
          players {
            id
            name
            character { name }
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
              firstKill
            }
          }
        }
      }
    }
  }
`;

// Basic query (fallback without firstKill/firstDeath)
const BASIC_SERIES_QUERY = `
  query GetSeriesDetailed($id: ID!) {
    seriesState(id: $id) {
      games {
        finished
        map { name }
        teams {
          id
          name
          won
          score
          players {
            id
            name
            character { name }
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

// Shared processing for series data
function processSeriesGames(data, teamId) {
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
            players: (teamRound?.players || []).map(p => ({
              id: p.id,
              name: p.name,
              kills: p.kills || 0,
              deaths: p.deaths || 0,
              firstKill: p.firstKill || false,
            })),
            oppPlayers: (oppRound?.players || []).map(p => ({
              id: p.id,
              name: p.name,
              kills: p.kills || 0,
              deaths: p.deaths || 0,
              firstKill: p.firstKill || false,
            })),
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

// Get detailed data from a single series with enhanced field fallback
export async function getSeriesDetailedData(seriesId, teamId) {
  if (enhancedQuerySupported !== false) {
    try {
      const data = await gridQuery('liveData', ENHANCED_SERIES_QUERY, { id: seriesId }, { 'x-api-version': '3.10' });
      enhancedQuerySupported = true;
      return processSeriesGames(data, teamId);
    } catch (err) {
      if (enhancedQuerySupported === true) {
        throw err; // Was working before, this is a real error
      }
      console.warn('Enhanced query not supported, using basic:', err.message);
      enhancedQuerySupported = false;
    }
  }

  const data = await gridQuery('liveData', BASIC_SERIES_QUERY, { id: seriesId });
  return processSeriesGames(data, teamId);
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

// Analyze first blood data from round-level player stats
// Returns null if firstKill data is not available from the API
export function analyzeFirstBloods(allGameData) {
  let teamFBs = 0;
  let oppFBs = 0;
  let fbWins = 0; // rounds where team got FB and won
  let fbLosses = 0; // rounds where team got FB but lost
  let totalRounds = 0;
  const playerFBs = {}; // name -> { firstKills, firstDeaths, rounds }

  for (const game of allGameData) {
    for (const round of game.rounds) {
      totalRounds++;

      const teamGotFB = round.players.some(p => p.firstKill === true);
      const oppGotFB = round.oppPlayers.some(p => p.firstKill === true);

      if (teamGotFB) {
        teamFBs++;
        if (round.won) fbWins++;
        else fbLosses++;
      }
      if (oppGotFB) {
        oppFBs++;
      }

      // Track per-player first kill stats
      for (const p of round.players) {
        if (!playerFBs[p.name]) {
          playerFBs[p.name] = { firstKills: 0, firstDeaths: 0, rounds: 0 };
        }
        playerFBs[p.name].rounds++;
        if (p.firstKill) playerFBs[p.name].firstKills++;
      }

      // Infer first deaths: if an opponent got firstKill, one of our players died first.
      // We can approximate by checking which player has deaths in rounds where opponent got FB.
      // The player with the most deaths in FB-lost rounds is likely the frequent first death.
      if (oppGotFB) {
        // Find team players who died this round (deaths > 0) - the first death is
        // most likely the player who died, and in rounds with an opp FK there's always one
        const deadPlayers = round.players.filter(p => p.deaths > 0);
        if (deadPlayers.length > 0) {
          // Attribute first death to a random dead player (best approximation without firstDeath field)
          const fdPlayer = deadPlayers[0];
          if (playerFBs[fdPlayer.name]) {
            playerFBs[fdPlayer.name].firstDeaths++;
          }
        }
      }
    }
  }

  // If no first blood data exists at all, the API likely doesn't support it
  if (teamFBs === 0 && oppFBs === 0 && totalRounds > 5) return null;

  const playerArray = Object.entries(playerFBs)
    .map(([name, data]) => ({
      name,
      firstKills: data.firstKills,
      firstDeaths: data.firstDeaths,
      rounds: data.rounds,
      fbRate: data.rounds > 0 ? (data.firstKills / data.rounds * 100) : 0,
      fdRate: data.rounds > 0 ? (data.firstDeaths / data.rounds * 100) : 0,
    }))
    .sort((a, b) => b.firstKills - a.firstKills);

  return {
    teamFBRate: totalRounds > 0 ? (teamFBs / totalRounds * 100) : 0,
    fbConversionRate: teamFBs > 0 ? (fbWins / teamFBs * 100) : 0,
    fbChokeRate: teamFBs > 0 ? (fbLosses / teamFBs * 100) : 0,
    teamFBs,
    oppFBs,
    fbWins,
    fbLosses,
    totalRounds,
    players: playerArray,
  };
}

// Analyze first blood trends: per-player, per-agent, per-map, per-side
// Produces insights like "bang gets 75% of first bloods on Jett on Bind"
export function analyzeFirstBloodTrends(allGameData) {
  // Build a lookup: playerId -> agent for each game
  // key: "playerName|agent|map" -> { firstKills, rounds, side: { attacker: {fk, rounds}, defender: {fk, rounds} } }
  const trends = {};
  // Also track per-player-agent (across all maps)
  const playerAgentFBs = {};
  let hasData = false;

  for (const game of allGameData) {
    const map = game.map;
    // Build player ID -> agent lookup for this game
    const agentLookup = {};
    for (const a of game.agents) {
      agentLookup[a.id] = a.agent;
    }

    for (const round of game.rounds) {
      for (const p of round.players) {
        const agent = agentLookup[p.id] || 'unknown';
        const key = `${p.name}|${agent}|${map}`;

        if (!trends[key]) {
          trends[key] = {
            player: p.name,
            agent,
            map,
            firstKills: 0,
            rounds: 0,
            attacker: { firstKills: 0, rounds: 0 },
            defender: { firstKills: 0, rounds: 0 },
          };
        }
        const t = trends[key];
        t.rounds++;
        if (p.firstKill) { t.firstKills++; hasData = true; }
        if (round.side === 'attacker') {
          t.attacker.rounds++;
          if (p.firstKill) t.attacker.firstKills++;
        } else if (round.side === 'defender') {
          t.defender.rounds++;
          if (p.firstKill) t.defender.firstKills++;
        }

        // Also track player+agent across all maps
        const paKey = `${p.name}|${agent}`;
        if (!playerAgentFBs[paKey]) {
          playerAgentFBs[paKey] = { player: p.name, agent, firstKills: 0, rounds: 0 };
        }
        playerAgentFBs[paKey].rounds++;
        if (p.firstKill) playerAgentFBs[paKey].firstKills++;
      }
    }
  }

  if (!hasData) return null;

  // Convert to sorted arrays and compute rates
  const trendArray = Object.values(trends)
    .map(t => ({
      ...t,
      fbRate: t.rounds > 0 ? (t.firstKills / t.rounds * 100) : 0,
      attackFBRate: t.attacker.rounds > 0 ? (t.attacker.firstKills / t.attacker.rounds * 100) : 0,
      defenseFBRate: t.defender.rounds > 0 ? (t.defender.firstKills / t.defender.rounds * 100) : 0,
    }))
    .filter(t => t.firstKills > 0 && t.rounds >= 4) // Minimum sample size
    .sort((a, b) => b.fbRate - a.fbRate);

  const playerAgentArray = Object.values(playerAgentFBs)
    .map(pa => ({
      ...pa,
      fbRate: pa.rounds > 0 ? (pa.firstKills / pa.rounds * 100) : 0,
    }))
    .filter(pa => pa.firstKills > 0)
    .sort((a, b) => b.fbRate - a.fbRate);

  return {
    trends: trendArray,
    playerAgentSummary: playerAgentArray,
  };
}

// Infer round win conditions from kill data
// Uses death counts to determine: elimination, detonation, defuse/time
export function analyzeWinTypes(allGameData) {
  const wins = { elimination: 0, spike: 0, other: 0 };
  const losses = { eliminated: 0, spike: 0, other: 0 };
  const attackWins = { elimination: 0, spike: 0, other: 0 };
  const defenseWins = { elimination: 0, spike: 0, other: 0 };
  let totalWins = 0;
  let totalLosses = 0;

  for (const game of allGameData) {
    for (const round of game.rounds) {
      const oppDeaths = round.oppPlayers.reduce((sum, p) => sum + (p.deaths || 0), 0);
      const teamDeaths = round.players.reduce((sum, p) => sum + (p.deaths || 0), 0);

      if (round.won) {
        totalWins++;
        if (oppDeaths >= 5) {
          wins.elimination++;
          if (round.side === 'attacker') attackWins.elimination++;
          else defenseWins.elimination++;
        } else {
          // Team won without wiping opponents: spike detonation (attack) or defuse/time (defense)
          wins.spike++;
          if (round.side === 'attacker') attackWins.spike++;
          else defenseWins.spike++;
        }
      } else {
        totalLosses++;
        if (teamDeaths >= 5) {
          losses.eliminated++;
        } else {
          // Lost without full wipe: opponent spike (defense) or opponent defuse/time (attack)
          losses.spike++;
        }
      }
    }
  }

  if (totalWins + totalLosses === 0) return null;

  return {
    wins,
    losses,
    attackWins,
    defenseWins,
    totalWins,
    totalLosses,
  };
}

// Infer economy phases from round win/loss sequences
// Classifies rounds as: pistol, eco (after 1 loss), force (after 2 losses), full buy
export function analyzeEconomy(allGameData) {
  const economy = {
    pistol: { wins: 0, total: 0 },
    eco: { wins: 0, total: 0 },
    forceBuy: { wins: 0, total: 0 },
    fullBuy: { wins: 0, total: 0 },
  };

  for (const game of allGameData) {
    const rounds = [...game.rounds].sort((a, b) => a.roundNum - b.roundNum);
    let lossStreak = 0;

    for (const round of rounds) {
      const isPistol = round.roundNum === 1 || round.roundNum === 13;

      if (isPistol) {
        lossStreak = 0; // Economy resets at half
        economy.pistol.total++;
        if (round.won) economy.pistol.wins++;
        lossStreak = round.won ? 0 : 1;
        continue;
      }

      // Classify based on consecutive losses entering this round
      if (lossStreak === 0) {
        // Won last round = full buy
        economy.fullBuy.total++;
        if (round.won) economy.fullBuy.wins++;
      } else if (lossStreak === 1) {
        // 1 loss = likely eco/save round
        economy.eco.total++;
        if (round.won) economy.eco.wins++;
      } else if (lossStreak === 2) {
        // 2 losses = likely force buy (some loss bonus accumulated)
        economy.forceBuy.total++;
        if (round.won) economy.forceBuy.wins++;
      } else {
        // 3+ losses = max loss bonus, can afford a decent buy
        economy.fullBuy.total++;
        if (round.won) economy.fullBuy.wins++;
      }

      lossStreak = round.won ? 0 : lossStreak + 1;
    }
  }

  return economy;
}

// Analyze momentum: streaks, post-pistol performance, comebacks, half splits
export function analyzeMomentum(allGameData) {
  let maxWinStreak = 0;
  let maxLossStreak = 0;

  // Post-pistol: rounds 2-3 after winning/losing pistol
  const postPistolWin = { wins: 0, total: 0 };
  const postPistolLoss = { wins: 0, total: 0 };

  // First half (rounds 1-12) vs second half (rounds 13+)
  const firstHalf = { wins: 0, total: 0 };
  const secondHalf = { wins: 0, total: 0 };

  // Comeback tracking
  let comebacks = 0;
  let behindAtHalf = 0;
  let gamesAnalyzed = 0;

  for (const game of allGameData) {
    const rounds = [...game.rounds].sort((a, b) => a.roundNum - b.roundNum);
    let currentStreak = 0;
    let firstHalfWins = 0;
    let firstHalfTotal = 0;

    for (const round of rounds) {
      // Streak tracking
      if (round.won) {
        currentStreak = currentStreak > 0 ? currentStreak + 1 : 1;
      } else {
        currentStreak = currentStreak < 0 ? currentStreak - 1 : -1;
      }
      if (currentStreak > 0) maxWinStreak = Math.max(maxWinStreak, currentStreak);
      if (currentStreak < 0) maxLossStreak = Math.max(maxLossStreak, Math.abs(currentStreak));

      // Half tracking
      if (round.roundNum <= 12) {
        firstHalf.total++;
        firstHalfTotal++;
        if (round.won) { firstHalf.wins++; firstHalfWins++; }
      } else {
        secondHalf.total++;
        if (round.won) secondHalf.wins++;
      }

      // Post-pistol (rounds 2-3 after each pistol)
      if (round.roundNum === 2 || round.roundNum === 3) {
        const pistol = rounds.find(r => r.roundNum === 1);
        if (pistol?.won) {
          postPistolWin.total++;
          if (round.won) postPistolWin.wins++;
        } else if (pistol) {
          postPistolLoss.total++;
          if (round.won) postPistolLoss.wins++;
        }
      } else if (round.roundNum === 14 || round.roundNum === 15) {
        const pistol = rounds.find(r => r.roundNum === 13);
        if (pistol?.won) {
          postPistolWin.total++;
          if (round.won) postPistolWin.wins++;
        } else if (pistol) {
          postPistolLoss.total++;
          if (round.won) postPistolLoss.wins++;
        }
      }
    }

    // Comeback: was the team losing at halftime but won the map?
    if (firstHalfTotal > 0) {
      gamesAnalyzed++;
      const oppFirstHalfWins = firstHalfTotal - firstHalfWins;
      if (firstHalfWins < oppFirstHalfWins) {
        behindAtHalf++;
        if (game.won) comebacks++;
      }
    }
  }

  return {
    maxWinStreak,
    maxLossStreak,
    postPistolWin,
    postPistolLoss,
    firstHalf,
    secondHalf,
    comebacks,
    behindAtHalf,
    gamesAnalyzed,
  };
}
