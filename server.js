const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
  sendAndConfirmTransaction,
  Transaction
} = require('@solana/web3.js');

// ==================== CONFIG ====================
const PORT = process.env.PORT || 3000;
const CLUSTER = process.env.CLUSTER || 'mainnet-beta'; // 'mainnet-beta' or 'devnet' (mainnet is now default)
const PRIZE_SOL = parseFloat(process.env.PRIZE_SOL || '0.1');
const MAX_TOTAL_PLAYERS = 7;
const MIN_REAL_TO_START = 1;
const ROUND_COUNTDOWN_MS = 6500;
const TICK_MS = 55;
const SHRINK_INTERVAL_MS = 16000; // longer rounds - outer rings collapse more slowly

const PRIZE_LAMPORTS = Math.floor(PRIZE_SOL * LAMPORTS_PER_SOL);

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve the game statically
app.use(express.static(__dirname));
app.use(express.json());

// ==================== SOLANA SETUP ====================
let treasuryKeypair = null;
let connection = null;

function loadOrCreateTreasury() {
  const treasuryPath = path.join(__dirname, 'treasury.json');
  const isMainnet = CLUSTER === 'mainnet-beta' || CLUSTER === 'mainnet';

  // === PREFERRED SECURE METHOD: Environment variable ===
  // Set TREASURY_SECRET to your base58 private key (recommended for mainnet).
  // Example: TREASURY_SECRET=yourBase58SecretHere node server.js
  // This way the key never touches disk in this project.
  const envSecret = process.env.TREASURY_SECRET;
  if (envSecret && envSecret.length > 20) {
    try {
      let secretBytes;
      // Try base58 first (most common from Phantom export / solana-keygen)
      try {
        const bs58 = require('bs58');
        secretBytes = bs58.decode(envSecret);
      } catch {
        // Fallback: maybe they passed a JSON array as string
        secretBytes = JSON.parse(envSecret);
      }

      if (secretBytes.length === 64) {
        treasuryKeypair = Keypair.fromSecretKey(Uint8Array.from(secretBytes));
        console.log('Loaded treasury from TREASURY_SECRET env var');
        console.log('Treasury public address:', treasuryKeypair.publicKey.toBase58());
        if (isMainnet) {
          console.log('\n*** MAINNET MODE *** Using private key from environment variable.');
          console.log('*** This key controls real funds. Do not share this terminal or env.');
        }
        return; // success, do not fall through to file generation
      } else {
        console.error('TREASURY_SECRET was provided but did not decode to 64 bytes.');
      }
    } catch (e) {
      console.error('Failed to load treasury from TREASURY_SECRET:', e.message);
    }
  }

  // === FALLBACK: treasury.json file (less ideal for mainnet) ===
  if (fs.existsSync(treasuryPath)) {
    try {
      const secret = JSON.parse(fs.readFileSync(treasuryPath, 'utf8'));
      treasuryKeypair = Keypair.fromSecretKey(Uint8Array.from(secret));
      console.log('Loaded existing treasury from treasury.json:', treasuryKeypair.publicKey.toBase58());
      if (isMainnet) {
        console.log('\n*** WARNING: Using treasury.json on MAINNET ***');
        console.log('The private key lives in a file on disk. Consider using TREASURY_SECRET env var instead.');
      }
    } catch (e) {
      console.error('Failed to load treasury.json:', e.message);
    }
  }

  if (!treasuryKeypair) {
    // Only auto-generate on non-mainnet by default for safety
    if (isMainnet) {
      console.error('\n!!! CRITICAL: No treasury key found for MAINNET !!!');
      console.error('');
      console.error('For LOCAL testing:');
      console.error('  TREASURY_SECRET=YourBase58PrivateKeyHere node server.js');
      console.error('');
      console.error('For DEPLOYED WEBSITE (Railway / Render / etc.):');
      console.error('  In your hosting platform dashboard, add an Environment Variable:');
      console.error('    Name:  TREASURY_SECRET');
      console.error('    Value: YourBase58PrivateKeyHere');
      console.error('');
      console.error('  Then redeploy. The live site will use your mainnet wallet for automatic payouts.');
      console.error('');
      console.error('How to get YourBase58PrivateKeyHere:');
      console.error('  In Phantom → Account → Export Private Key (copy the long base58 string).');
      console.error('');
      console.error('Security:');
      console.error('  - Use a dedicated wallet that only holds the prize money you want to risk.');
      console.error('  - NEVER commit the key to git or put it in code.');
      console.error('  - On platforms, always use the secret/env var UI (never in repo).');
      console.error('');
      process.exit(1);
    }

    // Devnet / test: auto-generate for convenience
    treasuryKeypair = Keypair.generate();
    const secretArray = Array.from(treasuryKeypair.secretKey);
    fs.writeFileSync(treasuryPath, JSON.stringify(secretArray));
    console.log('\n=== NEW TREASURY CREATED (devnet/test only) ===');
    console.log('Address:', treasuryKeypair.publicKey.toBase58());
    console.log('Saved to treasury.json (this file is now gitignored)');
    console.log('Fund it with: solana airdrop 2 ' + treasuryKeypair.publicKey.toBase58() + ' --url ' + CLUSTER);
    console.log('Or send SOL from a wallet to the address above.\n');
  }
}

