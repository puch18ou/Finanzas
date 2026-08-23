"use client";

/**
 * ============================================================================
 *  src/contexts/DemoProvider.tsx — Motor del DEMO interactivo (onboarding)
 * ============================================================================
 *
 *  Ejecuta el guion de src/lib/help/demo-script.ts sobre una BD de EJEMPLO
 *  aislada (sandbox): al iniciar entra en la BD demo (fresca), crea datos,
 *  navega y explica; al terminar/salir vuelve a tu BD real. Tus datos nunca se
 *  ven ni se tocan. Renderiza su propio overlay. Se monta una vez en el shell.
 * ============================================================================
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRepos, useDbControl } from "@/contexts/DatabaseProvider";
import { useSettings } from "@/hooks/useSettings";
import {
  DEMO_STEPS,
  newDemoTracker,
  type DemoContext as DemoCtx,
  type DemoStep,
} from "@/lib/help/demo-script";

type Rect = { top: number; left: number; width: number; height: number };

type DemoContextValue = {
  running: boolean;
  startDemo: () => void;
};

const Ctx = createContext<DemoContextValue | null>(null);

const BUBBLE_W = 360;
const PAD = 8;
const GAP = 12;

export function DemoProvider({ children }: { children: ReactNode }) {
  const repos = useRepos();
  const { settings } = useSettings();
  const { enterDemoMode, exitDemoMode } = useDbControl();
  const router = useRouter();

  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

  const trackerRef = useRef(newDemoTracker());
  // Refs para que el efecto de pasos NO se re-ejecute al cambiar los repos
  // (que cambian al entrar/salir del sandbox).
  const reposRef = useRef(repos);
  reposRef.current = repos;
  const monedaRef = useRef(settings?.monedaLocal ?? "EUR");
  monedaRef.current = settings?.monedaLocal ?? "EUR";

  useEffect(() => setMounted(true), []);

  const ctx = useCallback(
    (): DemoCtx => ({
      repos: reposRef.current,
      monedaLocal: monedaRef.current,
      tracker: trackerRef.current,
    }),
    [],
  );

  const startDemo = useCallback(() => {
    void (async () => {
      setBusy(true);
      try {
        trackerRef.current = newDemoTracker();
        await enterDemoMode();
        setIndex(0);
        setRunning(true);
      } finally {
        setBusy(false);
      }
    })();
  }, [enterDemoMode]);

  const finish = useCallback(async () => {
    setBusy(true);
    try {
      await exitDemoMode();
      try {
        window.localStorage.setItem("finanzas.demo.seen", "1");
      } catch {
        /* ignorar */
      }
    } finally {
      setRunning(false);
      setIndex(0);
      setRect(null);
      setBusy(false);
    }
  }, [exitDemoMode]);

  const locate = useCallback(async (selector?: string): Promise<Rect | null> => {
    if (!selector) return null;
    for (let i = 0; i < 25; i++) {
      const el = document.querySelector(selector);
      if (el) {
        el.scrollIntoView({ block: "center", inline: "nearest" });
        await new Promise((r) => window.setTimeout(r, 60));
        const r = el.getBoundingClientRect();
        return { top: r.top, left: r.left, width: r.width, height: r.height };
      }
      await new Promise((r) => window.setTimeout(r, 100));
    }
    return null;
  }, []);

  // Al entrar en un paso: navega, ejecuta la accion y localiza el objetivo.
  useEffect(() => {
    if (!running) return;
    const step: DemoStep | undefined = DEMO_STEPS[index];
    if (!step) return;
    let cancelled = false;

    (async () => {
      setBusy(true);
      setRect(null);
      try {
        if (step.navigate) {
          router.push(step.navigate);
          await new Promise((r) => window.setTimeout(r, 300));
        }
        if (cancelled) return;
        if (step.run) {
          await step.run(ctx());
          await new Promise((r) => window.setTimeout(r, 200));
        }
        if (cancelled) return;
        const found = await locate(step.target);
        if (!cancelled) setRect(found);
      } catch (err) {
        console.error("[demo] error en paso", index, err);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [running, index, ctx, locate, router]);

  const next = useCallback(() => {
    if (index >= DEMO_STEPS.length - 1) {
      void finish();
    } else {
      setIndex((i) => i + 1);
    }
  }, [index, finish]);

  const value = useMemo<DemoContextValue>(
    () => ({ running, startDemo }),
    [running, startDemo],
  );

  const step = running ? DEMO_STEPS[index] : undefined;

  return (
    <Ctx.Provider value={value}>
      {children}
      {mounted && running && step
        ? createPortal(
            <DemoOverlay
              step={step}
              index={index}
              total={DEMO_STEPS.length}
              rect={rect}
              busy={busy}
              onNext={next}
              onExit={() => void finish()}
            />,
            document.body,
          )
        : null}
    </Ctx.Provider>
  );
}

function DemoOverlay({
  step,
  index,
  total,
  rect,
  busy,
  onNext,
  onExit,
}: {
  step: DemoStep;
  index: number;
  total: number;
  rect: Rect | null;
  busy: boolean;
  onNext: () => void;
  onExit: () => void;
}) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isLast = index >= total - 1;

  let bubbleTop: number;
  let bubbleLeft: number;

  if (rect && step.placement === "right" && rect.left + rect.width + GAP + BUBBLE_W <= vw) {
    bubbleLeft = rect.left + rect.width + GAP;
    bubbleTop = Math.min(Math.max(PAD, rect.top), Math.max(PAD, vh - 220));
  } else if (rect) {
    const spaceBelow = vh - (rect.top + rect.height);
    const placeBelow = step.placement === "top" ? false : spaceBelow > 240;
    bubbleTop = placeBelow
      ? rect.top + rect.height + GAP
      : Math.max(PAD, rect.top - GAP - 210);
    bubbleLeft = Math.min(
      Math.max(PAD, rect.left),
      Math.max(PAD, vw - BUBBLE_W - PAD),
    );
  } else {
    bubbleTop = vh / 2 - 110;
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

  return (
    <div className="fixed inset-0 z-[110]" role="dialog" aria-modal="true">
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

      <div
        className="absolute rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg"
        style={{
          top: bubbleTop,
          left: bubbleLeft,
          width: BUBBLE_W,
          maxWidth: "calc(100vw - 16px)",
        }}
      >
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold">{step.title}</h3>
          <button
            type="button"
            onClick={onExit}
            aria-label="Salir del demo"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">{step.content}</p>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {index + 1} / {total}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onExit}
              disabled={busy}
            >
              Salir
            </Button>
            <Button type="button" size="sm" onClick={onNext} disabled={busy}>
              {busy ? "…" : isLast ? "Finalizar" : "Siguiente"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function useDemo(): DemoContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) return { running: false, startDemo: () => {} };
  return ctx;
}
