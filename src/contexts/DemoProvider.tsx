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
import { useQueryClient } from "@tanstack/react-query";
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

// --- Puente demo -> paginas: peticion de abrir un formulario ya rellenado ----
export type DemoFormReq = { name: string; values: Record<string, unknown> };

type DemoFormValue = {
  /** Formulario que el demo pide abrir (o null). Lo escuchan las paginas. */
  req: DemoFormReq | null;
  /** Cierra el formulario del demo. */
  clear: () => void;
};

const FormCtx = createContext<DemoFormValue | null>(null);

/** Las paginas lo usan para abrir su dialogo cuando el demo lo pide. */
export function useDemoForm(): DemoFormValue {
  return useContext(FormCtx) ?? { req: null, clear: () => {} };
}

const BUBBLE_W = 360;
const PAD = 8;
const GAP = 12;

export function DemoProvider({ children }: { children: ReactNode }) {
  const repos = useRepos();
  const { settings } = useSettings();
  const { enterDemoMode, exitDemoMode } = useDbControl();
  const router = useRouter();
  const qc = useQueryClient();

  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [formReq, setFormReq] = useState<DemoFormReq | null>(null);
  // Aviso de validacion cuando el usuario pulsa el boton pero los datos no son
  // validos (se limpia al cambiar de paso).
  const [validationError, setValidationError] = useState<string | null>(null);

  const trackerRef = useRef(newDemoTracker());
  // Refs para que el efecto de pasos NO se re-ejecute al cambiar los repos
  // (que cambian al entrar/salir del sandbox).
  const reposRef = useRef(repos);
  reposRef.current = repos;
  const monedaRef = useRef(settings?.monedaLocal ?? "EUR");
  monedaRef.current = settings?.monedaLocal ?? "EUR";

  useEffect(() => setMounted(true), []);

  const openForm = useCallback(
    (name: string, values: Record<string, unknown>) =>
      setFormReq({ name, values }),
    [],
  );
  const closeForm = useCallback(() => setFormReq(null), []);

  const ctx = useCallback(
    (): DemoCtx => ({
      repos: reposRef.current,
      monedaLocal: monedaRef.current,
      tracker: trackerRef.current,
      openForm,
      closeForm,
    }),
    [openForm, closeForm],
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
      setFormReq(null);
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
          // El paso escribio en la BD de ejemplo con los repos directamente, sin
          // pasar por React Query: refrescamos para que las tablas muestren lo
          // recien creado (cuentas, movimientos, presupuestos...).
          await qc.invalidateQueries();
          await new Promise((r) => window.setTimeout(r, 200));
        }
        if (cancelled) return;
        // El "hueco" editable es el dialogo entero (holeTarget) en formularios,
        // o el propio boton en pasos de un solo clic.
        const found = await locate(
          step.holeTarget ?? step.clickTarget ?? step.target,
        );
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
  }, [running, index, ctx, locate, router, qc]);

  const advance = useCallback(() => {
    if (index >= DEMO_STEPS.length - 1) {
      void finish();
    } else {
      setIndex((i) => i + 1);
    }
  }, [index, finish]);

  // Pasos INTERACTIVOS: esperamos a que el usuario pulse el elemento real
  // (clickTarget). Dejamos que la accion real ocurra y avanzamos. El resto de
  // la pantalla la bloquea el overlay, asi que solo cuenta el clic correcto.
  // Al cambiar de paso, limpiamos cualquier aviso de validacion anterior.
  useEffect(() => {
    setValidationError(null);
  }, [index]);

  useEffect(() => {
    if (!running) return;
    const step = DEMO_STEPS[index];
    if (!step?.clickTarget) return;
    const sel = step.clickTarget;
    const validate = step.validate;
    let done = false;
    const onClick = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (!t.closest(sel)) return;
      if (done) return;
      // Validacion: si lo que ha escrito el usuario no cumple, bloqueamos el
      // clic real (no se crea/guarda nada) y mostramos el aviso; no avanzamos.
      if (validate) {
        const err = validate(document);
        if (err) {
          e.preventDefault();
          e.stopPropagation();
          setValidationError(err);
          return;
        }
      }
      done = true;
      setValidationError(null);
      // Dar tiempo a que la accion real (abrir dialogo, enviar formulario)
      // ocurra antes de pasar de paso.
      window.setTimeout(() => advance(), 250);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [running, index, advance]);

  const next = useCallback(() => {
    const step = DEMO_STEPS[index];
    // Paso con formulario: al pasar de paso, enviamos el formulario (click en su
    // boton de aceptar) y esperamos a que se guarde antes de avanzar.
    if (step?.submitTarget) {
      void (async () => {
        setBusy(true);
        try {
          const btn = document.querySelector(
            step.submitTarget!,
          ) as HTMLElement | null;
          if (btn) btn.click();
          // Damos tiempo a que el submit persista y el dialogo se cierre.
          await new Promise((r) => window.setTimeout(r, 600));
          setFormReq(null);
          await qc.invalidateQueries();
        } finally {
          setBusy(false);
        }
        advance();
      })();
      return;
    }
    advance();
  }, [index, advance, qc]);

  const value = useMemo<DemoContextValue>(
    () => ({ running, startDemo }),
    [running, startDemo],
  );

  const formValue = useMemo<DemoFormValue>(
    () => ({ req: formReq, clear: closeForm }),
    [formReq, closeForm],
  );

  const step = running ? DEMO_STEPS[index] : undefined;

  return (
    <Ctx.Provider value={value}>
      <FormCtx.Provider value={formValue}>
        {children}
        {mounted && running && step
          ? createPortal(
              <DemoOverlay
                step={step}
                index={index}
                total={DEMO_STEPS.length}
                rect={rect}
                busy={busy}
                error={validationError}
                onNext={next}
                onExit={() => void finish()}
              />,
              document.body,
            )
          : null}
      </FormCtx.Provider>
    </Ctx.Provider>
  );
}

