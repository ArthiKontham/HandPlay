import { useHands } from '../hands/HandTrackingProvider.jsx';

const CARDS = [
  { id: 'puzzle',   icon: '🧩', name: 'Live Puzzle',    desc: 'Snap a webcam photo and solve it as a sliding puzzle with your fingers.', cls: 'c1' },
  { id: 'particle', icon: '✨', name: 'Particle Storm', desc: 'A 3D sphere of 3,000 particles you move, spin, resize and explode with your hands.', cls: 'c2' },
  { id: 'trail',    icon: '🖐️', name: 'Light Trails',   desc: 'Glowing light weaves between your fingers and trails from your fingertips.', cls: 'c3' },
  { id: 'bloom',    icon: '🌸', name: 'Bloom',         desc: 'Grow a glowing flower and open its petals with your hand gestures.', cls: 'c4' },
];

export default function Menu({ onPick }) {
  const { status, showVideoBg, setShowVideoBg } = useHands();

  return (
    <div className="menu">
      <h1 className="title">HandPlay</h1>
      <p className="subtitle">Play, create, and explore using only your hands.</p>

      <button
        className={`camchip ${status}`}
        onClick={() => setShowVideoBg(!showVideoBg)}
        title="Show or hide the camera video (hand tracking keeps running either way)"
      >
        <span className="dot" />
        {status === 'loading' ? 'Starting camera…'
          : status === 'error' ? 'Camera blocked'
          : status === 'off' ? 'Paused (tab hidden)'
          : showVideoBg ? 'Camera shown' : 'Camera hidden · tracking on'}
      </button>

      <div className="cards">
        {CARDS.map((c) => (
          <button key={c.id} className={`card ${c.cls}`} onClick={() => onPick(c.id)}>
            <span className="glow" />
            <div className="icon">{c.icon}</div>
            <h3>{c.name}</h3>
            <p>{c.desc}</p>
            <div className="play">Play →</div>
          </button>
        ))}
      </div>
    </div>
  );
}
