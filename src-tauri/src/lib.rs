// Punto de entrada del binario nativo.
// La logica vive en TypeScript; aqui solo registramos plugins.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Plugin SQL: expone SQLite a JavaScript.
        // En el frontend hacemos `import Database from '@tauri-apps/plugin-sql'`.
        .plugin(tauri_plugin_sql::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
