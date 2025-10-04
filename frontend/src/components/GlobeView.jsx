import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { Suspense, useMemo } from 'react';
import { CatmullRomCurve3, Vector3 } from 'three';

const decisionColors = {
  APPROVE: '#34d399',
  FLAG: '#facc15',
  BLOCK: '#f87171',
};

function latLonToVector3(lat, lon, radius, altitude = 0) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const r = radius + altitude;
  return new Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

function buildArcPoints(origin, destination, radius) {
  const start = latLonToVector3(origin.lat, origin.lng, radius, 0);
  const end = latLonToVector3(destination.lat, destination.lng, radius, 0);
  const mid = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(radius * 1.15);
  const curve = new CatmullRomCurve3([start, mid, end]);
  return curve.getPoints(40);
}

function TransactionArc({ arc, radius }) {
  const points = useMemo(
    () => buildArcPoints(arc.origin, arc.destination, radius),
    [arc.origin, arc.destination, radius],
  );

  return (
    <line>
      <bufferGeometry setFromPoints={points} />
      <lineBasicMaterial attach="material" color={arc.color} linewidth={2} />
    </line>
  );
}

function TransactionsLayer({ arcs, radius }) {
  return arcs.map((arc) => <TransactionArc key={arc.id} arc={arc} radius={radius} />);
}

function EarthSphere({ radius }) {
  return (
    <mesh>
      <sphereGeometry args={[radius, 64, 64]} />
      <meshStandardMaterial color="#1f2937" emissive="#0f172a" roughness={0.7} metalness={0.1} />
    </mesh>
  );
}

const radius = 2.2;

export default function GlobeView({ transactions = [] }) {
  const arcs = useMemo(() => {
    const limited = transactions.slice(0, 120);
    return limited
      .filter((txn) => txn.transaction?.origin?.country && txn.transaction?.destination?.country)
      .map((txn) => ({
        id: txn.id,
        origin: {
          lat: txn.transaction.origin.lat ?? 0,
          lng: txn.transaction.origin.lng ?? 0,
        },
        destination: {
          lat: txn.transaction.destination.lat ?? 0,
          lng: txn.transaction.destination.lng ?? 0,
        },
        color: decisionColors[txn.decision.status] || '#38bdf8',
      }));
  }, [transactions]);

  return (
    <div className="panel panel--globe">
      <div className="panel__header">
        <h2>Live Transaction Globe</h2>
        <p>{transactions.length} recent events</p>
      </div>
      <div className="globe-container">
        <Suspense fallback={<div className="globe-fallback">Loading globe…</div>}>
          <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
            <color attach="background" args={[0.02, 0.03, 0.08]} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 3, 5]} intensity={1.2} />
            <EarthSphere radius={radius} />
            <TransactionsLayer arcs={arcs} radius={radius} />
            <Stars
              radius={100}
              depth={50}
              count={2000}
              factor={2.5}
              saturation={0}
              fade
            />
            <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={0.4} />
          </Canvas>
        </Suspense>
      </div>
      <div className="legend">
        <span>
          <span className="legend__dot legend__dot--green" /> Approved
        </span>
        <span>
          <span className="legend__dot legend__dot--yellow" /> Flagged
        </span>
        <span>
          <span className="legend__dot legend__dot--red" /> Blocked
        </span>
      </div>
    </div>
  );
}
