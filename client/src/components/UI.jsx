import { openDiscordInviteDialog, myPlayer } from "playroomkit";
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
      className={`fixed z-10 inset-0 pointer-events-none 
      ${stage === "lobby" ? "" : "bg-transparent"} transition-colors duration-1000`}
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
              {p.state.state.profile?.name || p.state.state.name || 'Player'} {wallet && p.state.id === myPlayer()?.id ? "(You)" : ""}
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
        <div className="pointer-events-auto absolute bottom-6 left-1/2 -translate-x-1/2 w-[94vw] max-w-[380px]">
          <div className="bg-zinc-950/95 border border-zinc-700 rounded-3xl p-4 text-center text-white shadow-xl">
            <p className="text-base font-semibold">Lobby open — take your time!</p>
            <p className="text-emerald-300 text-xs mt-1 leading-tight">Enter name + paste wallet at bottom • Min 2 real players needed • Host starts when ready</p>
            <p className="text-white/60 text-[10px] mt-1">The 3D arena is live below. No rush — plenty of time before the game begins.</p>

            <div className="mt-3">
              {host ? (
                <button
                  disabled={!canStartOfficial}
                  className={`px-8 py-2.5 rounded-2xl font-black text-lg text-white ${canStartOfficial ? 'bg-gradient-to-br from-orange-500 to-yellow-500 hover:opacity-90' : 'bg-gray-600 cursor-not-allowed'}`}
                  onClick={() => {
                    if (canStartOfficial) {
                      // Tell the backend server to start the SINGLE official game (0.1 SOL only)
                      // This enforces only 1 game at a time on the server
                      if (window.pillWs && window.pillWs.readyState === 1) {
                        window.pillWs.send(JSON.stringify({ type: 'request_official_start' }));
                      }
                      // Then start the local 3D Playroom session (the host starts it for the room)
                      startGame();
                    }
                  }}
                >
                  {canStartOfficial ? 'START GAME (0.1 SOL)' : 'WAITING FOR SERVER / MORE PLAYERS'}
                </button>
              ) : (
                <p className="text-xs text-white/80">Waiting for host to start the single official game...</p>
              )}
            </div>

            {/* Removed INVITE to avoid exposing the Playroom room code #r=... in links.
                Users share the clean main URL. The server enforces the single official game. */}
            {/* <button
              onClick={openDiscordInviteDialog}
              className="mt-2 text-xs underline text-white/60 hover:text-white"
            >
              INVITE FRIENDS
            </button> */}
          </div>
        </div>
      )}

      {/* Winner payout trigger (integrates with treasury) */}
      {stage === "winner" && wallet && (
        <div className="pointer-events-auto text-center">
          <button
            onClick={handlePayout}
            className="bg-gradient-to-br from-emerald-500 to-green-600 hover:opacity-90 px-10 py-3 rounded-lg font-black text-xl text-white"
          >
            CLAIM 0.1 SOL PRIZE
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
