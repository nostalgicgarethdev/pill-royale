import { RPC } from "playroomkit";
import { useState } from "react";
import { Hexagon } from "./Hexagon";

// Pill Royale themed: Hex crumbling arena (core mechanic: tiles crack & fall when stepped on)
// Single main floor for simplicity + easy play, with some height variation if wanted.
// Colors like medicine/pills (green, pink, blue, white).

export const HEX_X_SPACING = 2.25;
export const HEX_Z_SPACING = 1.95;
export const NB_ROWS = 7;
export const NB_COLUMNS = 7;
export const FLOOR_HEIGHT = 10;

// Pill colors
export const FLOORS = [
  {
    color: "#22ff88", // lime pill
  },
  {
    color: "#ff69b4", // pink pill
  },
  {
    color: "#60a5fa", // blue pill
  },
  {
    color: "#fbbf24", // yellow/gold
  },
];

export const GameArena = ({ static: isStatic = false }) => {
  const [hexagonHit, setHexagonHit] = useState({});

  // Only wire up Playroom RPC when the real game is running (not in static lobby preview)
  if (!isStatic) {
    RPC.register("hexagonHit", (data) => {
      setHexagonHit((prev) => ({
        ...prev,
        [data.hexagonKey]: true,
      }));
    });
  }

  return (
    <group
      position-x={-((NB_COLUMNS - 1) / 2) * HEX_X_SPACING}
      position-z={-((NB_ROWS - 1) / 2) * HEX_Z_SPACING}
    >
      {/* HEXAGONS */}
      {FLOORS.map((floor, floorIndex) => (
        <group key={floorIndex} position-y={floorIndex * -FLOOR_HEIGHT}>
          {[...Array(NB_ROWS)].map((_, rowIndex) => (
            <group
              key={rowIndex}
              position-z={rowIndex * HEX_Z_SPACING}
              position-x={rowIndex % 2 ? HEX_X_SPACING / 2 : 0}
            >
              {[...Array(NB_COLUMNS)].map((_, columnIndex) => {
                const hexagonKey = `${floorIndex}-${rowIndex}-${columnIndex}`;
                const isHit = hexagonHit[hexagonKey];

                if (isStatic) {
                  // Static preview mode (lobby / before game starts):
                  // Simple visible colored hex platforms, no physics, no RPC, no hit logic.
                  // This prevents crashes from Playroomkit not being ready and gives a nice visible 3D arena.
                  return (
                    <mesh key={columnIndex} position-x={columnIndex * HEX_X_SPACING}>
                      <cylinderGeometry args={[1.1, 1.1, 0.4, 6]} />
                      <meshStandardMaterial color={floor.color} />
                    </mesh>
                  );
                }

                // Full interactive mode (after game starts)
                return (
                  <Hexagon
                    key={columnIndex}
                    position-x={columnIndex * HEX_X_SPACING}
                    color={floor.color}
                    onHit={() => {
                      setHexagonHit((prev) => ({
                        ...prev,
                        [hexagonKey]: true,
                      }));
                      RPC.call("hexagonHit", { hexagonKey }, RPC.Mode.ALL);
                    }}
                    hit={isHit}
                  />
                );
              })}
            </group>
          ))}
        </group>
      ))}
    </group>
  );
};
