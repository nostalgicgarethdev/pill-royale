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
            
            {/* Floating wallet entry - minimal overlay so you see the 3D arena immediately */}
            {!wallet && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[60] pointer-events-auto w-[94vw] max-w-[380px]">
                <div className="bg-zinc-950/95 border border-zinc-700 rounded-3xl p-5 text-white shadow-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="text-2xl">💊</div>
                    <div>
                      <div className="font-semibold text-lg leading-none">PILL ROYALE</div>
                      <div className="text-emerald-400 text-xs">Real SOL • 3D • Real players only</div>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <input 
                      type="text" 
                      id="player-name-input"
                      defaultValue="PillPlayer"
                      placeholder="Your display name"
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500 rounded-2xl px-4 py-2 text-sm outline-none"
                    />

                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          const nameInput = document.getElementById('player-name-input').value.trim() || 'PillPlayer';
                          setPlayerName(nameInput);
                          connectWallet(setWallet, nameInput);
                        }}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-2 rounded-2xl text-sm transition"
                      >
                        Connect Phantom
                      </button>
                      <button 
                        onClick={() => {
                          const nameInput = document.getElementById('player-name-input').value.trim() || 'PillPlayer';
                          const addr = prompt('Paste Solana wallet for payout:');
                          if (addr) {
                            setWallet(addr);
                            setPlayerName(nameInput);
                          }
                        }}
                        className="px-3 py-2 text-xs border border-zinc-700 hover:bg-zinc-900 rounded-2xl"
                      >
                        Paste Addr
                      </button>
                    </div>
                  </div>

                  <div className="text-[10px] text-center text-zinc-500 mt-2">
                    Connect once • Payouts automatic to your wallet if you win
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