async function initSolana() {
  connection = new Connection(clusterApiUrl(CLUSTER), 'confirmed');
  loadOrCreateTreasury();

  try {
    const balance = await connection.getBalance(treasuryKeypair.publicKey);
    console.log(`Treasury balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL on ${CLUSTER}`);
    if (balance < PRIZE_LAMPORTS * 2) {
      console.log('WARNING: Treasury is low. Real payouts may fail until funded.');
    }
    if ((CLUSTER === 'mainnet-beta' || CLUSTER === 'mainnet') && balance > 0) {
      console.log('\n*** MAINNET TREASURY ACTIVE ***');
      console.log('Real SOL will be sent automatically on wins.');
      console.log('Bot wins will return the prize to this same treasury via on-chain self-transfer.');
    }
  } catch (e) {
    console.log('Could not fetch treasury balance yet (will retry on payout).');
  }
}

async function sendPrizeToWinner(winnerWalletBase58) {
  if (!treasuryKeypair || !connection) {
    console.log('[PAYOUT] No treasury/connection configured. Simulated only.');
    return { success: false, simulated: true, signature: null };
  }

  try {
    const toPubkey = new PublicKey(winnerWalletBase58);
    const fromPubkey = treasuryKeypair.publicKey;

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    const transaction = new Transaction({
      blockhash,
      lastValidBlockHeight,
      feePayer: fromPubkey
    }).add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports: PRIZE_LAMPORTS
      })
    );

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [treasuryKeypair],
      { commitment: 'confirmed', maxRetries: 3 }
    );

    console.log(`[PAYOUT SUCCESS] ${PRIZE_SOL} SOL sent to ${winnerWalletBase58}`);
    console.log('  Signature:', signature);

    return { success: true, simulated: false, signature, amount: PRIZE_SOL, toTreasury: false };
  } catch (err) {
    console.error('[PAYOUT ERROR]', err.message || err);
    return { success: false, simulated: false, error: err.message, signature: null, toTreasury: false };
  }
}

// When a bot wins (or no real wallet winner), explicitly send the prize amount back into the treasury (self-transfer).
// This creates a clear on-chain record that the prize was recycled.
async function returnPrizeToTreasury() {
  if (!treasuryKeypair || !connection) {
    console.log('[TREASURY RETURN] No treasury key — prize stays in treasury (simulated return).');
    return { success: true, simulated: true, signature: null, toTreasury: true };
  }

  try {
    const fromPubkey = treasuryKeypair.publicKey;
    const toPubkey = fromPubkey; // self-transfer = returning the prize to the treasury

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    const transaction = new Transaction({
      blockhash,
      lastValidBlockHeight,
      feePayer: fromPubkey
    }).add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports: PRIZE_LAMPORTS
      })
    );

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [treasuryKeypair],
      { commitment: 'confirmed', maxRetries: 3 }
    );

    console.log(`[TREASURY RETURN] ${PRIZE_SOL} SOL sent back to treasury (bot won or no real winner).`);
    console.log('  Signature:', signature);

    return { success: true, simulated: false, signature, amount: PRIZE_SOL, toTreasury: true };
  } catch (err) {
    console.error('[TREASURY RETURN ERROR]', err.message || err);
    // Even if the tx fails, the money never left the treasury, so we can treat it as returned.
    return { success: true, simulated: false, error: err.message, signature: null, toTreasury: true };
  }
}

// ==================== GAME ENGINE (authoritative) ====================
const HEX_DIRS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];

