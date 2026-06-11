import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Experience } from "./components/Experience";

import { KeyboardControls } from "@react-three/drei";
import { useMemo, useState } from "react";
import { UI } from "./components/UI";
import { AudioManagerProvider } from "./hooks/useAudioManager";
import { GameStateProvider } from "./hooks/useGameState";

// Solana wallet connect (Phantom) for real players + SOL payouts
// Name comes from the form input above
async function connectWallet(setWallet, nameToUse) {
  if (window.solana && window.solana.isPhantom) {
    try {
      const resp = await window.solana.connect();
      const addr = resp.publicKey.toString();
      setWallet(addr);
      console.log("Wallet connected for real SOL:", addr);
      // The name is already set from the input in the onClick
    } catch (err) {
      alert("Phantom connection failed or was cancelled. You can still paste the address using the button below.");
    }
  } else {
    alert("Phantom wallet not detected. Use the 'Paste Address' button instead, or install Phantom extension.");
  }
}

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

  return (
    <KeyboardControls map={map}>
      <AudioManagerProvider>
        <GameStateProvider>
          <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
            <Canvas shadows camera={{ position: [0, 16, 10], fov: 42 }}>
              <color attach="background" args={["#041c0b"]} />
              <Physics>
                <Experience wallet={wallet} playerName={playerName} />
              </Physics>
            </Canvas>
            <UI wallet={wallet} playerName={playerName} />
            
            {/* Clean, easy wallet entry - no black screen blocking the 3D start view */}
            {!wallet && (
              <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-auto bg-black/40">
                <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-8 max-w-md w-full mx-4 text-white shadow-2xl">
                  <div className="text-center mb-6">
                    <div className="text-4xl mb-2">💊</div>
                    <h1 className="text-3xl font-bold tracking-tight">PILL ROYALE</h1>
                    <p className="text-emerald-400 mt-1">Real SOL • Mainnet • Only real players</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-1">Display Name</label>
                      <input 
                        type="text" 
                        id="player-name-input"
                        defaultValue="PillPlayer"
                        className="w-full bg-zinc-800 border border-zinc-700 focus:border-emerald-500 rounded-xl px-4 py-3 text-lg outline-none"
                        placeholder="Your name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-1">Solana Wallet (for automatic payout)</label>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            const nameInput = document.getElementById('player-name-input').value.trim() || 'PillPlayer';
                            setPlayerName(nameInput);
                            connectWallet(setWallet, nameInput);
                          }}
                          className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-3 rounded-xl transition"
                        >
                          Connect Phantom
                        </button>
                        <button 
                          onClick={() => {
                            const nameInput = document.getElementById('player-name-input').value.trim() || 'PillPlayer';
                            const addr = prompt('Paste your Solana wallet address for real SOL payouts:');
                            if (addr) {
                              setWallet(addr);
                              setPlayerName(nameInput);
                            }
                          }}
                          className="px-4 py-3 border border-zinc-700 hover:bg-zinc-800 rounded-xl text-sm"
                        >
                          Paste Address
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-1">Your wallet receives the prize automatically if you win. No gas fees to play.</p>
                    </div>
                  </div>

                  <div className="mt-6 text-center text-xs text-zinc-500">
                    3D hex crumbling arena • Last real pill standing wins from the treasury
                  </div>
                </div>
              </div>
            )}
          </div>
        </GameStateProvider>
      </AudioManagerProvider>
    </KeyboardControls>
  );
}

export default App;
