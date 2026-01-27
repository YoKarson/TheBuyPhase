# The Buy Phase

A Valorant scouting and analytics tool built for Cloud9, providing actionable insights for match preparation without requiring spatial tracking data.

## Overview

The Buy Phase analyzes professional Valorant match data to generate scouting reports that help teams prepare for upcoming opponents. By focusing on inferable tendencies rather than coordinate-based tracking, it surfaces meaningful patterns like:

- **Macro Tendencies** - Map preferences, attack/defense win rates, eco round success
- **Player Tendencies** - First blood %, clutch rate, trade efficiency
- **Mistake Patterns** - Situations where teams underperform (e.g., losing rounds after securing first blood)
- **Economy Exploits** - Force buy patterns and conversion rates

## Features

- View Cloud9's upcoming Valorant matches
- Browse recent match history
- Team and player performance breakdowns
- Pre-match scouting reports for opponents

## Tech Stack

- **Frontend**: React 19 + Vite
- **Data**: GRID Esports Data API
- **Styling**: CSS with C9 brand colors

## Getting Started

### Prerequisites

- Node.js 18+
- GRID API key

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/YoKarson/TheBuyPhase.git
   cd TheBuyPhase
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create environment file
   ```bash
   cp .env.example .env
   ```

4. Add your GRID API key to `.env`
   ```
   VITE_GRID_API_KEY=your_api_key_here
   ```

5. Start the development server
   ```bash
   npm run dev
   ```

6. Open http://localhost:5173 in your browser

## Project Structure

```
src/
├── api/
│   ├── gridClient.js     # GraphQL client with authentication
│   └── centralData.js    # Team, series, and tournament queries
├── pages/
│   └── Home.jsx          # Main dashboard
├── App.jsx
└── App.css
```

## API Endpoints

The app integrates with three GRID API endpoints:

| Endpoint | Purpose |
|----------|---------|
| `central-data/graphql` | Teams, players, tournaments, schedules |
| `live-data-feed/series-state/graphql` | Round-by-round game state |
| `statistics-feed/graphql` | Aggregated performance stats |

## Contributing

This project was built for the Cloud9 hackathon. Contributions welcome.

## License

See [LICENSE](LICENSE) for details.
