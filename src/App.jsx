import { useState } from 'react';
import { HandTrackingProvider } from './hands/HandTrackingProvider.jsx';
import Menu from './components/Menu.jsx';
import GameShell from './components/GameShell.jsx';
import PuzzleGame from './games/PuzzleGame.jsx';
import ParticleGame from './games/ParticleGame.jsx';
import TrailGame from './games/TrailGame.jsx';
import BloomGame from './games/BloomGame.jsx';

const GAMES = {
  puzzle:   { title: 'Live Puzzle',    Comp: PuzzleGame },
  particle: { title: 'Particle Storm', Comp: ParticleGame },
  trail:    { title: 'Light Trails',   Comp: TrailGame },
  bloom:    { title: 'Bloom',          Comp: BloomGame },
};

export default function App() {
  const [screen, setScreen] = useState('menu');

  return (
    <HandTrackingProvider>
      {screen === 'menu' ? (
        <Menu onPick={setScreen} />
      ) : (
        <GameShell title={GAMES[screen].title} onBack={() => setScreen('menu')}>
          {(() => {
            const Comp = GAMES[screen].Comp;
            return <Comp />;
          })()}
        </GameShell>
      )}
    </HandTrackingProvider>
  );
}