function hexKey(q, r) { return `${q},${r}`; }
function getNeighbors(q, r) { return HEX_DIRS.map(([dq, dr]) => [q + dq, r + dr]); }

function isValidHex(q, r, radius = 5) {
  return Math.abs(q) <= radius && Math.abs(r) <= radius && Math.abs(q + r) <= radius;
}

function hexDistance(q1, r1, q2, r2) {
  return (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs(q1 + r1 - q2 - r2)) / 2;
}

function hexToPixel(q, r, size = 36) {
  const x = size * (3 / 2 * q);
  const y = size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return { x, y };
}

function pixelToHex(px, py, size = 36) {
  const q = (2 / 3 * px) / size;
  const r = (-1 / 3 * px + Math.sqrt(3) / 3 * py) / size;
  return hexRound(q, r);
}

function hexRound(q, r) {
  let s = -q - r;
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
  const qd = Math.abs(rq - q), rd = Math.abs(rr - r), sd = Math.abs(rs - s);
  if (qd > rd && qd > sd) rq = -rr - rs;
  else if (rd > sd) rr = -rq - rs;
  return { q: rq, r: rr };
}

class Game {
  constructor(realPlayers) {
    this.radius = 5;
    this.START_DURABILITY = 4;   // tiles are tougher → rounds last longer
    this.FALL_DELAY = 1050;      // more time before a cracked tile actually disappears
    this.MOVE_COOLDOWN = 165;

    this.tiles = new Map(); // key -> {durability, fallAt, fallen}
    this.players = [];      // {id, name, wallet, q, r, color, eliminated, lastMoved, isBot, wsId? }
    this.startTime = Date.now();
    this.shrinkLevel = 0;
    this.lastShrink = Date.now() + 14000; // give players a decent head start before the arena starts shrinking hard
    this.winner = null;
    this.ended = false;
    this.prizeSOL = PRIZE_SOL;

    this.initTiles();
    this.initPlayers(realPlayers);
  }

  initTiles() {
    this.tiles.clear();
    for (let q = -this.radius; q <= this.radius; q++) {
      for (let r = -this.radius; r <= this.radius; r++) {
        if (Math.abs(q + r) <= this.radius) {
          this.tiles.set(hexKey(q, r), { durability: this.START_DURABILITY, fallAt: null, fallen: false });
        }
      }
    }
  }

  getAllHexes() {
    const hexes = [];
    for (let q = -this.radius; q <= this.radius; q++) {
      for (let r = -this.radius; r <= this.radius; r++) {
        if (Math.abs(q + r) <= this.radius) hexes.push({ q, r });
      }
    }
    return hexes;
  }

  getTile(q, r) {
    const k = hexKey(q, r);
    if (!this.tiles.has(k)) {
      this.tiles.set(k, { durability: 0, fallAt: 0, fallen: true });
    }
    return this.tiles.get(k);
  }

  damageTile(q, r, amount = 1) {
    if (!isValidHex(q, r)) return;
    const t = this.getTile(q, r);
    if (t.fallen) return;
    t.durability -= amount;
    if (t.durability <= 0 && !t.fallAt) {
      t.fallAt = Date.now() + this.FALL_DELAY;
    }
  }

  updateFalling() {
    const now = Date.now();
    for (const [key, t] of this.tiles) {
      if (!t.fallen && t.fallAt && now >= t.fallAt) {
        t.fallen = true;
        const [q, r] = key.split(',').map(Number);
        for (const p of this.players) {
          if (!p.eliminated && p.q === q && p.r === r) {
            this.eliminatePlayer(p, true);
          }
        }
      }
    }
  }

  eliminatePlayer(p, byFall = false) {
    if (p.eliminated) return;
    p.eliminated = true;
    p.elimTime = Date.now();
    console.log(`[GAME] ${p.name} eliminated${byFall ? ' (fell)' : ''}`);
    this.checkWin();
  }

  checkWin() {
    if (this.ended) return;
    const live = this.players.filter(p => !p.eliminated);
    if (live.length <= 1) {
      this.ended = true;
      this.winner = live[0] || null;
    }
  }

