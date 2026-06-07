// ============================================================================
//  src-tauri/src/sync_server.rs — Mini-servidor de sincronizacion P2P (Lote I)
// ============================================================================
//
//  El PC hace de HOST: levanta un servidor HTTP en la LAN. El movil (cliente)
//  le envia un "intercambio" (sus cambios + lo que quiere recibir) por POST y
//  el PC responde con sus cambios. La LOGICA de fusion vive en el frontend
//  (TypeScript: SyncSession.handleExchange), no aqui: este servidor solo hace
//  de PUENTE. Por cada peticion HTTP:
//    1. emite el evento "sync://request" {id, body} al webview,
//    2. el JS procesa (handleExchange) y llama al comando `sync_respond(id, body)`,
//    3. devolvemos ese body como respuesta HTTP.
//
//  Asi mantenemos UN solo cerebro de sync (el de TS, ya probado) y el servidor
//  es tonto. tiny_http es bloqueante (un hilo dedicado); usamos canales std
//  para esperar la respuesta del JS sin tokio.
// ============================================================================

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter, State};
use tiny_http::{Header, Response, Server};

/// Cuanto espera el servidor a que el motor de sync (JS) devuelva la respuesta.
const RESPONSE_TIMEOUT_SECS: u64 = 30;

/// Estado compartido del servidor (gestionado por Tauri con `.manage`).
#[derive(Default)]
pub struct SyncServerState {
    running: Arc<AtomicBool>,
    counter: Arc<AtomicU64>,
    /// Peticiones en vuelo: id -> canal por el que el JS devuelve la respuesta.
    pending: Arc<Mutex<HashMap<u64, Sender<String>>>>,
    /// Puerto activo (None = servidor parado).
    port: Mutex<Option<u16>>,
}

fn local_ip() -> String {
    local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "0.0.0.0".to_string())
}

/// Arranca el servidor en `0.0.0.0:port`. Devuelve "ip_local:puerto".
/// Idempotente: si ya esta activo, devuelve la direccion actual.
#[tauri::command]
pub fn sync_server_start(
    app: AppHandle,
    state: State<SyncServerState>,
    port: u16,
) -> Result<String, String> {
    if state.running.load(Ordering::SeqCst) {
        let p = state.port.lock().unwrap().unwrap_or(port);
        return Ok(format!("{}:{}", local_ip(), p));
    }

    let server = Server::http(format!("0.0.0.0:{port}"))
        .map_err(|e| format!("No se pudo abrir el puerto {port}: {e}"))?;

    state.running.store(true, Ordering::SeqCst);
    *state.port.lock().unwrap() = Some(port);

    let running = state.running.clone();
    let pending = state.pending.clone();
    let counter = state.counter.clone();
    let app = app.clone();

    thread::spawn(move || {
        while running.load(Ordering::SeqCst) {
            // recv_timeout permite re-comprobar el flag `running` para poder parar.
            let req = match server.recv_timeout(Duration::from_millis(500)) {
                Ok(Some(req)) => req,
                Ok(None) => continue,
                Err(_) => break,
            };
            handle_request(req, &app, &pending, &counter);
        }
    });

    Ok(format!("{}:{}", local_ip(), port))
}

fn handle_request(
    mut req: tiny_http::Request,
    app: &AppHandle,
    pending: &Arc<Mutex<HashMap<u64, Sender<String>>>>,
    counter: &Arc<AtomicU64>,
) {
    // Healthcheck simple: GET responde "ok" sin molestar al frontend.
    if req.method() == &tiny_http::Method::Get {
        let _ = req.respond(Response::from_string("finanzas-sync ok"));
        return;
    }

    let mut body = String::new();
    let _ = req.as_reader().read_to_string(&mut body);

    let id = counter.fetch_add(1, Ordering::SeqCst);
    let (tx, rx) = channel::<String>();
    pending.lock().unwrap().insert(id, tx);

    let _ = app.emit("sync://request", serde_json::json!({ "id": id, "body": body }));

    let resp_body = match rx.recv_timeout(Duration::from_secs(RESPONSE_TIMEOUT_SECS)) {
        Ok(b) => b,
        Err(_) => {
            pending.lock().unwrap().remove(&id);
            "{\"error\":\"timeout esperando al motor de sincronizacion\"}".to_string()
        }
    };

    let header =
        Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap();
    let _ = req.respond(Response::from_string(resp_body).with_header(header));
}

/// El frontend devuelve aqui la respuesta para la peticion `id`.
#[tauri::command]
pub fn sync_respond(state: State<SyncServerState>, id: u64, body: String) {
    if let Some(tx) = state.pending.lock().unwrap().remove(&id) {
        let _ = tx.send(body);
    }
}

/// Para el servidor.
#[tauri::command]
pub fn sync_server_stop(state: State<SyncServerState>) {
    state.running.store(false, Ordering::SeqCst);
    *state.port.lock().unwrap() = None;
}

/// Devuelve el puerto activo (None si esta parado) y la IP local.
#[tauri::command]
pub fn sync_server_status(state: State<SyncServerState>) -> Option<(String, u16)> {
    state
        .port
        .lock()
        .unwrap()
        .map(|p| (local_ip(), p))
}
