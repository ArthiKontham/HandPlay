import { useHands } from '../hands/HandTrackingProvider.jsx';

export default function GameShell({ title, onBack, children }) {
  const { status, error, showVideoBg, setShowVideoBg } = useHands();

  return (
    <div className="shell">
      <div className="topbar">
        <div className="name">{title}</div>
        <div style={{ display: 'flex', gap: '12px', pointerEvents: 'auto' }}>
          <button 
            className={`btn cam-btn ${showVideoBg ? 'active' : ''}`} 
            onClick={() => setShowVideoBg(!showVideoBg)}
          >
            {showVideoBg ? '🎥 Camera On' : '🎥 Camera Off'}
          </button>
          <button className="btn" onClick={onBack}>← Menu</button>
        </div>
      </div>

      <div className="stage">{children}</div>

      {showVideoBg && status !== 'ready' && (
        <div className="veil">
          {status === 'loading' && (
            <>
              <div className="spinner" />
              <h2>Starting camera…</h2>
              <p>Click <b>Allow</b> when your browser asks for camera access.</p>
            </>
          )}
          {status === 'error' && (
            <>
              <h2>Camera blocked</h2>
              <p>Allow camera access from the address bar and reload. {error}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