function DemoOverlay({
  step,
  index,
  total,
  rect,
  busy,
  error,
  onNext,
  onExit,
}: {
  step: DemoStep;
  index: number;
  total: number;
  rect: Rect | null;
  busy: boolean;
  error: string | null;
  onNext: () => void;
  onExit: () => void;
}) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isLast = index >= total - 1;
  // Paso interactivo: el usuario debe pulsar el elemento real resaltado.
  const interactive = !!step.clickTarget;

  const bubbleInner = (
    <>
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

      {error && (
        <p className="mt-2 rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
          ⚠️ {error}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {index + 1} / {total}
        </span>
        <div className="flex items-center gap-2">
          {interactive && (
            <span className="text-xs font-medium text-primary">
              👆 Pulsa el resaltado
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onExit}
            disabled={busy}
          >
            Salir
          </Button>
          {!interactive && (
            <Button type="button" size="sm" onClick={onNext} disabled={busy}>
              {busy ? "…" : isLast ? "Finalizar" : "Siguiente"}
            </Button>
          )}
        </div>
      </div>
    </>
  );

  // --- Paso INTERACTIVO: hueco editable + boton a pulsar; resto bloqueado ---
  if (interactive) {
    // El hueco editable = rect localizado (el dialogo entero en formularios, o
    // el propio boton en pasos de un solo clic).
    const hole: Rect | null = rect
      ? {
          top: rect.top - PAD,
          left: rect.left - PAD,
          width: rect.width + PAD * 2,
          height: rect.height + PAD * 2,
        }
      : null;

    // El marco resaltado va sobre el BOTON a pulsar (clickTarget), aunque el
    // hueco sea todo el dialogo.
    let clickRect: Rect | null = null;
    if (step.clickTarget) {
      const el = document.querySelector(step.clickTarget);
      if (el) {
        const r = el.getBoundingClientRect();
        clickRect = { top: r.top, left: r.left, width: r.width, height: r.height };
      }
    }
    const ring = clickRect ?? rect;

    // Posicion de la burbuja: en formularios, al lado del dialogo si cabe (o
    // arriba); en pasos de un clic, junto al objetivo.
    let bTop: number;
    let bLeft: number;
    if (step.form && hole) {
      const spaceRight = vw - (hole.left + hole.width);
      if (spaceRight >= BUBBLE_W + GAP) {
        bLeft = hole.left + hole.width + GAP;
        bTop = Math.max(PAD, Math.min(hole.top, vh - 240));
      } else if (hole.left >= BUBBLE_W + GAP) {
        bLeft = hole.left - BUBBLE_W - GAP;
        bTop = Math.max(PAD, Math.min(hole.top, vh - 240));
      } else {
        bTop = PAD + 4;
        bLeft = Math.max(PAD, vw / 2 - BUBBLE_W / 2);
      }
    } else if (hole) {
      const spaceBelow = vh - (hole.top + hole.height);
      bTop =
        spaceBelow > 240
          ? hole.top + hole.height + GAP
          : Math.max(PAD, hole.top - GAP - 210);
      bLeft = Math.min(
        Math.max(PAD, hole.left),
        Math.max(PAD, vw - BUBBLE_W - PAD),
      );
    } else {
      bTop = PAD + 4;
      bLeft = Math.max(PAD, vw / 2 - BUBBLE_W / 2);
    }

    return (
      // El root NO captura clics (pointer-events:none). Solo los 4 bloqueadores
      // y la burbuja los capturan; el hueco queda libre para que el usuario
      // rellene el formulario y pulse el boton resaltado.
      <div
        className="fixed inset-0 z-[120]"
        style={{ pointerEvents: "none" }}
        role="dialog"
        aria-modal="true"
      >
        {/* En formularios NO ponemos bloqueadores: el propio fondo del dialogo
            ya bloquea todo lo de fuera y deja el formulario (y sus desplegables)
            usable. En pasos de un boton de pagina si bloqueamos con un hueco. */}
        {step.form ? null : hole ? (
          <>
            {/* 4 bloqueadores alrededor del hueco: bloquean todo menos el hueco
                (el boton), que recibe el clic real. */}
            <div
              className="absolute"
              style={{ top: 0, left: 0, right: 0, height: Math.max(0, hole.top), pointerEvents: "auto" }}
            />
            <div
              className="absolute"
              style={{ top: hole.top + hole.height, left: 0, right: 0, bottom: 0, pointerEvents: "auto" }}
            />
            <div
              className="absolute"
              style={{ top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height, pointerEvents: "auto" }}
            />
            <div
              className="absolute"
              style={{ top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height, pointerEvents: "auto" }}
            />
          </>
        ) : (
          // Objetivo aun no localizado: bloqueo total mientras aparece.
          <div className="absolute inset-0" style={{ pointerEvents: "auto" }} />
        )}

        {/* Marco resaltado alrededor del BOTON a pulsar (no captura clics). */}
        {ring && (
          <div
            className="pointer-events-none absolute rounded-md transition-all duration-200"
            style={{
              top: ring.top - 4,
              left: ring.left - 4,
              width: ring.width + 8,
              height: ring.height + 8,
              outline: "3px solid var(--color-primary)",
              boxShadow: "0 0 0 4px color-mix(in srgb, var(--color-primary) 30%, transparent)",
            }}
          />
        )}

        <div
          className="absolute rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg"
          style={{
            top: bTop,
            left: bLeft,
            width: BUBBLE_W,
            maxWidth: "calc(100vw - 16px)",
            pointerEvents: "auto",
          }}
        >
          {bubbleInner}
        </div>
      </div>
    );
  }

  // Paso con formulario real: el dialogo trae su propio fondo oscuro. Ponemos un
  // BLOQUEADOR transparente por encima de todo (incluido el dialogo) para que no
  // se pueda tocar nada — ni «Cancelar» — salvo la burbuja del demo. Se avanza
  // solo con «Siguiente» (que envia el formulario) o «Salir».
  if (step.form) {
    return (
      <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true">
        <div className="absolute inset-0" style={{ pointerEvents: "auto" }} />
        <div
          className="absolute inset-x-0 top-0 flex justify-center px-2 pt-3"
          style={{ pointerEvents: "none" }}
        >
          <div
            className="rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg"
            style={{
              width: BUBBLE_W,
              maxWidth: "calc(100vw - 16px)",
              pointerEvents: "auto",
            }}
          >
            {bubbleInner}
          </div>
        </div>
      </div>
    );
  }

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
    <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true">
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

      {/* Bloqueador total: nada es clicable salvo la burbuja (incluido el
          elemento resaltado, para que la guia controle el ritmo). */}
      <div className="absolute inset-0" style={{ pointerEvents: "auto" }} />

      <div
        className="absolute rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg"
        style={{
          top: bubbleTop,
          left: bubbleLeft,
          width: BUBBLE_W,
          maxWidth: "calc(100vw - 16px)",
          pointerEvents: "auto",
        }}
      >
        {bubbleInner}
      </div>
    </div>
  );
}

export function useDemo(): DemoContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) return { running: false, startDemo: () => {} };
  return ctx;
}
