# PILL ROYALE 💊 — Real SOL Battle Royale (MAINNET)

**Last pill standing wins real SOL. Automatic on-chain payout. No claiming.**

Fully working server + browser client with **authoritative simulation** and **real Solana transfers** on **mainnet-beta**.

**Latest:** Only real players (no demo bots). Live "X playing" counter shows actual connected real users.

Deploy it as a public website in minutes (Railway / Render) so anyone can join and play for real money from your treasury wallet.

The included configs (`Procfile`, `render.yaml`, `railway.json`) + relative WebSocket code make deployment trivial.

- If a **real wallet player** is the last pill standing → 0.1 SOL (or configured prize) is sent **directly to their wallet**.
- If a **bot** wins (or no real-wallet survivor) → the prize is **sent back to the treasury** as a self-transfer (visible on-chain record that the prize was recycled).

## Quick start (MAINNET — REAL MONEY)

**Warning**: This now defaults to Solana **mainnet-beta**. Any SOL you put into the treasury is real and can be paid out to winners.

```bash
cd pill-royale

# 1. Install deps
npm install

# 2. Start the server (serves the game + runs authoritative logic + handles payouts)
node server.js
```

Open your browser to: **http://localhost:3000**

- Enter name + wallet (or click "Connect Phantom" or "Demo")
- Click **ENTER THE ARENA**
- Other people on the same network (or multiple tabs) who open the same URL and join will play **together** in the same round.
- Bots fill the rest of the arena.
- Play with WASD/arrows or click adjacent hexes.
- When you (or any real wallet player) win, the **server immediately sends 0.1 SOL** from the treasury to the winner's address.

## How real payouts work

- The server is the single source of truth. It runs the full game simulation (hex math, tile crumbling, movement validation, AI, shrink, win detection).
- Clients only send movement intents. The server applies them if valid and broadcasts state.
- On round end the server checks if the winner has a real `wallet` address that came from a connected player.
- If yes → it builds a `SystemProgram.transfer` from the loaded treasury keypair and sends it on-chain (devnet by default).
- The client receives the real `signature` and shows a working Solscan link.

## Using Your Own Mainnet Wallet as Treasury (Private Key)

**Security first**: Your private key gives full control over the funds. It will be used to sign real mainnet transactions.

**Recommended secure method (no file on disk):**

1. In Phantom (or your wallet):
   - Go to the account → "Export Private Key" (or "Show Secret Key").
   - Copy the **base58** string (long string of letters and numbers, no brackets).

2. Run the server like this (replace with your actual key):

```bash
TREASURY_SECRET=YOUR_BASE58_PRIVATE_KEY_HERE node server.js
```

This loads the key only into memory from the environment variable. It is **never written to disk** by this project and is not shown in the browser or logs.

**Alternative (treasury.json file):**
- Create `treasury.json` containing a JSON array of 64 numbers (the raw secret key bytes).
- The server will load it, but this is less secure than the env var method (file could be accidentally committed or read).

**Important**:
- The server **refuses to start on mainnet** if it cannot find a valid key via env var or file.
- The code **never prints or logs your private key**.
- `.gitignore` already ignores `treasury.json`, `.env`, and secret files.
- **Never paste your private key into this chat, any logs, or public places.**

The current treasury public address (from previous runs) is shown when you start the server.

## Treasury Funding on Mainnet

Once you have your key loaded, send real SOL from any wallet to the treasury **public address** printed on startup or available at:

`http://localhost:3000/treasury`

Recommended starting amount: 1–3 SOL (enough for many rounds).

Check balance live at the /treasury endpoint.

Change prize size:
```bash
PRIZE_SOL=0.25 TREASURY_SECRET=... node server.js
```

## Security Notes (read this)

- The private key is used **only on the server** to sign payout and return-to-treasury transactions.
- Clients (browser) never see or receive the private key.
- When a bot wins, the prize is sent **back to the same treasury** via an on-chain self-transfer.
- If you want maximum security later, move the treasury to a Solana program (PDA) controlled by an on-chain program instead of a hot keypair.

## Multiple real players (the "live with everyone" part)

- Run the server once.
- Have friends (or yourself with multiple tabs / different machines on the LAN) open `http://localhost:3000` (or the machine's IP).
- Everyone who joins while no round is running gets put into the same lobby.
- When the round starts they all see each other move in real time.
- The last real player (or the last survivor) gets paid automatically by the server if they have a wallet attached.

Only real players are in the arena. A round starts when at least 2 real players have joined the lobby. No demo bots or AI fillers.

## Volume & bigger prizes

The UI shows a fake "24h volume". Click the volume number in the header — it sends a message to the server that can bump the current round's prize (demo of "the more we trade the bigger the rounds get").

In a real product you would replace this with actual on-chain volume from a token or fee switch.

## Files

- `server.js` — the complete authoritative game + WebSocket server + real payout code
- `index.html` — beautiful self-contained client (also served by the server)
- `package.json`
- `treasury.json` (generated on first run — **never commit real mainnet keys**)
- `README.md`

## Commands

```bash
npm install
node server.js
# (in another terminal if you want) solana airdrop ... for the treasury
```

## Deploy a Live Public Website

This is now ready to deploy as a real public website where anyone can join and play for real mainnet SOL.

### Recommended: Railway (easiest + great WebSocket support)

1. **Push to GitHub**
   ```bash
   cd pill-royale
   git init
   git add .
   git commit -m "Initial Pill Royale"
   git remote add origin https://github.com/YOUR_USERNAME/pill-royale.git
   git push -u origin main
   ```

2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo.

3. In the Railway dashboard, add these **Environment Variables** (critical):
   - `TREASURY_SECRET` = your mainnet base58 private key (from Phantom export)
   - `CLUSTER` = `mainnet-beta` (or leave default)
   - `PRIZE_SOL` = `0.1` (or whatever you want per round)
   - (Optional) `PORT` will be auto-provided

4. Deploy. Railway will give you a public URL like `https://pill-royale-production.up.railway.app`

5. Anyone can open that URL and play. Real players from around the world will join the same arena.

6. (Optional) Add a custom domain in Railway settings.

### Alternative: Render.com

Use the included `render.yaml`:
- Connect your GitHub repo on Render.
- It will read the config.
- Manually set `TREASURY_SECRET` in the environment variables section (Render keeps it secret).

### Security when deployed publicly

- **Never** commit `TREASURY_SECRET` or `treasury.json` to Git.
- The key only lives as an environment variable on the hosting platform.
- Use a dedicated treasury wallet that only holds the prize money you are willing to risk.
- For higher security later, you can move the treasury logic to a Solana program (PDA) instead of a hot key.

The included `Procfile`, `railway.json`, and `render.yaml` make deployment plug-and-play on most modern platforms.

Once deployed, update the client splash or share the public URL — the game works exactly the same as local, but now it's live for everyone.

Enjoy. Be the last pill. 💊

Run `node server.js` and open the URL — it works right now.