  initPlayers(realPlayers) {
    this.players = [];
    const colors = ['#22ff88', '#f472b6', '#60a5fa', '#fbbf24', '#a78bfa', '#34d399', '#fb7185'];
    const botNames = ['RedPill', 'SolCrush', '0xDrop', 'VitaminZ', 'HexHavoc', 'LastDose'];

    // Add real players first
    const usedKeys = new Set();
    let posIndex = 0;
    const allPos = this.getAllHexes().sort((a, b) =>
      (Math.abs(a.q) + Math.abs(a.r)) - (Math.abs(b.q) + Math.abs(b.r))
    ).sort(() => Math.random() - 0.5);

    realPlayers.forEach((rp, i) => {
      let pos = allPos[posIndex % allPos.length];
      while (usedKeys.has(hexKey(pos.q, pos.r)) && posIndex < allPos.length * 2) {
        posIndex++;
        pos = allPos[posIndex % allPos.length];
      }
      usedKeys.add(hexKey(pos.q, pos.r));

      this.players.push({
        id: rp.id,
        name: rp.name || `Player${i}`,
        wallet: rp.wallet,
        q: pos.q,
        r: pos.r,
        color: colors[i % colors.length],
        eliminated: false,
        lastMoved: Date.now(),
        isBot: false,
        wsId: rp.wsId || null,
        moveCooldownUntil: 0
      });
    });

    // Fill with bots
    const needed = MAX_TOTAL_PLAYERS - this.players.length;
    for (let i = 0; i < needed; i++) {
      let pos = allPos[posIndex % allPos.length];
      while (usedKeys.has(hexKey(pos.q, pos.r))) {
        posIndex++;
        pos = allPos[posIndex % allPos.length];
      }
      usedKeys.add(hexKey(pos.q, pos.r));

      this.players.push({
        id: 'bot-' + (i + 1),
        name: botNames[(i + realPlayers.length) % botNames.length],
        wallet: null,
        q: pos.q,
        r: pos.r,
        color: colors[(realPlayers.length + i) % colors.length],
        eliminated: false,
        lastMoved: Date.now(),
        isBot: true,
        moveCooldownUntil: 0,
        nextBotMove: Date.now() + 300 + Math.random() * 500
      });
    }
  }

  canMoveTo(p, q, r) {
    if (!isValidHex(q, r)) return false;
    const t = this.getTile(q, r);
    if (t.fallen) return false;
    const now = Date.now();
    if (t.fallAt && now + 160 > t.fallAt) return false;

    for (const other of this.players) {
      if (other !== p && !other.eliminated && other.q === q && other.r === r) return false;
    }
    return true;
  }

  movePlayer(p, targetQ, targetR) {
    if (p.eliminated) return false;
    if (!this.canMoveTo(p, targetQ, targetR)) return false;

    const oldQ = p.q, oldR = p.r;
    p.q = targetQ;
    p.r = targetR;
    p.lastMoved = Date.now();

    this.damageTile(targetQ, targetR, 1);

    if (Math.random() < 0.32) this.damageTile(oldQ, oldR, 0.55);

    if (p.isBot) p.nextBotMove = Date.now() + 480 + Math.random() * 280;

    return true;
  }

  applyHumanMove(playerId, directionIndex) {
    const p = this.players.find(pl => pl.id === playerId && !pl.isBot);
    if (!p || p.eliminated) return false;

    const now = Date.now();
    if (now < p.moveCooldownUntil) return false;

    const [dq, dr] = HEX_DIRS[directionIndex % 6];
    const tq = p.q + dq;
    const tr = p.r + dr;

    if (this.movePlayer(p, tq, tr)) {
      p.moveCooldownUntil = now + this.MOVE_COOLDOWN;
      return true;
    }
    return false;
  }

  applyHumanTargetMove(playerId, q, r) {
    const p = this.players.find(pl => pl.id === playerId && !pl.isBot);
    if (!p || p.eliminated) return false;
    const now = Date.now();
    if (now < p.moveCooldownUntil) return false;

    // Only allow adjacent (cube distance 1)
    const dist = hexDistance(p.q, p.r, q, r);
    if (dist !== 1) return false;

    if (this.movePlayer(p, q, r)) {
      p.moveCooldownUntil = now + this.MOVE_COOLDOWN;
      return true;
    }
    return false;
  }

