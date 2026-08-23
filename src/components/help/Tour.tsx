"use client";

/**
 * ============================================================================
 *  src/components/help/Tour.tsx — Render del tour guiado
 * ============================================================================
 *
 *  Dibuja (via portal) el overlay oscuro con un "foco" recortado sobre el
 *  elemento actual y una burbuja con el texto del paso. Se monta UNA vez en el
 *  shell; se activa cuando el TourProvider tiene un tour en marcha.
 *
 *  Sin dependencias externas: el foco se hace con un box-shadow enorme sobre un
 *  recuadro posicionado en el rect del elemento; la burbuja se coloca debajo o
 *  encima segun el espacio. Se recalcula en scroll/resize.
 * ============================================================================
 */

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useTour } from "@/contexts/TourProvider";

type Rect = { top: number; left: number; width: number; height: number };

/**
 * Activa un elemento de forma robusta. Un `.click()` normal NO cambia las
 * pestañas de Radix (que reaccionan a foco/pointerdown, no a un click
 * sintetico), asi que enfocamos (activacion automatica de Tabs) y ademas
 * disparamos la secuencia pointer/mouse + click.
 */
function activate(el: HTMLElement) {
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
  for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
    el.dispatchEvent(
      new MouseEvent(type, { bubbles: true, cancelable: true, button: 0 }),
    );
  }
}

const BUBBLE_W = 340;
const PAD = 8; // margen del foco alrededor del elemento
const GAP = 12; // separacion burbuja-elemento

export function Tour() {
  const { steps, index, active, next, prev, stop } = useTour();
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => setMounted(true), []);

  const step = active ? steps[index] : undefined;

  const measure = useCallback(() => {
    if (!step) return;
    if (!step.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector(step.target);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: "center", inline: "nearest" });
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  // Al cambiar de paso: si el paso tiene preClick (p.ej. cambiar de pestaña),
  // lo pulsamos y esperamos a que monte el panel antes de medir.
  useLayoutEffect(() => {
    if (!active || !step) return;
    let cancelled = false;
    let timer = 0;

    const run = () => {
      if (cancelled) return;
      let delay = 0;
      if (step.preClick) {
        const trigger = document.querySelector<HTMLElement>(step.preClick);
        if (trigger) activate(trigger);
        delay = 120; // dar tiempo a que el panel de la pestaña se monte
      }
      timer = window.setTimeout(() => {
        if (!cancelled) measure();
      }, delay);
    };

    const raf = window.requestAnimationFrame(run);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [active, step, index, measure]);

  // Recalcular en scroll/resize mientras el tour esta activo.
  useEffect(() => {
    if (!active) return;
    const onChange = () => measure();
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [active, measure]);

  // Teclado: Esc cierra, flechas navegan.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, next, prev, stop]);

  if (!mounted || !active || !step) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isLast = index >= steps.length - 1;
  const isFirst = index === 0;

  // Posicion de la burbuja.
  let bubbleTop: number;
  let bubbleLeft: number;
  let placeBelow = true;

  if (rect) {
    const spaceBelow = vh - (rect.top + rect.height);
    placeBelow = step.placement === "top" ? false : spaceBelow > 220;
    bubbleTop = placeBelow
      ? rect.top + rect.height + GAP
      : Math.max(PAD, rect.top - GAP - 200);
    bubbleLeft = Math.min(
      Math.max(PAD, rect.left),
      Math.max(PAD, vw - BUBBLE_W - PAD),
    );
  } else {
    // Paso centrado (sin elemento).
    bubbleTop = vh / 2 - 100;
    bubbleLeft = vw / 2 - BUBBLE_W / 2;
  }

  const focusBox: Rect | null = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-label="Ayuda de la pantalla"
    >
      {/* Overlay + foco recortado. Si no hay elemento, overlay plano. */}
      {focusBox ? (
        <div
          className="pointer-events-none absolute rounded-lg transition-all duration-200"
          style={{
            top: focusBox.top,
            left: focusBox.left,
            width: focusBox.width,
            height: focusBox.height,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
            outline: "2px solid var(--color-primary)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/60" />
      )}

      {/* Burbuja de texto. */}
      <div
        className="absolute rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg"
        style={{ top: bubbleTop, left: bubbleLeft, width: BUBBLE_W, maxWidth: "calc(100vw - 16px)" }}
      >
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold">{step.title}</h3>
          <button
            type="button"
            onClick={stop}
            aria-label="Cerrar ayuda"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">{step.content}</p>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {index + 1} / {steps.length}
          </span>
          <div className="flex gap-2">
            {!isFirst && (
              <Button type="button" variant="outline" size="sm" onClick={prev}>
                Anterior
              </Button>
            )}
            <Button type="button" size="sm" onClick={next}>
              {isLast ? "Entendido" : "Siguiente"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
