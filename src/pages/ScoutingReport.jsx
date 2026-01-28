import { useState, useEffect } from 'react';
import { getTeamStatistics, getPlayerStatistics, getTeamPlayers } from '../api/statisticsData';

export default function ScoutingReport({ seriesId, opponent, opponentTeamId, tournamentId, onBack }) {
  const [teamStats, setTeamStats] = useState(null);
  const [playerStats, setPlayerStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cleanName = (name) => {
    if (!name) return 'Unknown';
    return name.replace(/\s*\(\d+\)\s*$/, '').trim();
  };

  useEffect(() => {
    async function fetchData() {
      if (!opponentTeamId || !tournamentId) {
        setError('Missing team or tournament ID');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Get team statistics from Statistics Feed
        const teamData = await getTeamStatistics(opponentTeamId, tournamentId);
        setTeamStats(teamData);

        // Get player list from the series, then fetch each player's stats
        const players = await getTeamPlayers(seriesId, opponentTeamId);

        // Fetch stats for each player
        const playerStatsPromises = players.map(async (player) => {
          try {
            const stats = await getPlayerStatistics(player.id, tournamentId);
            return { ...player, stats };
          } catch {
            return { ...player, stats: null };
          }
        });

        const allPlayerStats = await Promise.all(playerStatsPromises);
        setPlayerStats(allPlayerStats.filter(p => p.stats));
      } catch (err) {
        console.error('Failed to fetch statistics:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [seriesId, opponentTeamId, tournamentId]);

  if (loading) {
    return (
      <div className="scouting-report">
        <button className="back-btn" onClick={onBack}>Back</button>
        <p>Loading scouting data...</p>
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

  if (!teamStats) {
    return (
      <div className="scouting-report">
        <button className="back-btn" onClick={onBack}>Back</button>
        <p>No statistics available for this team.</p>
      </div>
    );
  }

  // Extract metrics from team stats
  const seriesCount = teamStats.series?.count || 0;
  const gamesPlayed = teamStats.game?.count || 0;

  // wins is an array - find the entry where value === true
  const winsData = teamStats.game?.wins?.find(w => w.value === true) || {};
  const gamesWon = winsData.count || 0;
  const winPercentage = winsData.percentage || 0;
  const totalKills = teamStats.series?.kills?.sum || 0;
  const avgKillsPerSeries = teamStats.series?.kills?.avg?.toFixed(1) || '0';

  // Round/segment stats - deaths are in segment
  const roundSegment = teamStats.segment?.find(s => s.type === 'round') || {};
  const roundsPlayed = roundSegment.count || 0;
  const totalDeaths = roundSegment.deaths?.sum || 0;
  const avgDeathsPerRound = roundSegment.deaths?.avg?.toFixed(2) || '0';
  const teamKD = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : totalKills.toFixed(2);

  // Process player stats
  const processedPlayers = playerStats.map(p => {
    const kills = p.stats?.series?.kills?.sum || 0;
    const roundSegment = p.stats?.segment?.find(s => s.type === 'round') || {};
    const deaths = roundSegment.deaths?.sum || 0;
    const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);
    const avgKills = p.stats?.series?.kills?.avg?.toFixed(1) || '0';

    return {
      name: p.name,
      kills,
      deaths,
      kd,
      avgKills,
      gamesPlayed: p.stats?.game?.count || 0,
    };
  }).sort((a, b) => b.kills - a.kills);

  return (
    <div className="scouting-report">
      <button className="back-btn" onClick={onBack}>Back to Matches</button>

      <header className="report-header">
        <h1>Scouting Report</h1>
        <h2>{cleanName(opponent)}</h2>
        <p className="series-info">
          Tournament Statistics (Team ID: {opponentTeamId})
        </p>
      </header>

      <section className="metrics-section">
        <h3>Team Overview</h3>
        <div className="metrics-grid">
          <MetricCard
            label="Series Played"
            value={seriesCount}
          />
          <MetricCard
            label="Games"
            value={`${gamesWon}/${gamesPlayed}`}
            sublabel={`${winPercentage.toFixed(0)}% win rate`}
          />
          <MetricCard
            label="Team K/D"
            value={teamKD}
          />
          <MetricCard
            label="Rounds Played"
            value={roundsPlayed}
          />
        </div>
      </section>

      <section className="metrics-section">
        <h3>Performance Averages</h3>
        <div className="metrics-grid">
          <MetricCard
            label="Avg Kills/Series"
            value={avgKillsPerSeries}
          />
          <MetricCard
            label="Avg Deaths/Round"
            value={avgDeathsPerRound}
          />
          <MetricCard
            label="Total Kills"
            value={totalKills}
          />
          <MetricCard
            label="Total Deaths"
            value={totalDeaths}
          />
        </div>
      </section>

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
      </section>

      {/* Find weak links */}
      {processedPlayers.some(p => parseFloat(p.kd) < 0.8) && (
        <section className="metrics-section">
          <h3>Weak Links</h3>
          <div className="insight-box">
            {processedPlayers
              .filter(p => parseFloat(p.kd) < 0.8)
              .map(p => (
                <p key={p.name}>
                  <strong>{p.name}</strong> has a {p.kd} K/D ratio -
                  target this player for trades.
                </p>
              ))}
          </div>
        </section>
      )}

      {/* Win streak info */}
      {winsData.streak && (
        <section className="metrics-section">
          <h3>Streaks</h3>
          <div className="metrics-grid">
            <MetricCard
              label="Best Win Streak"
              value={winsData.streak.max || 0}
            />
            <MetricCard
              label="Current Streak"
              value={winsData.streak.current || 0}
              sublabel="wins"
            />
          </div>
        </section>
      )}
    </div>
  );
}

function MetricCard({ label, value, sublabel, highlight }) {
  return (
    <div className={`metric-card ${highlight ? 'highlight' : ''}`}>
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
      {sublabel && <div className="metric-sublabel">{sublabel}</div>}
    </div>
  );
}
