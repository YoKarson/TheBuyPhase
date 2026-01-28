import { useState, useEffect } from 'react';
import { getTeamSeries, TOURNAMENT_ID } from '../api/centralData';
import { getTeamStatistics, getPlayerStatistics, getTeamPlayers, aggregateMapPool } from '../api/statisticsData';

export default function ScoutingReport({ team, onBack }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [teamStats, setTeamStats] = useState(null);
  const [mapPool, setMapPool] = useState([]);
  const [playerStats, setPlayerStats] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);

  useEffect(() => {
    async function fetchData() {
      if (!team?.id) {
        setError('No team selected');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch team's series in the tournament
        const series = await getTeamSeries(team.id);
        setRecentMatches(series);

        // Fetch team statistics
        const stats = await getTeamStatistics(team.id, TOURNAMENT_ID);
        setTeamStats(stats);

        // Aggregate map pool data from all series
        if (series.length > 0) {
          const mapData = await aggregateMapPool(series, team.id);
          setMapPool(mapData);

          // Get players from first series
          const players = await getTeamPlayers(series[0].id, team.id);

          // Fetch player stats
          const playerStatsPromises = players.map(async (player) => {
            try {
              const pStats = await getPlayerStatistics(player.id, TOURNAMENT_ID);
              return { ...player, stats: pStats };
            } catch {
              return { ...player, stats: null };
            }
          });

          const allPlayerStats = await Promise.all(playerStatsPromises);
          setPlayerStats(allPlayerStats.filter(p => p.stats));
        }
      } catch (err) {
        console.error('Failed to fetch scouting data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [team]);

  if (loading) {
    return (
      <div className="scouting-report">
        <button className="back-btn" onClick={onBack}>Back</button>
        <div className="loading-state">
          <p>Loading scouting data for {team?.name}...</p>
          <p className="loading-sub">Analyzing maps and player performance</p>
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
  const bestMap = mapPool.find(m => m.played > 0 && Number(m.winRate) >= 50);
  const worstMap = [...mapPool].reverse().find(m => m.played > 0 && Number(m.winRate) < 50);

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
        <p className="series-info">VCT Americas Kickoff 2024</p>
      </header>

      {/* Team Overview */}
      <section className="metrics-section">
        <h3>Team Overview</h3>
        <div className="metrics-grid">
          <MetricCard label="Maps Played" value={gamesPlayed} />
          <MetricCard
            label="Map Record"
            value={`${gamesWon}-${gamesPlayed - gamesWon}`}
            sublabel={`${winPercentage.toFixed(0)}% win rate`}
          />
          <MetricCard label="Team K/D" value={teamKD} />
          <MetricCard label="Total Kills" value={totalKills} />
        </div>
      </section>

      {/* Map Pool Analysis */}
      <section className="metrics-section">
        <h3>Map Pool Analysis</h3>
        {mapPool.length > 0 ? (
          <>
            <div className="map-pool-grid">
              {mapPool.map(map => (
                <div key={map.map} className={`map-card ${getMapClass(map.winRate)}`}>
                  <div className="map-name">{map.map}</div>
                  <div className="map-record">{map.wins}W - {map.losses}L</div>
                  <div className="map-winrate">{map.winRate}%</div>
                  <div className="map-rounds">Round Diff: {map.roundDiff > 0 ? '+' : ''}{map.roundDiff}</div>
                </div>
              ))}
            </div>
            {(bestMap || worstMap) && (
              <div className="map-insights">
                {bestMap && (
                  <div className="insight-box">
                    <p><strong>Best Map:</strong> {bestMap.map} ({bestMap.winRate}% WR) - Consider banning this</p>
                  </div>
                )}
                {worstMap && (
                  <div className="insight-box warning">
                    <p><strong>Weak Map:</strong> {worstMap.map} ({worstMap.winRate}% WR) - Target this map</p>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <p>No map data available</p>
        )}
      </section>

      {/* Player Performance */}
      <section className="metrics-section">
        <h3>Player Performance</h3>
        {processedPlayers.length > 0 ? (
          <table className="player-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>K</th>
                <th>D</th>
                <th>K/D</th>
                <th>Avg K</th>
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

        {/* Weak link detection */}
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

      {/* Recent Matches */}
      <section className="metrics-section">
        <h3>Recent Matches</h3>
        <div className="matches-list">
          {recentMatches.map(match => {
            const teamData = match.teams.find(t => t.baseInfo?.id === team.id);
            const opponent = match.teams.find(t => t.baseInfo?.id !== team.id);
            const won = teamData?.scoreAdvantage > opponent?.scoreAdvantage;

            return (
              <div key={match.id} className={`match-result ${won ? 'won' : 'lost'}`}>
                <div className="match-result-teams">
                  <span className="match-result-team">{cleanName(team.name)}</span>
                  <span className="match-result-score">
                    {teamData?.scoreAdvantage || 0} - {opponent?.scoreAdvantage || 0}
                  </span>
                  <span className="match-result-opponent">{cleanName(opponent?.baseInfo?.name)}</span>
                </div>
                <div className="match-result-meta">
                  {new Date(match.startTimeScheduled).toLocaleDateString()}
                </div>
              </div>
            );
          })}
        </div>
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

function cleanName(name) {
  if (!name) return 'Unknown';
  return name.replace(/\s*\(\d+\)\s*$/, '').trim();
}

function getMapClass(winRate) {
  const rate = Number(winRate);
  if (rate >= 60) return 'map-strong';
  if (rate >= 40) return 'map-neutral';
  return 'map-weak';
}
