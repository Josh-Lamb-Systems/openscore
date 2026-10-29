import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { monotonePath } from "~/lib/monotone-path";
import { respondentStrings as t } from "~/lib/respondent-strings";
import type { ProcessCurveQuestion } from "~/lib/scorecard/schema";
import { cn } from "~/lib/utils";

/**
 * "Find the constraint" chart (docs/SPEC.md §4.1). Interactive when `onChange`
 * is given (respondent question), read-only otherwise (result page, previews).
 *
 * Geometry is computed in real pixels from the measured width so handles and
 * text stay a usable size on phones; step labels are HTML so long labels wrap.
 */

const HEIGHT = 300;
const TOP_Y = 36; // value = max
const BOTTOM_Y = 196; // value = min
const AXIS_Y = 256;
const GUTTER = 64; // left column for the top/bottom labels
const RIGHT_PAD = 12;
/** Below this column width, step labels alternate between two rows so long words don't collide. */
const STAGGER_BELOW = 88;
const LABEL_ROW = 22;
const SSR_WIDTH = 720;

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export interface ProcessCurveChartProps {
  question: ProcessCurveQuestion;
  /** Value per step id; null = not answered yet (points sit at their starting values). */
  values: Record<string, number> | null;
  onChange?: (values: Record<string, number>) => void;
  disabled?: boolean;
  className?: string;
}

