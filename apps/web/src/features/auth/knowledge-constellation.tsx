'use client';

import type { CSSProperties } from 'react';

import { useAmbientState, type AmbientState } from '@/lib/motion';

type Vars = CSSProperties & Record<string, string | number>;

function Paper({
  x,
  y,
  width,
  height,
  tilt,
  delay,
  duration,
  className,
  children,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  tilt: number;
  delay: number;
  duration: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <g
      className={`ambient-paper enter-drift ${className ?? ''}`}
      style={
        {
          '--paper-tilt': `${tilt}deg`,
          '--paper-delay': `${delay}s`,
          '--paper-duration': `${duration}s`,
          '--enter-delay': `${520 + delay * 120}ms`,
          '--enter-duration': '760ms',
          '--drift-x': `${tilt > 0 ? -14 : 14}px`,
          '--drift-y': '10px',
          transformBox: 'fill-box',
          transformOrigin: 'center',
        } as Vars
      }
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx="10"
        fill="#FCFCFB"
        stroke="var(--line)"
        strokeWidth="1.5"
      />
      {children}
    </g>
  );
}

function Ruled({ x, y, widths }: { x: number; y: number; widths: number[] }) {
  return (
    <>
      {widths.map((w, i) => (
        <rect
          key={i}
          x={x}
          y={y + i * 15}
          width={w}
          height="5"
          rx="2.5"
          fill="var(--line)"
          opacity="0.95"
        />
      ))}
    </>
  );
}

function Node({
  cx,
  cy,
  r,
  delay,
  duration,
  shift,
  variant = 'quiet',
  className,
}: {
  cx: number;
  cy: number;
  r: number;
  delay: number;
  duration: number;
  shift: number;
  variant?: 'quiet' | 'accent' | 'ring';
  className?: string;
}) {
  const fill = variant === 'accent' ? 'var(--accent)' : '#8C8B86';
  return (
    <g
      className={`ambient-node enter-drift ${className ?? ''}`}
      style={
        {
          '--node-delay': `${delay}s`,
          '--node-duration': `${duration}s`,
          '--node-shift': `${shift}px`,
          '--enter-delay': `${560 + delay * 90}ms`,
          transformBox: 'fill-box',
          transformOrigin: 'center',
        } as Vars
      }
    >
      <circle cx={cx} cy={cy} r={r * 2.6} fill={fill} opacity="0.07" />
      {variant === 'ring' ? (
        <circle cx={cx} cy={cy} r={r} fill="#FFFEFC" stroke="var(--accent)" strokeWidth="3.5" />
      ) : (
        <circle cx={cx} cy={cy} r={r} fill={fill} opacity={variant === 'accent' ? 1 : 0.75} />
      )}
    </g>
  );
}

/**
 * Decoration only. It carries no login affordance, is hidden from assistive
 * technology, and its loops stop when the tab is hidden or the form is focused.
 */
export function KnowledgeConstellation() {
  const ambient: AmbientState = useAmbientState();
  return (
    <div
      aria-hidden="true"
      data-ambient={ambient}
      className="pointer-events-none h-full w-full select-none"
    >
      <svg
        viewBox="0 0 820 900"
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
        fill="none"
      >
        <g stroke="#C9C8C3" strokeWidth="1.4" fill="none" opacity="0.85">
          <g className="scene-md">
            <path d="M212 300 C300 330 300 420 240 470" />
            <path d="M330 300 C420 250 470 170 520 140" />
            <path d="M690 250 C700 300 700 350 692 392" strokeDasharray="7 9" />
          </g>
          <g className="scene-lg">
            <path d="M372 640 C300 700 240 700 190 690" />
            <path d="M646 606 C660 700 700 780 700 826" strokeDasharray="7 9" />
            <path d="M356 132 C300 200 260 250 236 286" strokeDasharray="6 9" />
            <path d="M186 828 C260 800 330 720 366 656" />
            <path d="M430 430 C400 380 370 330 336 306" />
          </g>
        </g>

        <Paper x={44} y={168} width={168} height={148} tilt={-2.5} delay={0} duration={8.5}>
          <Ruled x={70} y={206} widths={[112, 96, 108, 74]} />
        </Paper>
        <Paper x={520} y={44} width={198} height={206} tilt={2} delay={0.9} duration={9}>
          <rect x="546" y="72" width="146" height="58" rx="6" fill="var(--line)" opacity="0.7" />
          <Ruled x={568} y={152} widths={[110, 96, 82]} />
          <circle cx="556" cy="155" r="3" fill="#B7B6B1" />
          <circle cx="556" cy="170" r="3" fill="#B7B6B1" />
          <circle cx="556" cy="185" r="3" fill="#B7B6B1" />
        </Paper>
        <Paper className="scene-lg" x={430} y={352} width={158} height={148} tilt={-1.5} delay={1.7} duration={7.5}>
          <rect x="454" y="378" width="30" height="26" rx="4" fill="var(--line)" />
          <Ruled x={470} y={424} widths={[92, 76]} />
          <circle cx="458" cy="427" r="3" fill="#B7B6B1" />
          <circle cx="458" cy="442" r="3" fill="#B7B6B1" />
        </Paper>
        <Paper className="scene-lg" x={26} y={640} width={166} height={158} tilt={2.5} delay={2.4} duration={8}>
          <rect x="56" y="700" width="18" height="46" rx="3" fill="var(--line)" />
          <rect x="84" y="676" width="18" height="70" rx="3" fill="#CFCECA" />
          <rect x="112" y="712" width="18" height="34" rx="3" fill="var(--line)" />
          <Ruled x={56} y={762} widths={[96, 64]} />
        </Paper>
        <Paper className="scene-md" x={520} y={690} width={206} height={140} tilt={-2} delay={3.1} duration={9.5}>
          <Ruled x={548} y={726} widths={[128, 112, 96]} />
          <rect x="676" y="770" width="26" height="26" rx="4" fill="var(--line)" />
        </Paper>

        {/* The single cobalt trace: drawn once per cycle, never crossing the form. */}
        <path
          className="ambient-trace"
          d="M196 528 C330 596 420 520 500 470 C568 428 630 410 678 404"
          pathLength={1}
          stroke="var(--accent)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          style={{ '--trace-length': 1 } as Vars}
        />
        <circle
          className="ambient-pulse"
          cx="690"
          cy="402"
          r="16"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
        />

        <Node className="scene-md" cx={356} cy={120} r={9} delay={0.4} duration={7} shift={-5} />
        <Node cx={326} cy={296} r={12} delay={1.1} duration={8} shift={4} />
        <Node cx={190} cy={524} r={13} delay={0} duration={6.5} shift={-6} variant="accent" />
        <Node cx={690} cy={402} r={14} delay={0.7} duration={7.5} shift={5} variant="ring" />
        <Node className="scene-lg" cx={368} cy={646} r={11} delay={1.8} duration={9} shift={-4} />
        <Node className="scene-md" cx={642} cy={600} r={12} delay={2.3} duration={7} shift={5} />
        <Node className="scene-lg" cx={182} cy={832} r={9} delay={2.9} duration={8.5} shift={-4} />
        <Node className="scene-lg" cx={702} cy={834} r={8} delay={3.4} duration={6.8} shift={4} />
      </svg>
    </div>
  );
}