  updateBots(now) {
    const live = this.players.filter(p => !p.eliminated);
    if (live.length < 2) return;

    for (const bot of this.players) {
      if (!bot.isBot || bot.eliminated) continue;
      if (now < (bot.nextBotMove || 0)) continue;

      const neighbors = getNeighbors(bot.q, bot.r);
      let bestScore = -9999;
      let best = null;

      // consider staying
      const stayScore = this.scorePosition(bot, bot.q, bot.r, live, now);
      if (stayScore > bestScore) { bestScore = stayScore; best = { q: bot.q, r: bot.r }; }

      for (const [nq, nr] of neighbors) {
        if (!isValidHex(nq, nr)) continue;
        const t = this.getTile(nq, nr);
        if (t.fallen || (t.fallAt && now + 200 > t.fallAt)) continue;
        const sc = this.scorePosition(bot, nq, nr, live, now);
        if (sc > bestScore) { bestScore = sc; best = { q: nq, r: nr }; }
      }

      if (best && (best.q !== bot.q || best.r !== bot.r)) {
        this.movePlayer(bot, best.q, best.r);
      } else {
        bot.nextBotMove = now + 260 + Math.random() * 220;
      }
    }
  }

  scorePosition(bot, q, r, live, now) {
    const t = this.getTile(q, r);
    if (t.fallen) return -100;
    let score = t.durability * 5.2;

    if (t.fallAt) {
      const timeLeft = t.fallAt - now;
      score -= Math.max(0, (900 - timeLeft) / 1.8);
    }

    const distCenter = Math.abs(q) + Math.abs(r) + Math.abs(q + r);
    if (live.length <= 3) score -= distCenter * 1.15;
    else score -= distCenter * 0.4;

    if (live.length <= 4) {
      let minDist = 99;
      for (const o of live) {
        if (o.id === bot.id) continue;
        const d = hexDistance(q, r, o.q, o.r);
        if (d < minDist) minDist = d;
      }
      score += (5.5 - minDist) * 1.7;
    }
    return score + (Math.random() * 1.2 - 0.4);
  }

  applyShrink(now) {
    if (now - this.lastShrink < SHRINK_INTERVAL_MS) return;
    this.lastShrink = now;
    this.shrinkLevel += 1;

    const currentR = this.radius - this.shrinkLevel;
    if (currentR < 1) return;

    for (const h of this.getAllHexes()) {
      const ring = Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.q + h.r));
      if (ring >= currentR) {
        const t = this.getTile(h.q, h.r);
        if (!t.fallen && !t.fallAt) {
          t.fallAt = now + 380 + Math.random() * 480;
          t.durability = Math.min(t.durability, 1);
        }
      }
    }
  }

  tick() {
    if (this.ended) return;

    const now = Date.now();
    this.updateFalling();
    this.updateBots(now);
    this.applyShrink(now);

    // Passive stress (slowed down for longer rounds)
    for (const p of this.players) {
      if (p.eliminated) continue;
      const stand = now - p.lastMoved;
      if (stand > 1400) {
        const extra = Math.floor((stand - 1300) / 650);
        if (extra > 0) this.damageTile(p.q, p.r, Math.min(0.9, extra * 0.4));
      }
    }

    this.checkWin();
  }

  getPublicState() {
    const tileStates = [];
    for (const [k, t] of this.tiles) {
      if (t.fallen || t.fallAt || t.durability < this.START_DURABILITY) {
        const [q, r] = k.split(',').map(Number);
        tileStates.push({ q, r, durability: t.durability, fallen: t.fallen, fallAt: t.fallAt });
      }
    }

    return {
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        walletShort: p.wallet ? (p.wallet.slice(0, 4) + '..' + p.wallet.slice(-4)) : (p.isBot ? 'BOT' : 'YOU'),
        q: p.q,
        r: p.r,
        color: p.color,
        eliminated: p.eliminated,
        isBot: p.isBot
      })),
      tiles: tileStates,
      time: Date.now() - this.startTime,
      prize: this.prizeSOL,
      ended: this.ended,
      winnerId: this.winner ? this.winner.id : null
    };
  }
}

// ==================== MATCHMAKING & ROUND MANAGER ====================
const connectedClients = new Map(); // ws -> {id, name, wallet, ws}
let currentGame = null;
let lobby = []; // waiting real players {id, name, wallet, ws}
let roundInProgress = false;
let nextRoundTimeout = null;

