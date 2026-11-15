// Line icons (24x24, stroke = currentColor). Used instead of emoji everywhere.
import React from "react";

const S = ({ size = 18, children, fill = "none", sw = 1.8, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={sw}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>{children}</svg>
);

export const IconClose = (p) => <S {...p}><path d="M6 6l12 12M18 6L6 18" /></S>;
export const IconChevronLeft = (p) => <S {...p}><path d="M15 5l-7 7 7 7" /></S>;
export const IconChevronRight = (p) => <S {...p}><path d="M9 5l7 7-7 7" /></S>;
export const IconPin = (p) => <S {...p}><path d="M9 3h6l-1 6 4 4H6l4-4z" /><path d="M12 13v8" /></S>;
export const IconExpand = (p) => <S {...p}><path d="M4 10V4h6M20 14v6h-6M4 4l7 7M20 20l-7-7" /></S>;
export const IconExternal = (p) => <S {...p}><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" /></S>;
export const IconClock = (p) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></S>;
export const IconGauge = (p) => <S {...p}><path d="M4 16a8 8 0 1116 0" /><path d="M12 16l4-5" /><path d="M4 16h2M18 16h2" /></S>;
export const IconSun = (p) => <S {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></S>;
export const IconCheckCircle = (p) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></S>;
export const IconSatellite = (p) => <S {...p}><path d="M5 19l3-3" /><rect x="8" y="8" width="6" height="6" rx="1" transform="rotate(45 11 11)" /><path d="M14.5 4.5l5 5M4.5 14.5l5 5" /><path d="M17 13a4 4 0 01-4 4M20 13a7 7 0 01-7 7" /></S>;
export const IconLink = (p) => <S {...p}><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></S>;
export const IconGithub = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

// glyphs for the five test objects
export const ObjectGlyph = ({ kind, size = 16 }) => {
  switch (kind) {
    case "browndwarf": return <S size={size} sw={1.6}><circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="9" opacity=".5" /></S>;
    case "fast": return <S size={size} sw={1.6}><circle cx="15" cy="12" r="4" fill="currentColor" stroke="none" /><path d="M3 9h6M2 12h7M3 15h6" /></S>;
    case "pair": return <S size={size} sw={1.6}><circle cx="9" cy="12" r="5" fill="currentColor" stroke="none" /><circle cx="18" cy="9" r="2.5" /></S>;
    default: return <S size={size} sw={1.6}><circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></S>;
  }
};
