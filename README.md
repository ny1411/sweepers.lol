# 💣 Sweeper.lol

> **Minesweeper meets high-stakes corporate bidding.** Secure the bag or get cooked, lol.

Sweeper.lol turns classic Minesweeper into a competitive multiplayer arena where companies & players bid to claim territory on the grid. Land on the high-value cells, trigger special locks, and flex on the global leaderboard.

---

## ⚡ The Lore & Mechanics (TL;DR)

- **The Grid:** 10x10 arena of claimable cells with Minesweeper adjacency mechanics.
- **Numbers = Bag Value:** Adjacent cells show clue numbers (`1`, `2`, `3`) indicating surrounding density. Higher numbers = higher base value, fr.
- **👑 SPECIAL Cells:** Glowing gold cells that trigger a **7-day lock period**. Once claimed, nobody can outbid you till the timer expires. Massive flex, imo.
- **Real-Time Outbid Alerts:** Live toasts scream at you when another company tries to snatch your bag, lmao.
- **Sound FX Engine:** Built-in Web Audio synthesizers for clicks, reveals, bids, and game overs (toggleable mute, btw).
- **Live Leaderboard & Company Analytics:** Track top corporate spenders, board domination %, and recent bid wars in real-time.

---

## 🛠️ Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router, React 19)
- **Styling:** Tailwind CSS + Lucide Icons (custom dark/cyber aesthetic)
- **Database & Auth:** [Supabase](https://supabase.com/) (SSR client + Realtime)
- **Sound:** Native Web Audio API procedural sound synthesis
- **State Management:** React Context + optimistic client-side fallbacks

---

## 🚀 Quickstart

### 1. Clone & Install
```bash
git clone https://github.com/your-username/sweeper.lol.git
cd sweeper.lol
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` into `.env.local`:
```bash
cp .env.example .env.local
```

Fill in your Supabase credentials in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
NEXT_PUBLIC_DEFAULT_BOARD_ID=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
NEXT_PUBLIC_DEFAULT_MIN_BID_INCREMENT=1.00
NEXT_PUBLIC_SPECIAL_LOCK_HOURS=168
```

*(Note: If no Supabase backend is plugged in, the game runs automatically in mock/demo mode out of the box with zero setup needed, so you can test instantly, lol).*

### 3. Spin it Up
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) and start claiming your tiles.

---

## 📁 Project Structure

```
├── src/
│   ├── app/                 # Next.js app router pages & layouts
│   ├── components/
│   │   ├── admin/           # Board reset & debug tools
│   │   ├── auth/            # Auth modal & company profile login
│   │   ├── bidding/         # Bid modal, live outbid toasts, history
│   │   ├── board/           # Interactive grid, HUD, cell rendering
│   │   ├── dashboard/       # Corporate metrics & board analytics
│   │   ├── layout/          # Navbar & Footer
│   │   └── leaderboard/     # Top companies ranking table
│   ├── context/             # Auth & user session state
│   ├── lib/
│   │   ├── game/            # Minesweeper adjacency engine & generators
│   │   ├── sound.ts         # Web Audio procedural SFX generator
│   │   ├── supabase/        # SSR browser & server client factories
│   │   └── config.ts        # Game constants & formatting utilities
│   └── types/               # TypeScript definitions
└── public/                  # Static assets
```

---

## 📜 License
MIT — Go secure your bag, fr! 🚀
