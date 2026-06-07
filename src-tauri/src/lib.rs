// Punto de entrada del binario nativo.
// La logica vive en TypeScript; aqui solo registramos plugins.

mod sync_server;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Plugin SQL: expone SQLite a JavaScript.
        // En el frontend hacemos `import Database from '@tauri-apps/plugin-sql'`.
        .plugin(tauri_plugin_sql::Builder::default().build())
        // Plugin HTTP: permite hacer fetch a APIs externas (cotizaciones) y,
        // en el movil, llamar al mini-servidor de sync del PC.
        .plugin(tauri_plugin_http::init())
        // Estado del mini-servidor de sincronizacion (Fase 2, Lote I). El PC
        // hace de host; ver sync_server.rs.
        .manage(sync_server::SyncServerState::default())
        .invoke_handler(tauri::generate_handler![
            sync_server::sync_server_start,
            sync_server::sync_server_stop,
            sync_server::sync_server_status,
            sync_server::sync_respond,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