export function ProcessCurveChart({ question: q, values, onChange, disabled, className }: ProcessCurveChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(SSR_WIDTH);
  const [dragging, setDragging] = useState<string | null>(null);
  const interactive = !!onChange && !disabled;

  useIsoLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(Math.max(240, Math.round(el.getBoundingClientRect().width)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = q.steps.length;
  const current = Object.fromEntries(q.steps.map((s) => [s.id, values?.[s.id] ?? s.start]));
  const range = q.max - q.min || 1;
  const spacing = (width - GUTTER - RIGHT_PAD) / Math.max(n, 1);
  const stagger = spacing < STAGGER_BELOW;
  const xOf = (i: number) => GUTTER + spacing * (i + 0.5);
  const yOf = (v: number) => BOTTOM_Y - ((v - q.min) / range) * (BOTTOM_Y - TOP_Y);
  const midY = (TOP_Y + BOTTOM_Y) / 2;
  const points = q.steps.map((s, i) => ({ x: xOf(i), y: yOf(current[s.id]) }));

  // Only call out the constraint once the respondent has answered (before that, every
  // point sits at its start and a tie would arbitrarily flag the first step).
  let constraintIndex = -1;
  if (values) {
    q.steps.forEach((s, i) => {
      if (constraintIndex === -1 || current[s.id] < current[q.steps[constraintIndex].id]) constraintIndex = i;
    });
  }

  const set = (stepId: string, v: number) => {
    if (!onChange) return;
    const clamped = Math.min(q.max, Math.max(q.min, Math.round(v)));
    if (values && values[stepId] === clamped) return;
    onChange({ ...current, [stepId]: clamped });
  };

  const valueAtClientY = (clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const y = clientY - rect.top;
    return q.min + ((BOTTOM_Y - y) / (BOTTOM_Y - TOP_Y)) * range;
  };

  const onKey = (stepId: string) => (e: React.KeyboardEvent) => {
    const v = current[stepId];
    const big = Math.max(1, Math.round(range / 5));
    const next =
      e.key === "ArrowUp" || e.key === "ArrowRight"
        ? v + 1
        : e.key === "ArrowDown" || e.key === "ArrowLeft"
          ? v - 1
          : e.key === "PageUp"
            ? v + big
            : e.key === "PageDown"
              ? v - big
              : e.key === "Home"
                ? q.min
                : e.key === "End"
                  ? q.max
                  : null;
    if (next == null) return;
    e.preventDefault();
    set(stepId, next);
  };

  const areaPath =
    n > 1 ? `${monotonePath(points)} L${points[n - 1].x},${midY} L${points[0].x},${midY} Z` : "";

  return (
    <div
      ref={wrapRef}
      className={cn("relative w-full select-none", className)}
      // Extra room for wrapped step labels, and for the drag hint while unanswered.
      style={{ height: HEIGHT + (stagger ? LABEL_ROW : 0) + (interactive && !values ? 44 : 24) }}
    >
      <svg
        ref={svgRef}
        width={width}
        height={HEIGHT}
        className="block overflow-visible"
        role="group"
        aria-label={q.text || "Process curve"}
      >
        {/* Grid: top, bottom and dotted midline */}
        <g stroke="currentColor" strokeOpacity={0.15}>
          <line x1={GUTTER - 8} x2={width} y1={TOP_Y} y2={TOP_Y} />
          <line x1={GUTTER - 8} x2={width} y1={BOTTOM_Y} y2={BOTTOM_Y} />
          <line x1={GUTTER - 8} x2={width} y1={midY} y2={midY} strokeDasharray="3 5" strokeOpacity={0.35} />
        </g>

        {/* Drop lines from each point to the step axis */}
        <g stroke="currentColor" strokeOpacity={0.3} strokeDasharray="2 4">
          {points.map((p, i) => (
            <line key={q.steps[i].id} x1={p.x} x2={p.x} y1={p.y} y2={AXIS_Y} />
          ))}
        </g>

        {/* Shaded area between the curve and the midline, then the curve itself */}
        {n > 1 && (
          <>
            <path d={areaPath} fill="var(--os-primary)" fillOpacity={0.14} />
            <path d={monotonePath(points)} fill="none" stroke="var(--os-primary)" strokeWidth={3} strokeLinecap="round" />
          </>
        )}

        {/* Step axis */}
        <line x1={xOf(0)} x2={xOf(n - 1)} y1={AXIS_Y} y2={AXIS_Y} stroke="currentColor" strokeOpacity={0.8} strokeWidth={2.5} />
        {points.map((p, i) => (
          <circle key={q.steps[i].id} cx={p.x} cy={AXIS_Y} r={7} fill="currentColor" />
        ))}

        {/* Drag columns: the whole column of a step is a target, so a tap moves the point there */}
        {interactive &&
          q.steps.map((s, i) => (
            <rect
              key={s.id}
              x={xOf(i) - spacing / 2}
              y={TOP_Y - 24}
              width={spacing}
              height={BOTTOM_Y - TOP_Y + 48}
              fill="transparent"
              className="cursor-ns-resize"
              style={{ touchAction: "none" }}
              onPointerDown={(e) => {
                (e.currentTarget as Element).setPointerCapture(e.pointerId);
                setDragging(s.id);
                set(s.id, valueAtClientY(e.clientY));
              }}
              onPointerMove={(e) => dragging === s.id && set(s.id, valueAtClientY(e.clientY))}
              onPointerUp={() => setDragging(null)}
              onPointerCancel={() => setDragging(null)}
            />
          ))}

        {/* Handles */}
        {q.steps.map((s, i) => {
          const p = points[i];
          const isConstraint = i === constraintIndex;
          return (
            <g
              key={s.id}
              role={interactive ? "slider" : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-label={s.label}
              aria-valuemin={interactive ? q.min : undefined}
              aria-valuemax={interactive ? q.max : undefined}
              aria-valuenow={interactive ? current[s.id] : undefined}
              aria-valuetext={interactive ? `${s.label}: ${current[s.id]} of ${q.max}` : undefined}
              onKeyDown={interactive ? onKey(s.id) : undefined}
              className="pointer-events-none outline-none [&:focus-visible_.os-focus]:opacity-100"
            >
              <circle className="os-focus opacity-0" cx={p.x} cy={p.y} r={16} fill="none" stroke="var(--os-primary)" strokeWidth={2} />
              <circle
                cx={p.x}
                cy={p.y}
                r={isConstraint ? 8 : 9}
                fill={isConstraint ? "var(--os-surface)" : "var(--os-primary)"}
                stroke={isConstraint ? "currentColor" : "var(--os-surface)"}
                strokeWidth={isConstraint ? 3 : 2.5}
              />
            </g>
          );
        })}
      </svg>

      {/* Top / bottom labels */}
      <span className="absolute left-0 w-14 -translate-y-1/2 text-right text-sm opacity-75" style={{ top: TOP_Y }}>
        {q.topLabel}
      </span>
      <span className="absolute left-0 w-14 -translate-y-1/2 text-right text-sm opacity-75" style={{ top: BOTTOM_Y }}>
        {q.bottomLabel}
      </span>

      {/* Constraint callout under its point */}
      {constraintIndex >= 0 && q.constraintLabel && (
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap text-sm font-semibold"
          style={{ left: points[constraintIndex].x, top: Math.min(points[constraintIndex].y + 16, AXIS_Y - 26) }}
        >
          ▼ {q.constraintLabel}
        </span>
      )}

      {/* Step labels */}
      {q.steps.map((s, i) => (
        <span
          key={s.id}
          className="absolute -translate-x-1/2 text-center text-sm font-medium leading-tight sm:text-base"
          style={{
            left: xOf(i),
            top: AXIS_Y + 18 + (stagger && i % 2 === 1 ? LABEL_ROW : 0),
            width: stagger ? spacing * 2 - 6 : Math.max(spacing - 6, 40),
          }}
        >
          {s.label}
        </span>
      ))}

      {interactive && !values && (
        <p className="absolute inset-x-0 text-center text-sm opacity-60" style={{ top: HEIGHT + 22 + (stagger ? LABEL_ROW : 0), paddingLeft: GUTTER }}>
          {t.dragPoints}
        </p>
      )}
    </div>
  );
}
