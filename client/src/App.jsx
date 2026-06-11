import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Experience } from "./components/Experience";

import { KeyboardControls } from "@react-three/drei";
import { useMemo, useState, useEffect, Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("3D Game ErrorBoundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          position: 'absolute', inset: 0, 
          display: 'flex', alignItems: 'center', justifyContent: 'center', 
          background: '#041c0b', color: 'white', flexDirection: 'column', zIndex: 9999,
          fontFamily: 'system-ui, sans-serif'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>💊</div>
          <h2 style={{ margin: 0 }}>3D Scene Error</h2>
          <p style={{ maxWidth: 400, textAlign: 'center', opacity: 0.8 }}>
            The 3D game hit an error (probably during initial render or after entering). 
            Try refreshing. The underlying game logic (wallet, payouts, real players) is still working.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            style={{ marginTop: 20, padding: '8px 16px', background: '#22ff88', color: 'black', border: 'none', borderRadius: 8, cursor: 'pointer' }}
          >
            Reload Game
          </button>
          {this.state.error && (
            <pre style={{ fontSize: 10, marginTop: 20, opacity: 0.6, maxWidth: '80%', overflow: 'auto' }}>
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
import { UI } from "./components/UI";
import { AudioManagerProvider } from "./hooks/useAudioManager";
import { GameStateProvider } from "./hooks/useGameState";

// Wallet is now only via direct paste (no Phantom button as requested)

export const Controls = {
  forward: "forward",
  back: "back",
  left: "left",
  right: "right",
  jump: "jump",
};

function App() {
  const [wallet, setWallet] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [canStartOfficial, setCanStartOfficial] = useState(false);
  const [wsMeta, setWsMeta] = useState(null); // backend WS for real player lobby and single game enforcement

  const map = useMemo(
    () => [
      { name: Controls.forward, keys: ["ArrowUp", "KeyW"] },
      { name: Controls.back, keys: ["ArrowDown", "KeyS"] },
      { name: Controls.left, keys: ["ArrowLeft", "KeyA"] },
      { name: Controls.right, keys: ["ArrowRight", "KeyD"] },
      { name: Controls.jump, keys: ["Space"] },
    ],
    []
  );

  // Connect to backend server for real-player lobby, single-game enforcement, and 0.1 SOL payouts
  useEffect(() => {
    if (!wallet || !playerName) return;

    const wsUrl = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + (window.location.host || 'localhost:3000');
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', name: playerName, wallet }));
      setWsMeta(ws);
      window.pillWs = ws; // for UI to request official start (single game enforcement)
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'game_status') {
          setCanStartOfficial(!!msg.canStartOfficial);
        }
        if (msg.type === 'official_game_started') {
          // Server approved the single official game - now the host can safely start the 3D Playroom session
          // Non-hosts will sync via Playroomkit since they joined the same room
          console.log('Official game started by server - only 1 game, 0.1 SOL prize');
        }
      } catch (e) {}
    };

    ws.onclose = () => {
      setWsMeta(null);
      setCanStartOfficial(false);
    };

    return () => {
      if (ws.readyState === 1) ws.close();
    };
  }, [wallet, playerName]);

  return (
    <KeyboardControls map={map}>
      <AudioManagerProvider>
        <GameStateProvider>
          <ErrorBoundary>
          <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#041c0b' }}>
            <Canvas shadows camera={{ position: [0, 16, 10], fov: 42 }}>
              <color attach="background" args={["#041c0b"]} />
              <Physics>
                <Experience wallet={wallet} playerName={playerName} />
              </Physics>
            </Canvas>
            <UI wallet={wallet} playerName={playerName} canStartOfficial={canStartOfficial} />
            
            {/* Simple floating entry - ONLY name + paste wallet address. No Phantom button. */}
            {!wallet && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[60] pointer-events-auto w-[94vw] max-w-[360px]">
                <div className="bg-zinc-950/95 border border-zinc-700 rounded-3xl p-4 text-white shadow-xl">
                  <div className="text-center mb-3">
                    <div className="text-2xl mb-1">💊</div>
                    <div className="font-semibold text-lg">PILL ROYALE</div>
                    <div className="text-emerald-400 text-xs">Real SOL • 3D • Real players only</div>
                  </div>

                  <div className="space-y-2">
                    <input 
                      type="text" 
                      id="player-name-input"
                      defaultValue="PillPlayer"
                      placeholder="Your display name"
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500 rounded-2xl px-3 py-2 text-sm outline-none"
                    />

                    <input 
                      type="text" 
                      id="wallet-address-input"
                      placeholder="Paste your Solana wallet address here"
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500 rounded-2xl px-3 py-2 text-xs font-mono outline-none"
                    />

                    <button 
                      onClick={() => {
                        const nameInput = document.getElementById('player-name-input').value.trim() || 'PillPlayer';
                        const addrInput = document.getElementById('wallet-address-input').value.trim();
                        if (!addrInput) {
                          alert('Please paste your Solana wallet address to join for real SOL.');
                          return;
                        }
                        setPlayerName(nameInput);
                        setWallet(addrInput);
                      }}
                      className="w-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-black font-semibold py-2.5 rounded-2xl text-sm transition"
                    >
                      Enter with Wallet (Real SOL)
                    </button>
                  </div>

                  <div className="text-[9px] text-center text-zinc-500 mt-2 leading-tight">
                    Paste address once • Automatic payout to this wallet if you win • No gas to play
                  </div>
                </div>
              </div>
            )}
          </div>
          </ErrorBoundary>
        </GameStateProvider>
      </AudioManagerProvider>
    </KeyboardControls>
  );
}

export default App;
