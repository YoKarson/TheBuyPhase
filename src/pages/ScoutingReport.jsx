import { useState, useEffect } from 'react';
import { getTeamAllSeries } from '../api/centralData';
import { getTeamStatistics, getPlayerStatistics, getTeamPlayers, fetchAllSeriesData, aggregateMapPool, analyzeRounds, analyzeAgents, analyzeFirstBloods, analyzeFirstBloodTrends, analyzeWinTypes, analyzeEconomy, analyzeMomentum } from '../api/statisticsData';
import { getCached, setCache } from '../api/cache';

export default function ScoutingReport({ team, onBack }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [teamStats, setTeamStats] = useState(null);
  const [mapPool, setMapPool] = useState([]);
  const [roundAnalysis, setRoundAnalysis] = useState(null);
  const [agentData, setAgentData] = useState(null);
  const [playerStats, setPlayerStats] = useState([]);
  const [firstBloodData, setFirstBloodData] = useState(null);
  const [fbTrends, setFbTrends] = useState(null);
  const [winTypeData, setWinTypeData] = useState(null);
  const [economyData, setEconomyData] = useState(null);
  const [momentumData, setMomentumData] = useState(null);
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
        setFirstBloodData(cached.firstBloodData || null);
        setFbTrends(cached.fbTrends || null);
        setWinTypeData(cached.winTypeData || null);
        setEconomyData(cached.economyData || null);
        setMomentumData(cached.momentumData || null);
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
        let agents = null;
        let fbData = null;
        let fbTrendData = null;
        let wtData = null;
        let econData = null;
        let momData = null;
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

          agents = analyzeAgents(allGameData);
          setAgentData(agents);

          // New analyses
          setLoadingStatus('Analyzing first bloods & economy...');
          fbData = analyzeFirstBloods(allGameData);
          setFirstBloodData(fbData);

          fbTrendData = analyzeFirstBloodTrends(allGameData);
          setFbTrends(fbTrendData);

          wtData = analyzeWinTypes(allGameData);
          setWinTypeData(wtData);

          econData = analyzeEconomy(allGameData);
          setEconomyData(econData);

          momData = analyzeMomentum(allGameData);
          setMomentumData(momData);

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
          firstBloodData: fbData,
          fbTrends: fbTrendData,
          winTypeData: wtData,
          economyData: econData,
          momentumData: momData,
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
            {generateInsights(team, roundAnalysis, mapPool, processedPlayers, agentData, firstBloodData, winTypeData, economyData, momentumData)}
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

      {/* First Blood Analysis */}
      {firstBloodData && (
        <section className="metrics-section">
          <h3>First Blood Analysis</h3>
          <div className="metrics-grid">
            <MetricCard
              label="Team FB Rate"
              value={`${firstBloodData.teamFBRate.toFixed(0)}%`}
              sublabel={`${firstBloodData.teamFBs}/${firstBloodData.totalRounds} rounds`}
            />
            <MetricCard
              label="FB Conversion"
              value={`${firstBloodData.fbConversionRate.toFixed(0)}%`}
              sublabel={`Win ${firstBloodData.fbWins}/${firstBloodData.teamFBs} after FB`}
            />
            <MetricCard
              label="FB Choke Rate"
              value={`${firstBloodData.fbChokeRate.toFixed(0)}%`}
              sublabel={`Lose ${firstBloodData.fbLosses} rounds after getting FB`}
            />
            <MetricCard
              label="Opp FB Rate"
              value={`${firstBloodData.totalRounds > 0 ? (firstBloodData.oppFBs / firstBloodData.totalRounds * 100).toFixed(0) : 0}%`}
              sublabel={`Opponent gets FB ${firstBloodData.oppFBs} times`}
            />
          </div>
          {firstBloodData.players.length > 0 && (
            <>
              <h4>Player First Blood Stats</h4>
              <table className="player-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>First Kills</th>
                    <th>First Deaths*</th>
                    <th>FK Rate</th>
                    <th>FD Rate*</th>
                  </tr>
                </thead>
                <tbody>
                  {firstBloodData.players.map(p => (
                    <tr key={p.name}>
                      <td className="player-name">{p.name}</td>
                      <td>{p.firstKills}</td>
                      <td>{p.firstDeaths}</td>
                      <td className={p.fbRate >= 20 ? 'stat-high' : ''}>{p.fbRate.toFixed(0)}%</td>
                      <td className={p.fdRate >= 25 ? 'stat-low' : ''}>{p.fdRate.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {firstBloodData.fbChokeRate >= 30 && (
            <div className="insight-box warning">
              <p><strong>First Blood Vulnerability:</strong> {cleanName(team.name)} loses {firstBloodData.fbChokeRate.toFixed(0)}% of rounds where they get first blood. They struggle to convert opening picks into round wins.</p>
            </div>
          )}
        </section>
      )}

      {/* First Blood Trends - per player/agent/map */}
      {fbTrends && fbTrends.trends.length > 0 && (
        <section className="metrics-section">
          <h3>First Blood Tendencies</h3>
          <p className="section-desc-sm">Which players get opening kills, on which agents, on which maps.</p>
          <div className="fb-trends">
            {fbTrends.trends.slice(0, 8).map((t, i) => (
              <div key={i} className="fb-trend-card">
                <div className="fb-trend-header">
                  <span className="fb-trend-player">{t.player}</span>
                  <span className="fb-trend-rate">{t.fbRate.toFixed(0)}% FK rate</span>
                </div>
                <div className="fb-trend-details">
                  <span className="fb-trend-agent">{t.agent}</span>
                  <span className="fb-trend-map">{t.map}</span>
                </div>
                <div className="fb-trend-bar-track">
                  <div className="fb-trend-bar-fill" style={{ width: `${t.fbRate}%` }} />
                </div>
                <div className="fb-trend-sides">
                  <span>ATK: {t.attackFBRate.toFixed(0)}% ({t.attacker.firstKills}/{t.attacker.rounds})</span>
                  <span>DEF: {t.defenseFBRate.toFixed(0)}% ({t.defender.firstKills}/{t.defender.rounds})</span>
                </div>
                <div className="fb-trend-sample">{t.firstKills} FKs in {t.rounds} rounds</div>
              </div>
            ))}
          </div>
          {/* Auto-generated trend insights */}
          {fbTrends.trends.length > 0 && (() => {
            const top = fbTrends.trends[0];
            if (top.fbRate >= 25) {
              return (
                <div className="insight-box">
                  <p><strong>Key First Blood Threat:</strong> <strong>{top.player}</strong> on {top.agent} ({top.map}) gets the opening kill in {top.fbRate.toFixed(0)}% of rounds ({top.firstKills}/{top.rounds}). Expect aggressive early-round plays from this player on this map.</p>
                </div>
              );
            }
            return null;
          })()}
          {fbTrends.trends.some(t => t.defenseFBRate >= 30 && t.defender.rounds >= 3) && (() => {
            const aggDef = fbTrends.trends.find(t => t.defenseFBRate >= 30 && t.defender.rounds >= 3);
            return (
              <div className="insight-box warning">
                <p><strong>Aggressive Defender:</strong> <strong>{aggDef.player}</strong> on {aggDef.agent} pushes for opening kills on defense on {aggDef.map} ({aggDef.defenseFBRate.toFixed(0)}% FK rate, {aggDef.defender.firstKills}/{aggDef.defender.rounds} rounds). Expect early peeks — use utility to punish.</p>
              </div>
            );
          })()}
        </section>
      )}

      {/* Round Win Conditions */}
      {winTypeData && (
        <section className="metrics-section">
          <h3>Round Win Conditions</h3>
          <div className="win-type-grid">
            <div className="win-type-card">
              <h4>How They Win ({winTypeData.totalWins} rounds)</h4>
              <div className="win-type-bars">
                <WinTypeBar
                  label="Elimination"
                  value={winTypeData.wins.elimination}
                  total={winTypeData.totalWins}
                  color="#50e080"
                />
                <WinTypeBar
                  label="Spike (Plant/Defuse)"
                  value={winTypeData.wins.spike}
                  total={winTypeData.totalWins}
                  color="#00aeef"
                />
              </div>
              <div className="win-type-split">
                <span>Attack: {winTypeData.attackWins.elimination + winTypeData.attackWins.spike} wins ({winTypeData.attackWins.elimination} elim, {winTypeData.attackWins.spike} spike)</span>
                <span>Defense: {winTypeData.defenseWins.elimination + winTypeData.defenseWins.spike} wins ({winTypeData.defenseWins.elimination} elim, {winTypeData.defenseWins.spike} spike)</span>
              </div>
            </div>
            <div className="win-type-card">
              <h4>How They Lose ({winTypeData.totalLosses} rounds)</h4>
              <div className="win-type-bars">
                <WinTypeBar
                  label="Eliminated"
                  value={winTypeData.losses.eliminated}
                  total={winTypeData.totalLosses}
                  color="#ff7070"
                />
                <WinTypeBar
                  label="Spike (Detonation/Defuse)"
                  value={winTypeData.losses.spike}
                  total={winTypeData.totalLosses}
                  color="#ffaa50"
                />
              </div>
            </div>
          </div>
          {winTypeData.totalWins > 0 && (() => {
            const elimPct = (winTypeData.wins.elimination / winTypeData.totalWins * 100);
            if (elimPct >= 65) {
              return (
                <div className="insight-box">
                  <p><strong>Aggressive Playstyle:</strong> {elimPct.toFixed(0)}% of round wins come from full eliminations. This team prefers to take fights rather than play for the spike.</p>
                </div>
              );
            }
            if (elimPct <= 40) {
              return (
                <div className="insight-box">
                  <p><strong>Objective-Focused:</strong> Only {elimPct.toFixed(0)}% of wins from eliminations. This team plays methodically around the spike rather than hunting kills.</p>
                </div>
              );
            }
            return null;
          })()}
        </section>
      )}

      {/* Economy Analysis */}
      {economyData && (
        <section className="metrics-section">
          <h3>Economy Analysis (Inferred)</h3>
          <div className="metrics-grid">
            <MetricCard
              label="Pistol Round"
              value={`${economyData.pistol.total > 0 ? (economyData.pistol.wins / economyData.pistol.total * 100).toFixed(0) : 0}%`}
              sublabel={`${economyData.pistol.wins}/${economyData.pistol.total} won`}
            />
            <MetricCard
              label="Eco Round"
              value={`${economyData.eco.total > 0 ? (economyData.eco.wins / economyData.eco.total * 100).toFixed(0) : 0}%`}
              sublabel={`${economyData.eco.wins}/${economyData.eco.total} won (post-loss)`}
            />
            <MetricCard
              label="Force Buy"
              value={`${economyData.forceBuy.total > 0 ? (economyData.forceBuy.wins / economyData.forceBuy.total * 100).toFixed(0) : 0}%`}
              sublabel={`${economyData.forceBuy.wins}/${economyData.forceBuy.total} won (2 losses)`}
            />
            <MetricCard
              label="Full Buy"
              value={`${economyData.fullBuy.total > 0 ? (economyData.fullBuy.wins / economyData.fullBuy.total * 100).toFixed(0) : 0}%`}
              sublabel={`${economyData.fullBuy.wins}/${economyData.fullBuy.total} won`}
            />
          </div>
          <div className="economy-breakdown">
            <h4>Economy Phase Breakdown</h4>
            <div className="econ-bars">
              {[
                { key: 'pistol', label: 'Pistol', data: economyData.pistol, color: '#a080ff' },
                { key: 'eco', label: 'Eco/Save', data: economyData.eco, color: '#ff7070' },
                { key: 'force', label: 'Force Buy', data: economyData.forceBuy, color: '#ffaa50' },
                { key: 'full', label: 'Full Buy', data: economyData.fullBuy, color: '#50e080' },
              ].map(phase => {
                const winRate = phase.data.total > 0 ? (phase.data.wins / phase.data.total * 100) : 0;
                return (
                  <div key={phase.key} className="econ-bar-row">
                    <span className="econ-bar-label">{phase.label}</span>
                    <div className="econ-bar-track">
                      <div
                        className="econ-bar-fill"
                        style={{ width: `${winRate}%`, background: phase.color }}
                      />
                    </div>
                    <span className="econ-bar-value">{winRate.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
          {economyData.eco.total > 0 && (economyData.eco.wins / economyData.eco.total) >= 0.3 && (
            <div className="insight-box warning">
              <p><strong>Eco Round Threat:</strong> {cleanName(team.name)} wins {(economyData.eco.wins / economyData.eco.total * 100).toFixed(0)}% of eco rounds. Don't underestimate their force buys and eco rushes.</p>
            </div>
          )}
          {economyData.forceBuy.total > 0 && (economyData.forceBuy.wins / economyData.forceBuy.total) >= 0.35 && (
            <div className="insight-box warning">
              <p><strong>Force Buy Specialist:</strong> {(economyData.forceBuy.wins / economyData.forceBuy.total * 100).toFixed(0)}% force buy conversion rate. This team is dangerous even on broken economy.</p>
            </div>
          )}
        </section>
      )}

      {/* Momentum & Tempo */}
      {momentumData && (
        <section className="metrics-section">
          <h3>Momentum & Tempo</h3>
          <div className="metrics-grid">
            <MetricCard
              label="Best Win Streak"
              value={momentumData.maxWinStreak}
              sublabel="consecutive rounds"
            />
            <MetricCard
              label="Worst Loss Streak"
              value={momentumData.maxLossStreak}
              sublabel="consecutive rounds"
            />
            <MetricCard
              label="First Half WR"
              value={`${momentumData.firstHalf.total > 0 ? (momentumData.firstHalf.wins / momentumData.firstHalf.total * 100).toFixed(0) : 0}%`}
              sublabel={`${momentumData.firstHalf.wins}/${momentumData.firstHalf.total} rounds`}
            />
            <MetricCard
              label="Second Half WR"
              value={`${momentumData.secondHalf.total > 0 ? (momentumData.secondHalf.wins / momentumData.secondHalf.total * 100).toFixed(0) : 0}%`}
              sublabel={`${momentumData.secondHalf.wins}/${momentumData.secondHalf.total} rounds`}
            />
          </div>
          <div className="momentum-details">
            <div className="momentum-row">
              <h4>Post-Pistol Performance</h4>
              <div className="momentum-stats">
                <div className="momentum-stat">
                  <span className="momentum-stat-label">After Winning Pistol (Rds 2-3):</span>
                  <span className={`momentum-stat-value ${postPistolRate(momentumData.postPistolWin) >= 60 ? 'stat-high' : postPistolRate(momentumData.postPistolWin) <= 40 ? 'stat-low' : ''}`}>
                    {postPistolRate(momentumData.postPistolWin).toFixed(0)}% WR
                  </span>
                  <span className="momentum-stat-sub">({momentumData.postPistolWin.wins}/{momentumData.postPistolWin.total})</span>
                </div>
                <div className="momentum-stat">
                  <span className="momentum-stat-label">After Losing Pistol (Rds 2-3):</span>
                  <span className={`momentum-stat-value ${postPistolRate(momentumData.postPistolLoss) >= 30 ? 'stat-high' : ''}`}>
                    {postPistolRate(momentumData.postPistolLoss).toFixed(0)}% WR
                  </span>
                  <span className="momentum-stat-sub">({momentumData.postPistolLoss.wins}/{momentumData.postPistolLoss.total})</span>
                </div>
              </div>
            </div>
            {momentumData.behindAtHalf > 0 && (
              <div className="momentum-row">
                <h4>Comeback Factor</h4>
                <p className="momentum-text">
                  Behind at halftime in <strong>{momentumData.behindAtHalf}</strong> of {momentumData.gamesAnalyzed} maps.
                  Came back to win <strong>{momentumData.comebacks}</strong> ({momentumData.behindAtHalf > 0 ? (momentumData.comebacks / momentumData.behindAtHalf * 100).toFixed(0) : 0}%).
                </p>
              </div>
            )}
          </div>
          {momentumData.maxLossStreak >= 5 && (
            <div className="insight-box warning">
              <p><strong>Tilt Prone:</strong> Longest loss streak is {momentumData.maxLossStreak} rounds. Once this team starts losing, they can spiral. Build early momentum and don't let up.</p>
            </div>
          )}
          {(() => {
            const fhRate = momentumData.firstHalf.total > 0 ? momentumData.firstHalf.wins / momentumData.firstHalf.total * 100 : 0;
            const shRate = momentumData.secondHalf.total > 0 ? momentumData.secondHalf.wins / momentumData.secondHalf.total * 100 : 0;
            if (Math.abs(fhRate - shRate) > 10) {
              const strong = fhRate > shRate ? 'first' : 'second';
              const weak = strong === 'first' ? 'second' : 'first';
              return (
                <div className="insight-box">
                  <p><strong>Half Tendency:</strong> Significantly better in the {strong} half ({Math.max(fhRate, shRate).toFixed(0)}% vs {Math.min(fhRate, shRate).toFixed(0)}%). Expect to be tested in the {strong} half and look to punish in the {weak} half.</p>
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

function WinTypeBar({ label, value, total, color }) {
  const pct = total > 0 ? (value / total * 100) : 0;
  return (
    <div className="win-type-bar-row">
      <span className="win-type-bar-label">{label}</span>
      <div className="win-type-bar-track">
        <div className="win-type-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="win-type-bar-value">{value} ({pct.toFixed(0)}%)</span>
    </div>
  );
}

function postPistolRate(data) {
  return data.total > 0 ? (data.wins / data.total * 100) : 0;
}

function generateInsights(team, roundAnalysis, mapPool, players, agentData, firstBloodData, winTypeData, economyData, momentumData) {
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

  // 2. First blood choke
  if (firstBloodData && firstBloodData.fbChokeRate >= 25) {
    insights.push(
      <div key="fb-choke" className="insight-bullet">
        <span className="insight-icon">&#128308;</span>
        <p>{teamName} loses <strong>{firstBloodData.fbChokeRate.toFixed(0)}%</strong> of rounds after getting first blood ({firstBloodData.fbLosses}/{firstBloodData.teamFBs}). They struggle to convert opening picks — play for trades and don't concede after losing a player.</p>
      </div>
    );
  }

  // 3. Pistol round vulnerability
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

  // 4. Economy vulnerability
  if (economyData && economyData.eco.total > 0) {
    const ecoWR = (economyData.eco.wins / economyData.eco.total * 100);
    if (ecoWR >= 30) {
      insights.push(
        <div key="eco" className="insight-bullet">
          <span className="insight-icon">&#128176;</span>
          <p>Dangerous on eco rounds — {teamName} wins <strong>{ecoWR.toFixed(0)}%</strong> of eco/save rounds ({economyData.eco.wins}/{economyData.eco.total}). Stay disciplined and don't give away weapons on anti-eco.</p>
        </div>
      );
    } else if (ecoWR <= 10) {
      insights.push(
        <div key="eco" className="insight-bullet">
          <span className="insight-icon">&#128176;</span>
          <p>Weak eco round play — {teamName} only converts <strong>{ecoWR.toFixed(0)}%</strong> of eco rounds. Winning pistols and forcing their economy will compound your advantage quickly.</p>
        </div>
      );
    }
  }

  // 5. Weak map to target
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

  // 6. Strong map to ban
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

  // 7. Momentum/tilt vulnerability
  if (momentumData && momentumData.maxLossStreak >= 5) {
    insights.push(
      <div key="tilt" className="insight-bullet">
        <span className="insight-icon">&#128168;</span>
        <p>{teamName} is <strong>tilt-prone</strong> — lost {momentumData.maxLossStreak} rounds in a row at their worst. Build early momentum and apply pressure. Once they start losing, they struggle to recover.</p>
      </div>
    );
  }

  // 8. Targetable player (with first death data if available)
  if (firstBloodData) {
    const fdPlayers = firstBloodData.players.filter(p => p.fdRate >= 25 && p.rounds >= 10);
    if (fdPlayers.length > 0) {
      const target = fdPlayers[0];
      insights.push(
        <div key="fd-target" className="insight-bullet">
          <span className="insight-icon">&#127919;</span>
          <p><strong>{target.name}</strong> dies first in {target.fdRate.toFixed(0)}% of rounds ({target.firstDeaths}/{target.rounds}). Pressure this player early to create consistent man-advantage situations.</p>
        </div>
      );
    }
  } else {
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
  }

  // 9. One-trick agent pool
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

  // 10. Playstyle insight from win types
  if (winTypeData && winTypeData.totalWins > 0) {
    const elimPct = (winTypeData.wins.elimination / winTypeData.totalWins * 100);
    if (elimPct >= 65) {
      insights.push(
        <div key="style" className="insight-bullet">
          <span className="insight-icon">&#9888;</span>
          <p>{teamName} wins {elimPct.toFixed(0)}% of rounds by <strong>full elimination</strong>. They rely on aim duels — avoid dry peeks and use utility to deny their aggression.</p>
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
