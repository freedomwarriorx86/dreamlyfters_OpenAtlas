import React, { useEffect, useId, useRef, useState } from "react";
import { byId } from "../lib/glossary";
import { useAtlas } from "../store";

/** A small "?" that explains a term in plain words, with a link to the Learning Hub. */
export default function Hint({ id, text }) {
  const g = id ? byId[id] : null;
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const ref = useRef(null);
  const tipId = useId();
  const { go } = useAtlas();
  useEffect(() => {
    if (!pinned) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) { setPinned(false); setOpen(false); } };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [pinned]);
  const body = text || g?.short;
  if (!body) return null;
  return (
    <span className="hint" ref={ref} onMouseEnter={() => setOpen(true)} onMouseLeave={() => !pinned && setOpen(false)}>
      <button type="button" className="hint-btn" aria-label={`What is ${g?.term || "this"}?`} aria-describedby={open ? tipId : undefined}
        aria-expanded={open} onClick={(e) => { e.stopPropagation(); setPinned(!pinned); setOpen(!pinned); }}
        onFocus={() => setOpen(true)} onBlur={() => !pinned && setOpen(false)}>?</button>
      {open && (
        <span className="hint-pop" role="tooltip" id={tipId}>
          {g && <b>{g.term}</b>}
          <span>{body}</span>
          {g?.example && <em>e.g. {g.example}</em>}
          {g && <a href={`/learn#${g.id}`} onClick={(e) => { e.preventDefault(); go(`/learn`); setTimeout(() => document.getElementById(g.id)?.scrollIntoView({ block: "center" }), 80); }}>Learn more →</a>}
        </span>
      )}
    </span>
  );
}