function broadcast(type, payload) {
  const msg = JSON.stringify({ type, ...payload });
  for (const [ws, client] of connectedClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

function broadcastToLobby(type, payload) {
  const msg = JSON.stringify({ type, ...payload });
  for (const lp of lobby) {
    if (lp.ws && lp.ws.readyState === WebSocket.OPEN) {
      lp.ws.send(msg);
    }
  }
}

function getLobbyState() {
  return {
    players: lobby.map(p => ({ name: p.name, walletShort: p.wallet ? p.wallet.slice(0,4)+'..'+p.wallet.slice(-4) : '' })),
    count: lobby.length,
    max: MAX_TOTAL_PLAYERS
  };
}

function startNewRoundIfPossible() {
  if (roundInProgress || lobby.length < MIN_REAL_TO_START) return;

  // Take current lobby as real participants
  const realParticipants = lobby.map(lp => ({
    id: lp.id,
    name: lp.name,
    wallet: lp.wallet,
    wsId: lp.id
  }));

  currentGame = new Game(realParticipants);
  roundInProgress = true;
  lobby = []; // clear lobby for next

  console.log(`[ROUND] Started with ${realParticipants.length} real players + bots. Prize: ${PRIZE_SOL} SOL`);

  // Notify everyone
  broadcast('round_start', {
    roundId: Date.now(),
    prize: PRIZE_SOL,
    players: currentGame.players.map(p => ({
      id: p.id, name: p.name, isBot: p.isBot, walletShort: p.wallet ? p.wallet.slice(0,4)+'..'+p.wallet.slice(-4) : 'BOT'
    }))
  });

  // Start ticking
  if (currentGame.tickInterval) clearInterval(currentGame.tickInterval);
  currentGame.tickInterval = setInterval(() => {
    if (!currentGame || currentGame.ended) {
      clearInterval(currentGame.tickInterval);
      return;
    }
    currentGame.tick();

    // Broadcast state frequently
    const state = currentGame.getPublicState();
    broadcast('state', state);

    if (currentGame.ended) {
      handleRoundEnd();
    }
  }, TICK_MS);

  // Also broadcast initial state immediately
  setTimeout(() => {
    if (currentGame) broadcast('state', currentGame.getPublicState());
  }, 80);
}

function handleRoundEnd() {
  if (!currentGame || !currentGame.ended) return;

  roundInProgress = false;
  const winner = currentGame.winner;
  const gameSnapshot = currentGame.getPublicState();

  console.log('[ROUND END] Winner:', winner ? winner.name : 'none');

  // Real payout or recycle to treasury
  (async () => {
    let payoutResult;
    if (winner && winner.wallet && !winner.isBot) {
      payoutResult = await sendPrizeToWinner(winner.wallet);
    } else {
      // Bot won (or no real-wallet survivor) → send the prize back into the treasury
      payoutResult = await returnPrizeToTreasury();
    }

    const payload = {
      winner: winner ? { 
        id: winner.id, 
        name: winner.name, 
        isBot: !!winner.isBot,
        wallet: winner.wallet || null 
      } : null,
      payout: payoutResult,
      state: gameSnapshot,
      cluster: CLUSTER
    };
    broadcast('round_end', payload);

    setTimeout(resetAfterRound, payoutResult.toTreasury ? 2800 : 4200);
  })();
}

function resetAfterRound() {
  if (currentGame && currentGame.tickInterval) {
    clearInterval(currentGame.tickInterval);
  }
  currentGame = null;

  // If people are waiting in lobby, start next round soon
  if (lobby.length >= MIN_REAL_TO_START) {
    console.log('[MATCH] Players waiting — starting next round soon');
    setTimeout(startNewRoundIfPossible, 1800);
  } else {
    broadcast('waiting_for_players', getLobbyState());
  }
}

// ==================== WEBSOCKET HANDLING ====================
let clientIdCounter = 1;

wss.on('connection', (ws) => {
  const clientId = 'c' + (clientIdCounter++);
  const client = { id: clientId, name: 'Anon', wallet: null, ws };
  connectedClients.set(ws, client);

  console.log(`[WS] Client connected: ${clientId}`);

  // Send current status
  ws.send(JSON.stringify({
    type: 'connected',
    clientId,
    treasury: treasuryKeypair ? treasuryKeypair.publicKey.toBase58() : null,
    prize: PRIZE_SOL,
    cluster: CLUSTER
  }));

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    const c = connectedClients.get(ws);
    if (!c) return;

    if (msg.type === 'join') {
      c.name = (msg.name || 'AnonPill').slice(0, 20);
      c.wallet = msg.wallet || null;

      // Add to lobby if not already
      if (!lobby.find(lp => lp.id === c.id)) {
        lobby.push({ id: c.id, name: c.name, wallet: c.wallet, ws });
      }

      ws.send(JSON.stringify({ type: 'joined', name: c.name, wallet: c.wallet }));

      // Broadcast updated lobby to everyone
      broadcast('lobby_update', getLobbyState());

      // Try to start
      if (!roundInProgress) {
        startNewRoundIfPossible();
      } else {
        ws.send(JSON.stringify({ type: 'waiting', message: 'Round in progress. You will join the next one.' }));
      }
    }

    if (msg.type === 'move' && currentGame && roundInProgress) {
      // Find the real player belonging to this ws
      const player = currentGame.players.find(p => p.wsId === c.id && !p.isBot);
      if (player && !player.eliminated) {
        let moved = false;
        if (typeof msg.dir === 'number') {
          moved = currentGame.applyHumanMove(player.id, msg.dir);
        } else if (msg.q !== undefined && msg.r !== undefined) {
          moved = currentGame.applyHumanTargetMove(player.id, msg.q, msg.r);
        }
        if (moved) {
          // immediate state push for responsiveness
          broadcast('state', currentGame.getPublicState());
        }
      }
    }

    if (msg.type === 'bump_volume') {
      // Fun simulation of "more trading = bigger prizes"
      currentGame ? (currentGame.prizeSOL = Math.min(2.5, (currentGame.prizeSOL || PRIZE_SOL) + 0.03)) : null;
      broadcast('prize_update', { prize: currentGame ? currentGame.prizeSOL : PRIZE_SOL });
    }
  });

  ws.on('close', () => {
    connectedClients.delete(ws);
    // Remove from lobby
    lobby = lobby.filter(lp => lp.ws !== ws);
    broadcast('lobby_update', getLobbyState());
    console.log(`[WS] Client disconnected: ${clientId}`);
  });
});

