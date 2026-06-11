import { openDiscordInviteDialog } from "playroomkit";
import { useAudioManager } from "../hooks/useAudioManager";
import { useGameState } from "../hooks/useGameState";

// Pill Royale UI - adapted from template + real wallet/SOL elements
export const UI = ({ wallet, playerName }) => {
  const { audioEnabled, setAudioEnabled } = useAudioManager();
  const { timer, startGame, host, stage, players } = useGameState();

  // On winner stage, if local player won, trigger payout to the connected wallet
  // (integrates with previous server.js treasury for real SOL - only real players)
  const handlePayout = () => {
    if (wallet) {
      // In full setup: send to your server.js via WS or fetch to trigger the automatic payout
      // For now, alert + log (replace with real call to server with wallet)
      console.log("TRIGGER PAYOUT to wallet:", wallet);
      alert(`Payout initiated to ${wallet.slice(0,4)}...${wallet.slice(-4)} ! Check your wallet. (Connect to backend server for real tx)`);
      // Example: fetch('/payout', { method: 'POST', body: JSON.stringify({ wallet, amount: 0.1 }) })
    }
  };

  return (
    <main
      className={`fixed z-10 inset-0 pointer-events-none grid place-content-center
      ${
        stage === "lobby" ? "bg-black/40" : "bg-transparent"
      } transition-colors duration-1000`}
    >
      {/* Real players list (from Playroom + wallet info) */}
      <div className="absolute top-28 left-4 md:top-4 md:-translate-x-1/2 md:left-1/2 flex flex-col md:flex-row gap-4">
        {players.map((p) => (
          <div key={p.state.id} className="flex flex-col items-center">
            <img
              className={`w-12 h-12 rounded-full ${
                p.state.getState("dead") ? "filter grayscale" : ""
              }`}
              src={p.state.state.profile.photo || "https://via.placeholder.com/48/22ff88/000?text=P"}
            />
            <p className="text-white max-w-20 truncate text-xs">
              {p.state.state.profile.name} {wallet && p.state.id === myPlayer()?.id ? "(You)" : ""}
            </p>
          </div>
        ))}
      </div>

      {timer >= 0 && (
        <h2 className="absolute right-4 top-4 text-5xl text-white font-black">
          {timer}
        </h2>
      )}

      {/* Pill Royale logo / prize info */}
      <div className="absolute top-4 left-4 text-white">
        <div className="font-bold text-xl">💊 PILL ROYALE</div>
        <div className="text-xs opacity-70">Real SOL • Only real players</div>
        {wallet && <div className="text-xs mt-1 text-emerald-400">Connected: {wallet.slice(0,4)}...{wallet.slice(-4)}</div>}
      </div>

      {stage === "lobby" && (
        <div className="pointer-events-auto text-center max-w-md mx-auto">
          <div className="mb-4">
            <p className="text-white text-lg">Lobby open — take your time!</p>
            <p className="text-emerald-300 text-sm mt-1">Connect wallet above (if not already) • Min 2 real players • Host starts when ready</p>
            <p className="text-white/60 text-xs mt-2">Game will wait for players to join and set up. No rush — more time before it loads.</p>
          </div>

          {host ? (
            <button
              className="bg-gradient-to-br from-orange-500 to-yellow-500 hover:opacity-90 transition-all px-16 py-4 rounded-2xl font-black text-2xl text-white shadow-xl"
              onClick={startGame}
            >
              START GAME
            </button>
          ) : (
            <div className="text-white/80">
              Waiting for host to start...<br />
              <span className="text-xs">Invite friends with the button below</span>
            </div>
          )}

          <button
            onClick={openDiscordInviteDialog}
            className="mt-3 block mx-auto text-sm underline text-white/70 hover:text-white"
          >
            INVITE FRIENDS
          </button>
        </div>
      )}

      {/* Winner payout trigger (integrates with treasury) */}
      {stage === "winner" && wallet && (
        <div className="pointer-events-auto text-center">
          <button
            onClick={handlePayout}
            className="bg-gradient-to-br from-emerald-500 to-green-600 hover:opacity-90 px-10 py-3 rounded-lg font-black text-xl text-white"
          >
            CLAIM YOUR SOL PRIZE
          </button>
          <p className="text-xs mt-2 text-white/70">Automatic payout to your connected wallet</p>
        </div>
      )}

      <button
        className="absolute top-1/2 right-4 -translate-y-1/2 pointer-events-auto"
        onClick={() => setAudioEnabled(!audioEnabled)}
      >
        {audioEnabled ? "🔊" : "🔇"}
      </button>
    </main>
  );
};
