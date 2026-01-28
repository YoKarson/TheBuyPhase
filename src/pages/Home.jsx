import { useState, useEffect } from 'react';
import { getCurrentTournamentTeams } from '../api/centralData';

export default function Home({ onTeamSelect }) {
  const [tournament, setTournament] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const data = await getCurrentTournamentTeams();
        setTournament(data.tournament);
        setTeams(data.teams);
      } catch (err) {
        console.error('Failed to fetch teams:', err);
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
        <p>Loading teams...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error">
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="home">
      <header className="header">
        <h1>The Buy Phase</h1>
        <p className="subtitle">Valorant Scouting Tool for Cloud9</p>
      </header>

      <section className="teams-section">
        <h2>Select a Team to Scout</h2>
        {tournament && (
          <p className="section-desc">
            Teams from: {tournament.name}
          </p>
        )}
        <p className="section-note">Scouting data aggregated from all VCT Americas 2024 tournaments</p>
        <div className="teams-grid">
          {teams.map(team => (
            <div
              key={team.id}
              className="team-card"
              onClick={() => onTeamSelect?.(team)}
            >
              {team.logoUrl ? (
                <img src={team.logoUrl} alt={team.name} className="team-card-logo" />
              ) : (
                <div className="team-card-logo placeholder" />
              )}
              <span className="team-card-name">{(team.name)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
