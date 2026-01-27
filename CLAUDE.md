# The Buy Phase - Project Context

## Overview
A Valorant scouting tool built for Cloud9 for a hackathon. Analyzes opponent tendencies from GRID esports data to generate actionable scouting reports.

## Key Concept
Infer tendencies from available data (kills, rounds, economy) rather than requiring spatial tracking/heatmaps which aren't accessible.

## Tech Stack
- **Frontend**: React 19 + Vite
- **Data**: GRID Esports API (GraphQL)
- **Styling**: CSS with C9 brand colors (#00aeef)

## GRID API Endpoints
All use `x-api-key` header for auth.

| Endpoint | URL | Purpose |
|----------|-----|---------|
| Central Data | `https://api-op.grid.gg/central-data/graphql` | Teams, tournaments, series metadata |
| Live Data / Series State | `https://api-op.grid.gg/live-data-feed/series-state/graphql` | Detailed game/round state |
| Statistics Feed | `https://api-op.grid.gg/statistics-feed/graphql` | Aggregated stats |

## Key IDs
- Cloud9 Organization ID: `1`
- VCT Americas Kickoff 2024 Groups Tournament ID: `757073`
- Valorant test loop series ID: `6`

## Current State

### Completed
- [x] Project setup (React + Vite)
- [x] GitHub repo at `YoKarson/TheBuyPhase`
- [x] GRID API client with auth (`src/api/gridClient.js`)
- [x] Central Data queries for C9 matches (`src/api/centralData.js`)
- [x] Home page showing C9 Valorant matches from VCT Americas Kickoff 2024
- [x] Match cards with team logos, scores, dates
- [x] Series State API integration (`src/api/seriesState.js`)
- [x] Scouting Report page with:
  - Match overview (games won, round win rate)
  - Attack/Defense split
  - First blood analysis (conversion rate, choke detection)
  - Player performance table (K/D, first kill %)
  - Weak link detection
  - Games breakdown by map

### In Progress
- [ ] Testing the scouting report page (click a match to view)

### Planned Features
1. **Mistake Pattern Detection** - Key differentiator
   - Rounds where team gets first blood but loses
   - Aggregate by map, site, opponent economy
   - Example insight: "Team loses 42% of rounds after getting first blood on B site"

2. **Economy Analysis**
   - Eco/force/full buy classification
   - Force buy conversion rates
   - Economy decision patterns

3. **Head-to-Head Comparison**
   - C9 vs specific opponent history
   - Map-specific advantages

4. **Exploit Report**
   - 3-5 actionable bullet points for coaches
   - Auto-generated insights

## File Structure
```
src/
├── api/
│   ├── gridClient.js      # Base GraphQL client
│   ├── centralData.js     # Tournament/series queries
│   └── seriesState.js     # Detailed game state + metrics
├── pages/
│   ├── Home.jsx           # Match listing
│   └── ScoutingReport.jsx # Opponent analysis
├── App.jsx                # Navigation state
└── App.css                # All styles
```

## API Notes
- Central Data `allSeries` filter uses `tournamentId: $id` (not `{ eq: $id }`)
- Date filters use `String` type, not `DateTime`
- Max page size is 50
- Rate limits exist - query sequentially, not in parallel
- Series State gives round-by-round data including:
  - `firstKill` boolean per team/player
  - `winType` for how round ended
  - `side` (attack/defense)
  - Player stats per segment (round)

## Data Available in GRID
The hackathon API access includes VCT Americas 2024 data with 3 C9 matches in the Kickoff Groups tournament. Historical data from Feb 2024.
