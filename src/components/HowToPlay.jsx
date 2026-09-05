import { useState } from 'react';

// items: [{ g: 'gesture', a: 'what it does' }, ...]
export default function HowToPlay({ title = 'How to play', items }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="howto">
      <button className="howto-head" onClick={() => setOpen((o) => !o)}>
        {title} <span className="chev">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <ul className="howto-list">
          {items.map((it, i) => (
            <li key={i}><span className="g">{it.g}</span><span className="a">{it.a}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}
