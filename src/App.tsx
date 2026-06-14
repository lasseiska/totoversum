import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { Planet } from './components/Planet';
import { GameUI } from './components/GameUI';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ParticleEffects } from './components/ParticleEffects';
import { useGameStore } from './gameStore';
import './App.css';

function App() {
  const setIsDragging = useGameStore(s => s.setIsDragging);

  return (
    <ErrorBoundary>
      <div className="app-root">
        <Canvas
          camera={{ position: [0, 0, 8], fov: 45 }}
          gl={{ antialias: true }}
          style={{ background: 'transparent' }}
        >
          {/* Lighting */}
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
          <pointLight position={[-5, -5, -5]} intensity={0.4} color="#6644ff" />

          {/* Stars background */}
          <Stars radius={80} depth={50} count={5000} factor={4} saturation={0} fade speed={0.5} />

          {/* Particle Effects */}
          <ParticleEffects />

          {/* Planet */}
          <Planet />

          {/* Camera controls */}
          <OrbitControls
            enablePan={false}
            minDistance={5}
            maxDistance={14}
            autoRotate
            autoRotateSpeed={0.3}
            enableDamping
            dampingFactor={0.07}
            onStart={() => setIsDragging(true)}
            onEnd={() => setIsDragging(false)}
          />

        </Canvas>

        {/* DOM UI overlay */}
        <GameUI />
      </div>
    </ErrorBoundary>
  );
}

export default App;