// ==================== HTTP ENDPOINTS ====================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', cluster: CLUSTER, prize: PRIZE_SOL });
});

app.get('/treasury', async (req, res) => {
  if (!treasuryKeypair || !connection) {
    return res.json({ error: 'Treasury not initialized' });
  }
  try {
    const balance = await connection.getBalance(treasuryKeypair.publicKey);
    res.json({
      address: treasuryKeypair.publicKey.toBase58(),
      balanceSOL: balance / LAMPORTS_PER_SOL,
      cluster: CLUSTER,
      prizeSOL: PRIZE_SOL
    });
  } catch (e) {
    res.json({
      address: treasuryKeypair.publicKey.toBase58(),
      balanceSOL: null,
      cluster: CLUSTER,
      error: e.message
    });
  }
});

app.post('/airdrop-devnet', async (req, res) => {
  if (CLUSTER !== 'devnet' || !treasuryKeypair || !connection) {
    return res.status(400).json({ error: 'Airdrop only works on devnet. On mainnet you must send real SOL manually to the treasury address.' });
  }
  try {
    const sig = await connection.requestAirdrop(treasuryKeypair.publicKey, 1 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, 'confirmed');
    res.json({ success: true, signature: sig });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== START ====================
async function start() {
  await initSolana();

  server.listen(PORT, () => {
    const isMainnet = CLUSTER === 'mainnet-beta' || CLUSTER === 'mainnet';
    console.log('\n========================================');
    console.log('💊 PILL ROYALE — REAL SOL BATTLE ROYALE');
    console.log('========================================');
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Open in browser: http://localhost:${PORT}`);
    console.log(`Cluster: ${CLUSTER}`);
    console.log(`Prize per round: ${PRIZE_SOL} SOL`);
    if (treasuryKeypair) {
      console.log(`Treasury: ${treasuryKeypair.publicKey.toBase58()}`);
    }
    console.log('========================================\n');

    if (isMainnet) {
      console.log('*** MAINNET MODE - REAL FUNDS ***');
      console.log('Private keys are loaded ONLY from TREASURY_SECRET env var or treasury.json.');
      console.log('Never share your private key, terminal output, or screenshots containing keys.');
      console.log('Bot wins will automatically return the prize to the treasury via self-transfer.');
    }

    console.log('Real players connect → they play together + bots fill the arena.');
    console.log('Winners with real wallets receive automatic on-chain payouts (no claiming).');
  });
}

start().catch(console.error);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  if (currentGame && currentGame.tickInterval) clearInterval(currentGame.tickInterval);
  server.close(() => process.exit(0));
});
