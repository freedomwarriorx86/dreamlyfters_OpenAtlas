// Small, dependency-free motion helpers. Everything respects prefers-reduced-motion.
import { useEffect, useRef, useState } from "react";

export const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Staggered reveal: children of `ref` marked with data-reveal fade/slide in once,
 * in order, when they scroll into view.
 */
export function useStagger(deps = []) {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const items = [...root.querySelectorAll("[data-reveal]")];
    if (reducedMotion() || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("in"));
      return;
    }
    let shown = 0;
    const io = new IntersectionObserver((entries) => {
      entries.filter((e) => e.isIntersecting).forEach((e) => {
        e.target.style.setProperty("--i", String(shown++ % 8));
        e.target.classList.add("in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

/** Count up to `to` once the element is visible. */
export function CountUp({ to, decimals = 0, prefix = "", suffix = "", duration = 1200 }) {
  const ref = useRef(null);
  const [v, setV] = useState(reducedMotion() ? to : 0);
  useEffect(() => {
    if (reducedMotion()) return;
    const el = ref.current;
    let raf, started = false;
    const run = () => {
      const t0 = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / duration);
        setV(to * (1 - Math.pow(1 - p, 3)));         // ease-out cubic
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !started) { started = true; run(); } }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to, duration]);
  return <span ref={ref}>{prefix}{v.toFixed(decimals)}{suffix}</span>;
}

/** Run a state change inside a View Transition when the browser supports it. */
export function withViewTransition(update) {
  if (!document.startViewTransition || reducedMotion()) { update(); return; }
  document.startViewTransition(update);
}
