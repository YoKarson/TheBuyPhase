import { useState, useEffect } from 'react';
import { getTeamAllSeries } from '../api/centralData';
import { getTeamStatistics, getPlayerStatistics, getTeamPlayers, fetchAllSeriesData, aggregateMapPool, analyzeRounds, analyzeAgents } from '../api/statisticsData';
import { getCached, setCache } from '../api/cache';

export default function ScoutingReport({ team, onBack }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [teamStats, setTeamStats] = useState(null);
  const [mapPool, setMapPool] = useState([]);
  const [roundAnalysis, setRoundAnalysis] = useState(null);
  const [agentData, setAgentData] = useState(null);
  const [playerStats, setPlayerStats] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      if (!team?.id) {
        setError('No team selected');
        setLoading(false);
        return;
      }

      // Check cache first
      const cacheKey = `team_${team.id}`;
      const cached = getCached(cacheKey);

      if (cached) {
        console.log(`Loaded ${team.name} from cache`);
        setTeamStats(cached.teamStats);
        setMapPool(cached.mapPool);
        setRoundAnalysis(cached.roundAnalysis);
        setAgentData(cached.agentData);
        setPlayerStats(cached.playerStats);
        setFromCache(true);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Step 1: Get team stats
        setLoadingStatus('Fetching team statistics...');
        const stats = await getTeamStatistics(team.id);
        if (cancelled) return;
        setTeamStats(stats);

        // Step 2: Get all series this team played
        setLoadingStatus('Finding Stage 1 matches...');
        const allSeries = await getTeamAllSeries(team.id);
        if (cancelled) return;

        let mapData = [];
        let rounds = null;
        let allPlayerStats = [];

        if (allSeries.length > 0) {
          // Step 3: Fetch detailed data from all series (map, agents, rounds)
          setLoadingStatus(`Analyzing ${allSeries.length} series...`);
          const allGameData = await fetchAllSeriesData(allSeries, team.id);
          if (cancelled) return;

          // Process map pool and round analysis from the fetched data
          mapData = aggregateMapPool(allGameData);
          setMapPool(mapData);

          rounds = analyzeRounds(allGameData);
          setRoundAnalysis(rounds);

          const agents = analyzeAgents(allGameData);
          setAgentData(agents);

          // Step 4: Get players from most recent series
          setLoadingStatus('Loading player data...');
          const players = await getTeamPlayers(allSeries[0].id, team.id);
          if (cancelled) return;

          // Pause before fetching player stats to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Fetch player stats sequentially with delay to avoid rate limiting
          for (const player of players) {
            if (cancelled) return;
            setLoadingStatus(`Loading stats for ${player.name}...`);
            try {
              // Check player cache first
              const playerCacheKey = `player_${player.id}`;
              let pStats = getCached(playerCacheKey);

              if (!pStats) {
                // Longer delay between requests to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1500));
                if (cancelled) return;
                pStats = await getPlayerStatistics(player.id);
                setCache(playerCacheKey, pStats);
              }

              allPlayerStats.push({ ...player, stats: pStats });
            } catch (err) {
              console.warn(`Failed to get stats for ${player.name}:`, err.message);
            }
          }
          setPlayerStats(allPlayerStats);
        }

        if (cancelled) return;

        // Save to cache
        setCache(cacheKey, {
          teamStats: stats,
          mapPool: mapData,
          roundAnalysis: rounds,
          agentData: agents,
          playerStats: allPlayerStats,
        });
        console.log(`Cached ${team.name} scouting data`);

        setLoadingStatus('');
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to fetch scouting data:', err);
        setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [team]);

  if (loading) {
    return (
      <div className="scouting-report">
        <button className="back-btn" onClick={onBack}>Back</button>
        <div className="loading-state">
          <p>Loading scouting data for {cleanName(team?.name)}...</p>
          <p className="loading-sub">{loadingStatus}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="scouting-report">
        <button className="back-btn" onClick={onBack}>Back</button>
        <div className="error">
          <h2>Error loading data</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // Extract team stats
  const seriesPlayed = teamStats?.series?.count || 0;
  const gamesPlayed = teamStats?.game?.count || 0;
  const winsData = teamStats?.game?.wins?.find(w => w.value === true) || {};
  const gamesWon = winsData.count || 0;
  const winPercentage = winsData.percentage || 0;
  const totalKills = teamStats?.series?.kills?.sum || 0;
  const roundSegment = teamStats?.segment?.find(s => s.type === 'round') || {};
  const totalDeaths = roundSegment.deaths?.sum || 0;
  const teamKD = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : '0';

  // Process player stats
  const processedPlayers = playerStats.map(p => {
    const kills = p.stats?.series?.kills?.sum || 0;
    const segment = p.stats?.segment?.find(s => s.type === 'round') || {};
    const deaths = segment.deaths?.sum || 0;
    const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);
    const avgKills = p.stats?.series?.kills?.avg?.toFixed(1) || '0';

    return { name: p.name, kills, deaths, kd, avgKills };
  }).sort((a, b) => b.kills - a.kills);

  // Find best and worst maps
  const bestMap = mapPool.find(m => m.played >= 2 && Number(m.winRate) >= 60);
  const worstMap = [...mapPool].reverse().find(m => m.played >= 2 && Number(m.winRate) <= 40);

  return (
    <div className="scouting-report">
      <button className="back-btn" onClick={onBack}>Back to Teams</button>

      <header className="report-header">
        <div className="report-team-header">
          {team.logoUrl && <img src={team.logoUrl} alt={team.name} className="report-team-logo" />}
          <div>
            <h1>Scouting Report</h1>
            <h2>{cleanName(team.name)}</h2>
          </div>
        </div>
        <p className="series-info">
          Data from VCT Americas 2024 Stage 1 ({seriesPlayed} series analyzed)
          {fromCache && <span className="cache-badge">Cached</span>}
        </p>
      </header>

      {/* How to Win - Auto-generated Insights */}
      {roundAnalysis && (
        <section className="metrics-section how-to-win">
          <h3>How to Beat {cleanName(team.name)}</h3>
          <div className="how-to-win-list">
            {generateInsights(team, roundAnalysis, mapPool, processedPlayers, agentData)}
          </div>
        </section>
      )}

      {/* Team Overview */}
      <section className="metrics-section">
        <h3>Team Overview (Stage 1)</h3>
        <div className="metrics-grid">
          <MetricCard label="Series Played" value={seriesPlayed} />
          <MetricCard label="Maps Played" value={gamesPlayed} />
          <MetricCard
            label="Map Record"
            value={`${gamesWon}-${gamesPlayed - gamesWon}`}
            sublabel={`${winPercentage.toFixed(0)}% win rate`}
          />
          <MetricCard label="Team K/D" value={teamKD} />
        </div>
      </section>

      {/* Attack/Defense Split */}
      {roundAnalysis && (
        <section className="metrics-section">
          <h3>Round Analysis</h3>
          <div className="metrics-grid">
            <MetricCard
              label="Attack Win Rate"
              value={`${roundAnalysis.attack.total > 0 ? (roundAnalysis.attack.wins / roundAnalysis.attack.total * 100).toFixed(0) : 0}%`}
              sublabel={`${roundAnalysis.attack.wins}W - ${roundAnalysis.attack.total - roundAnalysis.attack.wins}L`}
            />
            <MetricCard
              label="Defense Win Rate"
              value={`${roundAnalysis.defense.total > 0 ? (roundAnalysis.defense.wins / roundAnalysis.defense.total * 100).toFixed(0) : 0}%`}
              sublabel={`${roundAnalysis.defense.wins}W - ${roundAnalysis.defense.total - roundAnalysis.defense.wins}L`}
            />
            <MetricCard
              label="Pistol (Attack)"
              value={`${roundAnalysis.pistol.attack.total > 0 ? (roundAnalysis.pistol.attack.wins / roundAnalysis.pistol.attack.total * 100).toFixed(0) : 0}%`}
              sublabel={`${roundAnalysis.pistol.attack.wins}/${roundAnalysis.pistol.attack.total} won`}
            />
            <MetricCard
              label="Pistol (Defense)"
              value={`${roundAnalysis.pistol.defense.total > 0 ? (roundAnalysis.pistol.defense.wins / roundAnalysis.pistol.defense.total * 100).toFixed(0) : 0}%`}
              sublabel={`${roundAnalysis.pistol.defense.wins}/${roundAnalysis.pistol.defense.total} won`}
            />
          </div>
          {roundAnalysis.attack.total > 0 && roundAnalysis.defense.total > 0 && (() => {
            const atkRate = roundAnalysis.attack.wins / roundAnalysis.attack.total * 100;
            const defRate = roundAnalysis.defense.wins / roundAnalysis.defense.total * 100;
            const diff = Math.abs(atkRate - defRate);
            if (diff > 10) {
              const stronger = atkRate > defRate ? 'attack' : 'defense';
              const weaker = stronger === 'attack' ? 'defense' : 'attack';
              return (
                <div className="insight-box">
                  <p><strong>Side Tendency:</strong> Significantly stronger on {stronger} ({Math.max(atkRate, defRate).toFixed(0)}% vs {Math.min(atkRate, defRate).toFixed(0)}%). Look to exploit their {weaker} side.</p>
                </div>
              );
            }
            return null;
          })()}
          {(roundAnalysis.pistol.attack.total + roundAnalysis.pistol.defense.total > 0) && (() => {
            const totalPistol = roundAnalysis.pistol.attack.total + roundAnalysis.pistol.defense.total;
            const totalPistolWins = roundAnalysis.pistol.attack.wins + roundAnalysis.pistol.defense.wins;
            const pistolRate = (totalPistolWins / totalPistol * 100).toFixed(0);
            if (pistolRate <= 40) {
              return (
                <div className="insight-box warning">
                  <p><strong>Pistol Weakness:</strong> Only {pistolRate}% pistol round win rate ({totalPistolWins}/{totalPistol}). Focus on winning pistols for early-half momentum.</p>
                </div>
              );
            }
            return null;
          })()}
        </section>
      )}

      {/* Map Pool Analysis */}
      <section className="metrics-section">
        <h3>Map Pool Analysis</h3>
        {mapPool.length > 0 ? (
          <>
            <div className="map-pool-grid">
              {mapPool.map(map => (
                <div key={map.map} className={`map-card ${getMapClass(map.winRate, map.played)}`}>
                  <div className="map-name">{map.map}</div>
                  <div className="map-record">{map.wins}W - {map.losses}L ({map.played} played)</div>
                  <div className="map-winrate">{map.winRate}%</div>
                  <div className="map-rounds">Round Diff: {map.roundDiff > 0 ? '+' : ''}{map.roundDiff}</div>
                </div>
              ))}
            </div>
            {(bestMap || worstMap) && (
              <div className="map-insights">
                {bestMap && (
                  <div className="insight-box">
                    <p><strong>Strong Map:</strong> {bestMap.map} ({bestMap.winRate}% WR over {bestMap.played} games) - Consider banning</p>
                  </div>
                )}
                {worstMap && (
                  <div className="insight-box warning">
                    <p><strong>Weak Map:</strong> {worstMap.map} ({worstMap.winRate}% WR over {worstMap.played} games) - Target this map</p>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <p>No map data available</p>
        )}
      </section>

      {/* Agent Compositions */}
      {agentData && (
        <section className="metrics-section">
          <h3>Compositions & Agent Pools</h3>
          {agentData.compositions.length > 0 && (
            <>
              <h4>Team Compositions</h4>
              <table className="player-table">
                <thead>
                  <tr>
                    <th>Composition</th>
                    <th>Played</th>
                    <th>Win Rate</th>
                    <th>Maps</th>
                  </tr>
                </thead>
                <tbody>
                  {agentData.compositions.map(comp => (
                    <tr key={comp.agents}>
                      <td className="comp-agents">{comp.agents}</td>
                      <td>{comp.count}</td>
                      <td className={Number(comp.winRate) >= 50 ? 'stat-high' : 'stat-low'}>
                        {comp.winRate}%
                      </td>
                      <td>{Object.entries(comp.maps).map(([m, c]) => `${m} (${c})`).join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {agentData.playerAgents.length > 0 && (
            <>
              <h4>Player Agent Pools</h4>
              <div className="agent-pools">
                {agentData.playerAgents.map(p => (
                  <div key={p.name} className="agent-pool-card">
                    <div className="agent-pool-name">{p.name}</div>
                    <div className="agent-pool-list">
                      {p.agents.map(a => (
                        <span key={a.agent} className="agent-tag">
                          {a.agent} ({a.count})
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Player Performance */}
      <section className="metrics-section">
        <h3>Player Performance (Stage 1)</h3>
        {processedPlayers.length > 0 ? (
          <table className="player-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Kills</th>
                <th>Deaths</th>
                <th>K/D</th>
                <th>Avg K/Series</th>
              </tr>
            </thead>
            <tbody>
              {processedPlayers.map(player => (
                <tr key={player.name}>
                  <td className="player-name">{player.name}</td>
                  <td>{player.kills}</td>
                  <td>{player.deaths}</td>
                  <td className={parseFloat(player.kd) < 1 ? 'stat-low' : 'stat-high'}>
                    {player.kd}
                  </td>
                  <td>{player.avgKills}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No player data available</p>
        )}

        {processedPlayers.some(p => parseFloat(p.kd) < 0.9) && (
          <div className="insight-box warning">
            <p><strong>Targetable Players:</strong></p>
            {processedPlayers
              .filter(p => parseFloat(p.kd) < 0.9)
              .map(p => (
                <p key={p.name}>• {p.name} ({p.kd} K/D) - Look to trade against</p>
              ))}
          </div>
        )}
      </section>

    </div>
  );
}

function MetricCard({ label, value, sublabel }) {
  return (
    <div className="metric-card">
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
      {sublabel && <div className="metric-sublabel">{sublabel}</div>}
    </div>
  );
}

function generateInsights(team, roundAnalysis, mapPool, players, agentData) {
  const insights = [];
  const teamName = cleanName(team.name);

  // 1. Side weakness
  if (roundAnalysis.attack.total > 0 && roundAnalysis.defense.total > 0) {
    const atkRate = roundAnalysis.attack.wins / roundAnalysis.attack.total * 100;
    const defRate = roundAnalysis.defense.wins / roundAnalysis.defense.total * 100;
    if (Math.abs(atkRate - defRate) > 8) {
      const weak = atkRate < defRate ? 'attack' : 'defense';
      const weakRate = Math.min(atkRate, defRate).toFixed(0);
      insights.push(
        <div key="side" className="insight-bullet">
          <span className="insight-icon">&#9876;</span>
          <p>{teamName} is weaker on <strong>{weak}</strong> ({weakRate}% round win rate). Force them to play {weak} side as much as possible.</p>
        </div>
      );
    }
  }

  // 2. Pistol round vulnerability
  const totalPistol = roundAnalysis.pistol.attack.total + roundAnalysis.pistol.defense.total;
  const totalPistolWins = roundAnalysis.pistol.attack.wins + roundAnalysis.pistol.defense.wins;
  if (totalPistol >= 2) {
    const pistolRate = (totalPistolWins / totalPistol * 100).toFixed(0);
    if (pistolRate <= 50) {
      insights.push(
        <div key="pistol" className="insight-bullet">
          <span className="insight-icon">&#9733;</span>
          <p>Pistol rounds are exploitable — {teamName} only wins <strong>{pistolRate}%</strong> ({totalPistolWins}/{totalPistol}). Prioritize pistol round execution for early-half economy advantage.</p>
        </div>
      );
    }
  }

  // 3. Weak map to target
  const weakMaps = mapPool.filter(m => m.played >= 2 && Number(m.winRate) <= 40);
  if (weakMaps.length > 0) {
    const worst = weakMaps[weakMaps.length - 1];
    insights.push(
      <div key="map" className="insight-bullet">
        <span className="insight-icon">&#9881;</span>
        <p>Target <strong>{worst.map}</strong> in map veto — {teamName} has a {worst.winRate}% win rate ({worst.wins}W-{worst.losses}L) with a round differential of {worst.roundDiff}.</p>
      </div>
    );
  }

  // 4. Strong map to ban
  const strongMaps = mapPool.filter(m => m.played >= 2 && Number(m.winRate) >= 60);
  if (strongMaps.length > 0) {
    const best = strongMaps[0];
    insights.push(
      <div key="ban" className="insight-bullet">
        <span className="insight-icon">&#128683;</span>
        <p>Consider banning <strong>{best.map}</strong> — {teamName} has a {best.winRate}% win rate across {best.played} games.</p>
      </div>
    );
  }

  // 5. Targetable player
  const weakPlayers = players.filter(p => parseFloat(p.kd) < 0.9);
  if (weakPlayers.length > 0) {
    const weakest = weakPlayers.sort((a, b) => parseFloat(a.kd) - parseFloat(b.kd))[0];
    insights.push(
      <div key="player" className="insight-bullet">
        <span className="insight-icon">&#127919;</span>
        <p>Look to trade against <strong>{weakest.name}</strong> ({weakest.kd} K/D). Isolating duels against this player gives a statistical advantage.</p>
      </div>
    );
  }

  // 6. One-trick agent pool
  if (agentData?.playerAgents) {
    const oneTricks = agentData.playerAgents.filter(p => {
      if (p.agents.length <= 1) return false;
      const totalGames = p.agents.reduce((sum, a) => sum + a.count, 0);
      return totalGames >= 3 && (p.agents[0].count / totalGames) >= 0.8;
    });
    if (oneTricks.length > 0) {
      const p = oneTricks[0];
      insights.push(
        <div key="agent" className="insight-bullet">
          <span className="insight-icon">&#128373;</span>
          <p><strong>{p.name}</strong> plays {p.agents[0].agent} in {((p.agents[0].count / p.agents.reduce((s, a) => s + a.count, 0)) * 100).toFixed(0)}% of maps. Prepare counter-strategies specifically for this agent.</p>
        </div>
      );
    }
  }

  if (insights.length === 0) {
    insights.push(
      <div key="none" className="insight-bullet">
        <span className="insight-icon">&#128200;</span>
        <p>No major exploitable patterns detected. {teamName} plays consistently across sides and maps.</p>
      </div>
    );
  }

  return insights;
}

function cleanName(name) {
  if (!name) return 'Unknown';
  return name.replace(/\s*\(\d+\)\s*$/, '').trim();
}

function getMapClass(winRate, played) {
  if (played < 2) return 'map-neutral'; // Not enough data
  const rate = Number(winRate);
  if (rate >= 60) return 'map-strong';
  if (rate <= 40) return 'map-weak';
  return 'map-neutral';
}
