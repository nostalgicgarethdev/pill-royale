import { useThree } from "@react-three/fiber";
import { myPlayer } from "playroomkit";
import { useEffect } from "react";
import { useGameState } from "../hooks/useGameState";
import { CharacterController } from "./CharacterController";
import { GameArena } from "./GameArena";
import { Podium } from "./Podium";

// Adapted for Pill Royale: 3D crumbling hex arena, only real players (from wallet connect + Playroom/WS)
// Simple & easy to play with CharacterController (WASD + jump, physics)

export const Experience = ({ wallet, playerName }) => {
  const { players, stage } = useGameState();
  const me = myPlayer();
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    if (stage === "countdown") {
      camera.position.set(0, 50, -50);
    }
  }, [stage]);

  // Set a nice camera view for the lobby/pre-game so it's not a black void
  useEffect(() => {
    if (stage === "lobby") {
      // Overview angle showing the full 3D hex arena nicely (not too high, fills the screen)
      camera.position.set(0, 25, 35);
      camera.lookAt(0, 5, 0);
    } else if (stage === "countdown") {
      camera.position.set(0, 50, -50);
    }
  }, [stage, camera]);

  const isLobby = stage === "lobby";
  const showPlayers = !isLobby && players.length > 0;

  // Safe access for firstNonDeadPlayer (Playroom state may not be ready in lobby)
  const firstNonDeadPlayer = !isLobby 
    ? players.find((p) => p.state && !p.state.getState("dead")) 
    : null;

  return (
    <>
      {/* Vibrant but dark background for the 3D pill arena */}
      <color attach="background" args={["#0a1f12"]} />

      {/* Soft ground so the hex platforms don't float in void */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position-y={-0.05} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshLambertMaterial color="#112211" />
      </mesh>

      {/* Good lighting so the colored hexes actually show up bright instead of black */}
      <ambientLight intensity={0.6} />
      <directionalLight 
        position={[20, 30, 10]} 
        intensity={1.2} 
        castShadow 
        shadow-mapSize-width={1024} 
        shadow-mapSize-height={1024} 
      />
      <hemisphereLight 
        skyColor="#aaffaa" 
        groundColor="#112211" 
        intensity={0.5} 
      />

      {/* Always show the crumbling hex arena - this is the main visual before/during game */}
      <GameArena />

      {/* Only render real players (pills) + controllers AFTER lobby (i.e. game has started) */}
      {/* This prevents white screen / crashes during initial render, wallet entry, or lobby phase */}
      {/* The arena itself is still visible for preview while waiting for more players */}
      {showPlayers && players.map(({ state, controls }) => (
        <CharacterController
          key={state.id}
          state={state}
          controls={controls}
          player={me && me.id === state.id}
          firstNonDeadPlayer={firstNonDeadPlayer?.state?.id === state.id}
          position-y={2}
          wallet={wallet}
          playerName={playerName}
        />
      ))}

      {/* Winner podium when someone wins */}
      {stage === "winner" && <Podium />}
    </>
  );
};

