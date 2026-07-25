// ============================================================================
//  src-tauri/src/sync_client.rs — Cliente HTTP nativo para la sync P2P
// ============================================================================
//
//  El movil (cliente) hace POST al mini-servidor de sync del PC (ver
//  sync_server.rs) en una IP de la LAN (192.168.x / 10.x / 172.x). Antes esto
//  se hacia con el plugin HTTP de Tauri, pero su validacion de "scope" rechaza
//  las IPs con comodin en Android ("url not allowed on the configured scope"),
//  asi que la sync solo funcionaba con la IP escrita entera y a mano.
//
//  Solucion: hacer la peticion aqui, en Rust, con un cliente HTTP/1.1 minimo
//  sobre TcpStream (el trafico es cleartext en la LAN, sin TLS, igual que el
//  servidor tiny_http). Al no pasar por el plugin NO hay scope que validar, y
//  funciona en CUALQUIER red/IP sin mantener listas de permisos. Sin deps.
// ============================================================================

use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

const CONNECT_TIMEOUT_SECS: u64 = 10;
const IO_TIMEOUT_SECS: u64 = 30;

/// Descompone "http://host:puerto/path" en (host:puerto, path). Sin dependencias.
fn split_url(url: &str) -> Result<(String, String), String> {
    let rest = url
        .strip_prefix("http://")
        .ok_or_else(|| format!("La direccion debe empezar por http:// ({url})"))?;
    match rest.find('/') {
        Some(i) => Ok((rest[..i].to_string(), rest[i..].to_string())),
        None => Ok((rest.to_string(), "/".to_string())),
    }
}

/// POST de un cuerpo JSON al servidor de sync del PC. Devuelve el cuerpo de la
/// respuesta (JSON). No pasa por el scope del plugin HTTP -> vale para cualquier
/// IP de la LAN, en Android y en escritorio por igual.
#[tauri::command]
pub fn lan_http_post(url: String, body: String) -> Result<String, String> {
    let (authority, path) = split_url(&url)?;

    // Resolver la direccion. Si es una IP (caso LAN) no hay DNS de por medio.
    let addr = authority
        .to_socket_addrs()
        .map_err(|e| format!("Direccion invalida '{authority}': {e}"))?
        .next()
        .ok_or_else(|| format!("No se pudo resolver '{authority}'"))?;

    let mut stream =
        TcpStream::connect_timeout(&addr, Duration::from_secs(CONNECT_TIMEOUT_SECS))
            .map_err(|e| format!("No se pudo conectar con {authority}: {e}"))?;
    stream
        .set_read_timeout(Some(Duration::from_secs(IO_TIMEOUT_SECS)))
        .ok();
    stream
        .set_write_timeout(Some(Duration::from_secs(IO_TIMEOUT_SECS)))
        .ok();

    // Peticion HTTP/1.1 minima. Content-Length en BYTES (String::len ya es bytes).
    // Connection: close -> el servidor cierra tras responder y read_to_end acaba.
    let request = format!(
        "POST {path} HTTP/1.1\r\n\
         Host: {authority}\r\n\
         Content-Type: application/json\r\n\
         Content-Length: {len}\r\n\
         Connection: close\r\n\
         \r\n\
         {body}",
        len = body.len(),
    );

    stream
        .write_all(request.as_bytes())
        .map_err(|e| format!("Error enviando la peticion: {e}"))?;
    stream.flush().ok();

    let mut raw = Vec::new();
    stream
        .read_to_end(&mut raw)
        .map_err(|e| format!("Error leyendo la respuesta: {e}"))?;

    let text = String::from_utf8_lossy(&raw);
    // Separar cabeceras del cuerpo por la primera linea en blanco.
    let (headers, resp_body) = match text.find("\r\n\r\n") {
        Some(i) => (&text[..i], text[i + 4..].to_string()),
        None => return Err("Respuesta HTTP mal formada (sin cabeceras)".to_string()),
    };

    // Codigo de estado de la primera linea: "HTTP/1.1 200 OK".
    let status = headers
        .lines()
        .next()
        .and_then(|l| l.split_whitespace().nth(1))
        .and_then(|s| s.parse::<u16>().ok())
        .unwrap_or(0);

    if (200..300).contains(&status) {
        Ok(resp_body)
    } else {
        Err(format!("El PC respondio {status}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tiny_http::{Response, Server};

    /// Round-trip real contra un tiny_http (el mismo servidor que usa la app):
    /// el cliente hace POST y el servidor devuelve el cuerpo tal cual. Verifica
    /// conexion, Content-Length, Connection: close y el parseo de la respuesta.
    #[test]
    fn post_roundtrip_devuelve_el_cuerpo() {
        let server = Server::http("127.0.0.1:0").unwrap();
        let port = server.server_addr().to_ip().unwrap().port();

        let handle = std::thread::spawn(move || {
            let mut req = server.recv().unwrap();
            let mut body = String::new();
            req.as_reader().read_to_string(&mut body).unwrap();
            // Devolvemos el cuerpo recibido para comprobar el ida y vuelta.
            let _ = req.respond(Response::from_string(body));
        });

        let url = format!("http://127.0.0.1:{port}/");
        let payload = r#"{"kind":"exchange","n":42}"#.to_string();
        let out = lan_http_post(url, payload.clone()).unwrap();

        assert_eq!(out, payload);
        handle.join().unwrap();
    }

    /// Un puerto cerrado debe dar Err (no colgar): asi el frontend puede mostrar
    /// el mensaje "no se pudo conectar con el PC".
    #[test]
    fn puerto_cerrado_devuelve_error() {
        // Puerto 1 en 127.0.0.1: nadie escucha -> conexion rechazada.
        let res = lan_http_post("http://127.0.0.1:1/".to_string(), "{}".to_string());
        assert!(res.is_err());
    }

    #[test]
    fn split_url_separa_autoridad_y_path() {
        assert_eq!(
            split_url("http://192.168.0.48:8787/").unwrap(),
            ("192.168.0.48:8787".to_string(), "/".to_string())
        );
    }
}
