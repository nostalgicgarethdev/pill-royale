import { Environment } from "@react-three/drei";
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
  const firstNonDeadPlayer = players.find((p) => !p.state.getState("dead"));

  useEffect(() => {
    if (stage === "countdown") {
      camera.position.set(0, 50, -50);
    }
  }, [stage]);

  return (
    <>
      {/* No OrbitControls in game mode for immersive play */}
      <Environment files={"hdrs/medieval_cafe_1k.hdr"} />
      {stage === "winner" ? (
        <Podium />
      ) : (
        <>
          {stage !== "lobby" && <GameArena />}
          {players.map(({ state, controls }) => (
            <CharacterController
              key={state.id}
              state={state}
              controls={controls}
              player={me.id === state.id}
              firstNonDeadPlayer={firstNonDeadPlayer?.state.id === state.id}
              position-y={2}
              // Pass wallet info for real player display / payout
              wallet={wallet}
              playerName={playerName}
            />
          ))}
        </>
      )}
    </>
  );
};
