import { useState } from 'react'
import './App.css'
import Home from './pages/Home'
import ScoutingReport from './pages/ScoutingReport'

function App() {
  const [view, setView] = useState('home')
  const [selectedTeam, setSelectedTeam] = useState(null)

  const handleTeamSelect = (team) => {
    setSelectedTeam(team);
    setView('scouting');
  };

  const handleBack = () => {
    setView('home');
    setSelectedTeam(null);
  };

  if (view === 'scouting' && selectedTeam) {
    return (
      <ScoutingReport
        team={selectedTeam}
        onBack={handleBack}
      />
    );
  }

  return <Home onTeamSelect={handleTeamSelect} />
}

export default App
