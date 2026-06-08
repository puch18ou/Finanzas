/**
 * src/lib/utils/platform.ts — Deteccion de plataforma.
 *
 * En movil (Tauri Mobile, Android/iOS) la webview lleva "Android"/"iPhone" en
 * el user agent; en escritorio (WebView2/WKWebView) no. Asi distinguimos para
 * mostrar la UI de movil (pestañas) en vez de la de escritorio (sidebar).
 */

export function isMobileApp(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}
