import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Experience } from "./components/Experience";

import { KeyboardControls } from "@react-three/drei";
import { useMemo, useState } from "react";
import { UI } from "./components/UI";
import { AudioManagerProvider } from "./hooks/useAudioManager";
import { GameStateProvider } from "./hooks/useGameState";

// Solana wallet connect (Phantom) + name for real players + SOL payouts
async function connectWallet(setWallet, setName) {
  if (window.solana && window.solana.isPhantom) {
    try {
      const resp = await window.solana.connect();
      const addr = resp.publicKey.toString();
      setWallet(addr);
      // Simple name from wallet or prompt
      const n = prompt("Enter display name (or leave for anon)", "PillPlayer") || "PillPlayer";
      setName(n);
      // Send to server for join (the backend server.js handles real players + treasury)
      // For now, store; in full game, connect WS and send {name, wallet}
      console.log("Wallet connected for real SOL:", addr);
      alert("Wallet connected! Real players only. Payouts to this wallet on win.");
    } catch (err) {
      alert("Phantom connection failed. You can paste address manually later.");
    }
  } else {
    const addr = prompt("Paste your Solana wallet address for payouts (or cancel for demo):");
    if (addr) {
      setWallet(addr);
      const n = prompt("Display name:") || "PillPlayer";
      setName(n);
    }
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
            
            {/* Wallet / Entry UI - real players + SOL (top or overlay) */}
            {!wallet && (
              <div style={{
                position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.8)', padding: '20px', borderRadius: '12px',
                color: 'white', textAlign: 'center', zIndex: 100
              }}>
                <h2>Pill Royale - Real SOL (Mainnet)</h2>
                <p>Only real players. Last pill standing wins from treasury.</p>
                <button 
                  onClick={() => connectWallet(setWallet, setPlayerName)}
                  style={{ padding: '12px 24px', fontSize: '16px', cursor: 'pointer', marginTop: '10px' }}
                >
                  Connect Phantom Wallet or Paste Address
                </button>
                <p style={{ fontSize: '12px', marginTop: '10px', opacity: 0.7 }}>
                  Your wallet is used only for payouts. No gas for playing.
                </p>
              </div>
            )}
          </div>
        </GameStateProvider>
      </AudioManagerProvider>
    </KeyboardControls>
  );
}

export default App;
