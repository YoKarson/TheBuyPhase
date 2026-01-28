import { useState, useEffect } from 'react';
import { getC9Matches, getC9Organization } from '../api/centralData';

export default function Home({ onMatchClick }) {
  const [org, setOrg] = useState(null);
  const [upcomingMatches, setUpcomingMatches] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [orgData, matches] = await Promise.all([
          getC9Organization(),
          getC9Matches(),
        ]);

        setOrg(orgData);
        setUpcomingMatches([]);
        setRecentMatches(matches);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="loading">
        <p>Loading Cloud9 data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error">
        <h2>Error</h2>
        <p>{error}</p>
        <p>Check the console for more details.</p>
      </div>
    );
  }

  return (
    <div className="home">
      <header className="header">
        <h1>The Buy Phase</h1>
        <p className="subtitle">Cloud9 Valorant Scouting Tool</p>
      </header>

      {org && (
        <section className="org-info">
          <h2>{org.name}</h2>
          <p>{org.teams?.length || 0} teams in organization</p>
        </section>
      )}

      <section className="matches-section">
        <h2>Cloud9 Valorant Matches From Kickoff 2024</h2>
        {recentMatches.length === 0 ? (
          <p className="no-matches">No C9 Valorant matches found in available data</p>
        ) : (
          <div className="matches-list">
            {recentMatches.map(match => (
              <MatchCard
                key={match.id}
                match={match}
                isRecent
                onClick={() => onMatchClick?.(match)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MatchCard({ match, isRecent = false, onClick }) {
  const team1 = match.teams?.[0]?.baseInfo;
  const team2 = match.teams?.[1]?.baseInfo;
  const score1 = match.teams?.[0]?.scoreAdvantage ?? 0;
  const score2 = match.teams?.[1]?.scoreAdvantage ?? 0;

  const cleanName = (name) => {
    if (!name) return 'TBD';
    return name.replace(/\s*\(\d+\)\s*$/, '').trim();
  };

  const date = new Date(match.startTimeScheduled);
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className={`match-card ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div className="match-meta">
        <span className="tournament">{match.tournament?.nameShortened || match.tournament?.name}</span>
        <span className="format">{match.format?.nameShortened}</span>
      </div>

      <div className="match-teams">
        <div className="team">
          {team1?.logoUrl && <img src={team1.logoUrl} alt={team1.name} className="team-logo" />}
          <span className="team-name">{cleanName(team1?.name)}</span>
          {isRecent && <span className="score">{score1}</span>}
        </div>

        <span className="vs">vs</span>

        <div className="team">
          {isRecent && <span className="score">{score2}</span>}
          <span className="team-name">{cleanName(team2?.name)}</span>
          {team2?.logoUrl && <img src={team2.logoUrl} alt={team2.name} className="team-logo" />}
        </div>
      </div>

      <div className="match-time">
        <span>{dateStr}</span>
        <span>{timeStr}</span>
      </div>
    </div>
  );
}
