# AFTERECHO ✦

> **A minimalist grid-based temporal logic puzzle game where your past movements become future entities.**

AFTERECHO is an original indie browser game designed for both quick daily puzzle engagement and deep logic mastery. The player controls a chrononaut navigating a discrete spatial grid toward an exit beacon. Every few moves, an **Echo** of the player's previous actions materializes and faithfully replays those actions step-by-step. Echoes occupy space, trigger pressure plates, toggle switches, and push blocks—or cause catastrophic **Temporal Paradoxes** if you cross their path.

---

## 🎮 Core Game Mechanics

- **Turn-Based Grid Simulation:** Every valid move (**Click/Tap on adjacent tile**, Arrow Keys, WASD, or mobile swipe / D-pad) advances the discrete game simulation by exactly one turn.
- **The Temporal Echo:** After a configured number of turns (the level's *Echo Delay*, e.g., 4 moves), a violet Echo materializes at your historical starting point and mirrors your past actions—with live on-board **Spawn Countdowns** and **Next-Turn Step Previews**.
- **Temporal Paradox Detection:**
  - *Direct Collision:* You cannot step onto the same tile as an active Echo.
  - *Path Swap:* You and an Echo cannot pass through each other in opposite directions on the same turn.
  - *Causal Invalidation:* An Echo cannot be blocked by a newly closed door or crushed into an immovable obstacle.
  - *Hazard Casualties:* Echoes cannot walk into active lethal hazards (e.g. energized laser grids).
- **Interactive Puzzle Elements:**
  - **Pressure Plates:** Open connected doors (linked by glowing floor circuit traces) while held down by a player, an echo, or a pushable block. Release when stepped off.
  - **Toggle Switches:** Reversible logic gates that flip the state of connected doors each time an entity enters them.
  - **Pushable Blocks (Cubes):** Heavy blocks that can be pushed to anchor pressure plates or manipulate paths.
  - **Temporal Shards:** Golden octahedral energy cores required to charge and unlock exit portals on advanced sectors.
  - **Cyclic Lasers:** Hazard beams that alternate danger states on specific turn cadences.
  - **The Wait Action (`Space` / `Z` / `⏸` / Tap Player):** Allows the player to stay in place for a turn to let their Echo advance or hold down switches.
  - **Smart Live Hints (`💡 Hint` / `Shift+H` / `?`):** Powered by the real-time BFS solver from your current board state—highlights the exact next optimal move or warns you if your current timeline leads to an unavoidable paradox.

---

## 🕹️ Game Modes

1. **Campaign (15 Handcrafted Levels):**
   - **Chapter 1: Emergence (Levels 1–5):** Introduces basic movement, echo delays, loop divergence, pressure plates, and the wait action.
   - **Chapter 2: Synchronization (Levels 6–10):** Features toggle switches, pushable blocks, temporal relays, twin echoes (2 active echoes trailing concurrently), and shard gathering.
   - **Chapter 3: Paradox Labyrinths (Levels 11–15):** Complex dual-channel switchboards, laser grids, spatial knots, bifurcation paths, and the master campaign finale *Grand Paradox*.
2. **Daily Echo:**
   - A deterministic daily puzzle identical for all players globally on the same date (`YYYY-MM-DD`).
   - Features sealed barrier gates verified solvable by the integrated BFS state solver with calculated par moves.
   - Tracks daily play streaks (`🔥`) and generates LinkedIn/Wordle-style visual emoji share cards (`🟦🟦🟦🟪🟦🟩`).
3. **Endless Lab:**
   - Procedural puzzles generated with progressive difficulty (larger grids, tighter delays, switches, shards, and blocks).
   - Every candidate puzzle is verified for solvability before being presented to the player.
4. **Time Trial:**
   - High-speed challenge mode featuring a millisecond stopwatch, personal best records, and move counter across all 15 benchmark sectors.

---

## 🎨 Visual & Audio Identity

- **Palette:** Deep void black (`#0a0d14`), dark slate geometric tiles (`#121824`), luminous cyan player (`#00f0ff`), ethereal violet echoes (`#b55fe6`), warm amber switches (`#ffaa00`), and radiant emerald exits (`#00e599`).
- **Dynamic Feedback:** Subtle particle bursts, smooth player & echo interpolation transitions, switch-to-door circuit traces, valid move target dots, high DPI Retina canvas scaling, and timeline bars showing turns and upcoming echo spawn points.
- **Audio Synthesis:** Zero external audio assets. Real-time sci-fi sound effects generated procedurally via the **Web Audio API** (move chime, echo resonance, switch click, paradox glitch, and win harmonic chord).
- **Accessibility:** Full keyboard controls, direct tile click/tap, mobile touch/swipe and D-pad, mute toggle, high-contrast channel labels, and reduced-motion mode.

---

## 🛠️ Tech Stack & Architecture

- **Engine:** Pure TypeScript (`src/engine/`) with deterministic state transitions, zero external runtime dependencies.
- **Solver:** Breadth-First Search (BFS) state explorer (`solver.ts`) with temporal history deduplication.
- **Renderer:** High-performance HTML5 Canvas renderer (`renderer.ts`).
- **Storage:** Safe LocalStorage wrapper with transparent in-memory fallback (`storage.ts`).
- **No Heavy Bundlers:** Standard ES modules (`type="module"`) supported directly by all modern browsers.

### Directory Structure

```
afterecho/
├── index.html              # Clean responsive HTML shell
├── styles.css              # Cyber-minimalist dark responsive theme
├── package.json            # Scripts and metadata
├── tsconfig.json           # Modern TypeScript ES2022 configuration
├── vercel.json             # Vercel deployment configuration
├── src/
│   ├── engine/
│   │   ├── types.ts        # GameState, LevelDef, Actions, Entities
│   │   ├── constants.ts    # Palettes, vectors, defaults
│   │   ├── gameEngine.ts   # Deterministic game rules & simulation
│   │   ├── solver.ts       # Automated BFS puzzle solver & verification
│   │   ├── levels.ts       # 15 handcrafted campaign levels
│   │   ├── daily.ts        # Seeded daily puzzle generator & share cards
│   │   ├── generator.ts    # Procedural level generator for Endless Lab
│   │   ├── audio.ts        # Web Audio API procedural synthesizers
│   │   └── storage.ts      # LocalStorage & memory fallback manager
│   └── ui/
│       ├── renderer.ts     # Canvas 2D engine with particles & interpolation
│       ├── input.ts        # Keyboard, touch gestures, and D-pad
│       └── app.ts          # Main game orchestrator & modal controllers
├── tests/
│   ├── engine.test.js      # Game simulation, collision, and undo unit tests
│   ├── solver.test.js      # Optimal solution verification tests
│   ├── daily.test.js       # Determinism & share snippet tests
│   └── levels.test.js      # Verifies 100% of campaign levels are solvable
└── dist/                   # Compiled ES modules
```

---

## 🚀 Local Development & Testing

### Prerequisites
- Node.js (v18+)
- TypeScript (`npm install -g typescript` or project install)

### 1. Compile TypeScript
```bash
npm run build
```

### 2. Run Automated Test Suite
```bash
npm test
```
Runs 15 automated test suites verifying engine mechanics, paradox collision detection, daily seed determinism, solver accuracy, and 100% solvability of all 15 campaign levels.

### 3. Run Local Server
Serve the project directory using any static web server:
```bash
npx serve .
# or
python3 -m http.server 3000
```
Open `http://localhost:3000` in your browser.

---

## 🌐 Deployment to Vercel

The project is pre-configured for instant zero-config deployment on Vercel:

### Option 1: Via Vercel CLI
```bash
# In the project directory:
vercel
# For production:
vercel --prod
```

### Option 2: Via GitHub / Git Integration
1. Push this repository to GitHub or GitLab.
2. Go to [vercel.com](https://vercel.com) and import the repository.
3. Vercel will automatically detect `vercel.json`, run `npm run build`, and serve the static files.

---

## 📜 License
MIT License. Created for AFTERECHO.
