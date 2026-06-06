// Punto de entrada del binario nativo.
// La logica vive en TypeScript; aqui solo registramos plugins.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Plugin SQL: expone SQLite a JavaScript.
        // En el frontend hacemos `import Database from '@tauri-apps/plugin-sql'`.
        .plugin(tauri_plugin_sql::Builder::default().build())
        // Plugin HTTP: permite hacer fetch a APIs externas (cotizaciones).
        // El scope de hosts permitidos se define en capabilities/default.json.
        .plugin(tauri_plugin_http::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
