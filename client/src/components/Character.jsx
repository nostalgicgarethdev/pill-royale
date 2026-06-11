import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import React, { useRef } from "react";

/**
 * Simple visible "Pill" character using primitives (no external model needed).
 * Capsule-like for easy 3D pill/bean look. Works with CharacterController.
 */
export function Character({
  color = "#22ff88",
  name = "Player",
  ...props
}) {
  const textRef = useRef();

  useFrame(({ camera }) => {
    if (textRef.current) {
      textRef.current.lookAt(camera.position);
    }
  });

  return (
    <group {...props} dispose={null}>
      {/* Name label above */}
      <group ref={textRef}>
        <Text
          position-y={2.8}
          fontSize={0.5}
          anchorX="center"
          anchorY="middle"
          color="white"
        >
          {name}
        </Text>
        <Text
          position-y={2.78}
          position-x={0.02}
          position-z={-0.02}
          fontSize={0.5}
          anchorX="center"
          anchorY="middle"
          color="black"
        >
          {name}
        </Text>
      </group>

      {/* Simple pill/bean body using primitives */}
      <group>
        {/* Main body cylinder */}
        <mesh position-y={1.0}>
          <cylinderGeometry args={[0.6, 0.6, 1.8, 8]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {/* Top cap */}
        <mesh position-y={1.9}>
          <sphereGeometry args={[0.6]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {/* Bottom cap */}
        <mesh position-y={0.1}>
          <sphereGeometry args={[0.6]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {/* Highlight ring for "you" */}
        {props.player && (
          <mesh position-y={0.2} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.9, 0.08, 8, 16]} />
            <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={0.3} />
          </mesh>
        )}
      </group>
    </group>
  );
}
