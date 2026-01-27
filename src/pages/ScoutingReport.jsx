import { useState, useEffect } from 'react';
import { getSeriesState, computeScoutingMetrics } from '../api/seriesState';

export default function ScoutingReport({ seriesId, opponent, onBack }) {
  const [seriesState, setSeriesState] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const state = await getSeriesState(seriesId);
        console.log('Series state:', state);
        setSeriesState(state);

        if (state && opponent) {
          const computed = computeScoutingMetrics(state, opponent);
          console.log('Metrics:', computed);
          setMetrics(computed);
        }
      } catch (err) {
        console.error('Failed to fetch series state:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (seriesId) {
      fetchData();
    }
  }, [seriesId, opponent]);

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

  if (!seriesState) {
    return (
      <div className="scouting-report">
        <button className="back-btn" onClick={onBack}>Back</button>
        <p>No data available for this series.</p>
      </div>
    );
  }

  return (
    <div className="scouting-report">
      <button className="back-btn" onClick={onBack}>Back to Matches</button>

      <header className="report-header">
        <h1>Scouting Report</h1>
        <h2>{opponent}</h2>
        <p className="series-info">
          Series {seriesState.id}
          {seriesState.finished ? ' (Finished)' : ' (In Progress)'}
        </p>
      </header>

      {metrics && (
        <>
          <section className="metrics-section">
            <h3>Match Overview</h3>
            <div className="metrics-grid">
              <MetricCard
                label="Games"
                value={`${metrics.gamesWon}/${metrics.gamesPlayed}`}
                sublabel="Won/Played"
              />
              <MetricCard
                label="Total Kills"
                value={metrics.totalKills}
              />
              <MetricCard
                label="Total Deaths"
                value={metrics.totalDeaths}
              />
              <MetricCard
                label="Team K/D"
                value={metrics.kd}
              />
            </div>
          </section>

          <section className="metrics-section">
            <h3>Player Performance</h3>
            {metrics.playerStats.length > 0 ? (
              <table className="player-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>K</th>
                    <th>D</th>
                    <th>K/D</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.playerStats.map(player => (
                    <tr key={player.name}>
                      <td className="player-name">{player.name}</td>
                      <td>{player.kills}</td>
                      <td>{player.deaths}</td>
                      <td className={parseFloat(player.kd) < 1 ? 'stat-low' : 'stat-high'}>
                        {player.kd}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No player data available</p>
            )}
          </section>

          {/* Find weak links */}
          {metrics.playerStats.some(p => parseFloat(p.kd) < 0.8) && (
            <section className="metrics-section">
              <h3>Weak Links</h3>
              <div className="insight-box">
                {metrics.playerStats
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
        </>
      )}

      {/* Games breakdown */}
      <section className="metrics-section">
        <h3>Games</h3>
        {seriesState.games?.map(game => (
          <div key={game.id} className="game-card">
            <div className="game-header">
              <span className="map-name">{game.map?.name || 'Unknown Map'}</span>
              <span className="game-score">
                {game.teams.map(t => t.score).join(' - ')}
              </span>
            </div>
            <div className="game-teams">
              {game.teams.map(team => (
                <div key={team.id} className={`game-team ${team.won ? 'winner' : ''}`}>
                  <span>{team.name}</span>
                  <span>{team.score} rounds</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
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
