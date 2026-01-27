import { useState } from 'react'
import './App.css'
import Home from './pages/Home'
import ScoutingReport from './pages/ScoutingReport'

function App() {
  const [view, setView] = useState('home')
  const [selectedMatch, setSelectedMatch] = useState(null)

  const handleMatchClick = (match) => {
    // Find the opponent (non-C9 team)
    const opponent = match.teams.find(t =>
      !t.baseInfo?.name?.toLowerCase().includes('cloud9')
    );
    setSelectedMatch({
      seriesId: match.id,
      opponent: opponent?.baseInfo?.name || 'Unknown',
      match,
    });
    setView('scouting');
  };

  const handleBack = () => {
    setView('home');
    setSelectedMatch(null);
  };

  if (view === 'scouting' && selectedMatch) {
    return (
      <ScoutingReport
        seriesId={selectedMatch.seriesId}
        opponent={selectedMatch.opponent}
        onBack={handleBack}
      />
    );
  }

  return <Home onMatchClick={handleMatchClick} />
}

export default App
