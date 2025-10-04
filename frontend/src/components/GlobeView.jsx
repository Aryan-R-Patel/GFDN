// GlobeView.jsx
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars, Line, useTexture } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { CatmullRomCurve3, Vector3 } from "three";

const decisionColors = {
  APPROVE: "#34d399",
  FLAG: "#facc15",
  BLOCK: "#f87171",
};
const radius = 2.2;

// --- Earth (no pointer events to allow OrbitControls) ---
function Earth({ radius }) {
  const colorMap = useTexture(
    "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
  );
  const bumpMap = useTexture(
    "https://unpkg.com/three-globe/example/img/earth-topology.png"
  );
  return (
    <mesh raycast={() => null}>
      <sphereGeometry args={[radius, 128, 128]} />
      <meshStandardMaterial map={colorMap} bumpMap={bumpMap} bumpScale={0.02} />
    </mesh>
  );
}

// --- helpers ---
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
function TransactionArc({ arc, radius }) {
  const points = useMemo(
    () => buildArcPoints(arc.origin, arc.destination, radius),
    [arc, radius]
  );
  return <Line points={points} color={arc.color} lineWidth={1} />;
}
function TransactionsLayer({ arcs, radius }) {
  return arcs.map(a => <TransactionArc key={a.id} arc={a} radius={radius} />);
}
function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j];
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
function isPointInGeoFeature(point, feature) {
  const g = feature.geometry;
  if (!g) return false;
  if (g.type === "Polygon") {
    const rings = g.coordinates;
    if (!pointInRing(point, rings[0])) return false;
    for (let k = 1; k < rings.length; k++)
      if (pointInRing(point, rings[k])) return false;
    return true;
  }
  if (g.type === "MultiPolygon") {
    for (const poly of g.coordinates) {
      if (pointInRing(point, poly[0])) {
        let hole = false;
        for (let k = 1; k < poly.length; k++)
          if (pointInRing(point, poly[k])) {
            hole = true;
            break;
          }
        if (!hole) return true;
      }
    }
  }
  return false;
}
function pointToLatLon(p) {
  const r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
  const phi = Math.acos(p.y / r);
  const lat = 90 - (phi * 180) / Math.PI;
  const theta = Math.atan2(p.z, -p.x);
  const lon = (theta * 180) / Math.PI - 180;
  return { lat, lon };
}

// --- main ---
export default function GlobeView({ transactions = [] }) {
  const arcs = useMemo(() => [], []);

  const [countries, setCountries] = useState([]);
  const [hoverCountryIdx, setHoverCountryIdx] = useState(null);
  const controlsRef = useRef();
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const autoRotationTimeoutRef = useRef(null);

  // Function to handle user interaction
  const handleInteraction = () => {
    setIsAutoRotating(false);
    // Clear any existing timeout
    if (autoRotationTimeoutRef.current) {
      clearTimeout(autoRotationTimeoutRef.current);
    }
    // Set a new timeout to resume rotation after 5 seconds of inactivity
    autoRotationTimeoutRef.current = setTimeout(() => {
      setIsAutoRotating(true);
    }, 5000);
  };

  useEffect(() => {
    let mounted = true;
    fetch(
      "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson"
    )
      .then(r => r.json())
      .then(j => {
        if (mounted) setCountries(j.features || []);
      })
      .catch(err => console.warn("Failed to load countries geojson", err));
    return () => {
      mounted = false;
      if (autoRotationTimeoutRef.current) {
        clearTimeout(autoRotationTimeoutRef.current);
      }
    };
  }, []);

  // Removed handlePointerMove and handleClick since they block OrbitControls

  return (
    <Suspense fallback={<div className="globe-fallback">Loading globe…</div>}>
      <div
        style={{
          width: "100vw",
          height: "100vh",
          position: "fixed",
          inset: 0,
          zIndex: 0,
        }}
      >
        <Canvas
          camera={{ position: [0, 0, 6], fov: 45 }}
          style={{ position: "absolute", inset: 0 }}
        >
          <color attach="background" args={[0, 0, 0]} />
          <ambientLight intensity={0.8} />
          <directionalLight position={[3, 3, 5]} intensity={1} />
          <OrbitControls
            ref={controlsRef}
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={3}
            maxDistance={10}
            autoRotate={isAutoRotating}
            autoRotateSpeed={0.5}
            onStart={handleInteraction}
          />
          <Stars
            radius={300}
            depth={60}
            count={20000}
            factor={7}
            saturation={0}
            fade={true}
          />
          <Earth radius={radius} />

          {/* Earth with no events - allows OrbitControls to work */}
          <Earth radius={radius} />

          {/* Removed hover outline to allow full interaction */}

          <TransactionsLayer arcs={arcs} radius={radius} />

          <Stars
            radius={100}
            depth={50}
            count={2000}
            factor={2.5}
            saturation={0}
            fade
          />

          <OrbitControls
            makeDefault
            ref={controlsRef}
            enablePan={false}
            enableZoom
            enableRotate
            enableDamping
            dampingFactor={0.08}
            rotateSpeed={0.8}
            minDistance={radius * 1.2}
            maxDistance={radius * 4}
            autoRotate={false}
          />
        </Canvas>
      </div>
    </Suspense>
  );
}
