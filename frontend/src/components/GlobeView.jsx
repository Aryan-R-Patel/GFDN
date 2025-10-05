import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Line, useTexture } from "@react-three/drei";
import { CatmullRomCurve3, Vector3 } from "three";

const decisionColors = {
  APPROVE: "#34d399",
  FLAG: "#facc15",
  BLOCK: "#f87171",
};

const radius = 2.2;

// --- Earth Component ---
function Earth({ radius }) {
  const meshRef = useRef();

  // Texture URLs
  const colorMap = useTexture(
    "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
  );
  const bumpMap = useTexture(
    "https://unpkg.com/three-globe/example/img/earth-topology.png"
  );

  // Optional: Add subtle rotation to the globe itself
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.05;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, 64, 64]} />
      <meshStandardMaterial
        map={colorMap}
        bumpMap={bumpMap}
        bumpScale={0.02}
        metalness={0.1}
        roughness={0.7}
      />
    </mesh>
  );
}

// --- Helper Functions ---
function latLonToVector3(lat, lon, r, altitude = 0) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const rad = r + altitude;
  return new Vector3(
    -rad * Math.sin(phi) * Math.cos(theta),
    rad * Math.cos(phi),
    rad * Math.sin(phi) * Math.sin(theta)
  );
}

function buildArcPoints(origin, destination, r) {
  const start = latLonToVector3(origin.lat, origin.lng, r, 0);
  const end = latLonToVector3(destination.lat, destination.lng, r, 0);
  const mid = start
    .clone()
    .add(end)
    .multiplyScalar(0.5)
    .normalize()
    .multiplyScalar(r * 1.15);
  return new CatmullRomCurve3([start, mid, end]).getPoints(80);
}

// --- Transaction Arc Component ---
function TransactionArc({ arc, radius }) {
  const points = useMemo(
    () => buildArcPoints(arc.origin, arc.destination, radius),
    [arc, radius]
  );
  return <Line points={points} color={arc.color} lineWidth={2} opacity={0.8} />;
}

// --- Transactions Layer ---
function TransactionsLayer({ transactions, radius }) {
  // Sample transaction arcs for demonstration
  const arcs = useMemo(() => {
    // Create sample arcs if no transactions provided
    if (!transactions || transactions.length === 0) {
      return [
        {
          id: 1,
          origin: { lat: 40.7128, lng: -74.0060 }, // New York
          destination: { lat: 51.5074, lng: -0.1278 }, // London
          color: decisionColors.APPROVE
        },
        {
          id: 2,
          origin: { lat: 35.6762, lng: 139.6503 }, // Tokyo
          destination: { lat: 37.7749, lng: -122.4194 }, // San Francisco
          color: decisionColors.FLAG
        },
        {
          id: 3,
          origin: { lat: -33.8688, lng: 151.2093 }, // Sydney
          destination: { lat: 1.3521, lng: 103.8198 }, // Singapore
          color: decisionColors.BLOCK
        },
      ];
    }
    return transactions;
  }, [transactions]);

  return (
    <>
      {arcs.map(arc => (
        <TransactionArc key={arc.id} arc={arc} radius={radius} />
      ))}
    </>
  );
}

// --- Loading Fallback Component ---
function LoadingFallback() {
  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      color: 'white',
      fontSize: '1.5rem',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      Loading globe...
    </div>
  );
}

// --- Main Globe View Component ---
export default function GlobeView({ transactions = [] }) {
  const controlsRef = useRef();
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const autoRotationTimeoutRef = useRef(null);

  // Handle user interaction for auto-rotation
  const handleInteraction = () => {
    setIsAutoRotating(false);

    if (autoRotationTimeoutRef.current) {
      clearTimeout(autoRotationTimeoutRef.current);
    }

    autoRotationTimeoutRef.current = setTimeout(() => {
      setIsAutoRotating(true);
    }, 5000);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoRotationTimeoutRef.current) {
        clearTimeout(autoRotationTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      margin: 0,
      padding: 0,
      overflow: 'hidden',
      background: 'linear-gradient(180deg, #0a0e27 0%, #1a1f3a 100%)'
    }}>
      <Canvas
        camera={{
          position: [0, 0, 6],
          fov: 45,
          near: 0.1,
          far: 1000
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%'
        }}
      >
        <Suspense fallback={null}>
          {/* Lighting */}
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[5, 3, 5]}
            intensity={0.8}
            castShadow
          />
          <directionalLight
            position={[-5, 3, -5]}
            intensity={0.2}
          />

          {/* Stars Background */}
          <Stars
            radius={300}
            depth={60}
            count={5000}
            factor={4}
            saturation={0}
            fade={true}
            speed={0.5}
          />

          {/* Earth Globe */}
          <Earth radius={radius} />

          {/* Transaction Arcs */}
          <TransactionsLayer transactions={transactions} radius={radius} />

          {/* Camera Controls */}
          <OrbitControls
            ref={controlsRef}
            enablePan={false}
            enableZoom={true}
            enableRotate={true}
            enableDamping={true}
            dampingFactor={0.05}
            rotateSpeed={0.5}
            zoomSpeed={0.8}
            minDistance={3}
            maxDistance={10}
            autoRotate={isAutoRotating}
            autoRotateSpeed={0.3}
            onStart={handleInteraction}
          />
        </Suspense>
      </Canvas>

      {/* Optional: Info Panel Overlay */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '0.9rem',
        opacity: 0.8,
        pointerEvents: 'none',
        userSelect: 'none'
      }}>
        <div style={{ marginBottom: '5px' }}>
          <span style={{ color: decisionColors.APPROVE }}>●</span> Approved
        </div>
        <div style={{ marginBottom: '5px' }}>
          <span style={{ color: decisionColors.FLAG }}>●</span> Flagged
        </div>
        <div>
          <span style={{ color: decisionColors.BLOCK }}>●</span> Blocked
        </div>
      </div>

      {/* Optional: Controls hint */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '0.85rem',
        opacity: 0.6,
        pointerEvents: 'none',
        userSelect: 'none',
        textAlign: 'right'
      }}>
        Scroll to zoom • Drag to rotate
      </div>
    </div>
  );
}