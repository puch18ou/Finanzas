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
//
//  IMPORTANTE: el trabajo de red es BLOQUEANTE (TcpStream). El comando es
//  `async` y saca ese trabajo a un hilo del pool (spawn_blocking) para NO
//  congelar el hilo principal de la UI: la auto-sync corre al arrancar y cada
//  30s, y si el PC no responde el connect espera hasta el timeout. Sin esto, la
//  app se quedaba "lentisima" bloqueada durante ese tiempo.
// ============================================================================

use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

use tauri::async_runtime::spawn_blocking;

/// Timeout de conexion. En una LAN sana el connect es inmediato (<100ms); si el
/// PC no responde (firewall/apagado) queremos rendirnos PRONTO, no colgar la
/// sync ni castigar al arranque.
const CONNECT_TIMEOUT_SECS: u64 = 4;
/// Timeout de lectura/escritura una vez conectados (el snapshot puede ser
/// grande, pero tiny_http responde en cuanto el motor de sync termina).
const IO_TIMEOUT_SECS: u64 = 20;

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
///
/// `async` + spawn_blocking: el IO real corre en un hilo aparte para no bloquear
/// la UI (ver nota de cabecera).
#[tauri::command]
pub async fn lan_http_post(url: String, body: String) -> Result<String, String> {
    spawn_blocking(move || post_blocking(&url, &body))
        .await
        .map_err(|e| format!("Fallo el hilo de red: {e}"))?
}

/// La peticion HTTP en si, bloqueante. Aislada para poder testearla sin runtime
/// async y para envolverla en spawn_blocking desde el comando.
fn post_blocking(url: &str, body: &str) -> Result<String, String> {
    let (authority, path) = split_url(url)?;

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

    let (status, body) = parse_http_response(&raw)?;
    if (200..300).contains(&status) {
        Ok(body)
    } else {
        Err(format!("El PC respondio {status}"))
    }
}

/// Posicion de `needle` dentro de `hay` (busqueda de subcadena en bytes).
fn find_bytes(hay: &[u8], needle: &[u8]) -> Option<usize> {
    if needle.is_empty() || hay.len() < needle.len() {
        return None;
    }
    hay.windows(needle.len()).position(|w| w == needle)
}

/// Parsea una respuesta HTTP/1.1 cruda -> (status, cuerpo).
///
/// Maneja tanto Content-Length como **Transfer-Encoding: chunked**: tiny_http
/// trocea las respuestas grandes (la primera sync con un PC nuevo es COMPLETA y
/// grande). Sin decodificar el chunked, el cuerpo traeria los tamaños de chunk
/// en hexadecimal intercalados y el JSON.parse del cliente reventaba
/// ("Unexpected non-whitespace character after JSON").
fn parse_http_response(raw: &[u8]) -> Result<(u16, String), String> {
    let sep = find_bytes(raw, b"\r\n\r\n")
        .ok_or_else(|| "Respuesta HTTP mal formada (sin cabeceras)".to_string())?;
    let head = String::from_utf8_lossy(&raw[..sep]);
    let body_bytes = &raw[sep + 4..];

    // Status de la primera linea: "HTTP/1.1 200 OK".
    let status = head
        .lines()
        .next()
        .and_then(|l| l.split_whitespace().nth(1))
        .and_then(|s| s.parse::<u16>().ok())
        .unwrap_or(0);

    let chunked = head.lines().any(|l| {
        let l = l.to_ascii_lowercase();
        l.starts_with("transfer-encoding:") && l.contains("chunked")
    });

    let body = if chunked {
        decode_chunked(body_bytes)?
    } else {
        body_bytes.to_vec()
    };

    Ok((status, String::from_utf8_lossy(&body).into_owned()))
}

/// Decodifica un cuerpo con Transfer-Encoding: chunked (RFC 7230 §4.1):
/// secuencia de `<tamaño-hex>\r\n<datos>\r\n`, terminada por un chunk de 0.
fn decode_chunked(mut data: &[u8]) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    loop {
        let line_end = find_bytes(data, b"\r\n")
            .ok_or_else(|| "Cuerpo chunked mal formado".to_string())?;
        // El tamaño puede llevar extensiones tras ';'; nos quedamos con el hex.
        let size_line = String::from_utf8_lossy(&data[..line_end]);
        let size_hex = size_line.split(';').next().unwrap_or("").trim();
        let size = usize::from_str_radix(size_hex, 16)
            .map_err(|_| format!("Tamaño de chunk invalido: '{size_hex}'"))?;
        data = &data[line_end + 2..];
        if size == 0 {
            break; // ultimo chunk
        }
        if data.len() < size {
            return Err("Chunk incompleto en la respuesta".to_string());
        }
        out.extend_from_slice(&data[..size]);
        // Saltar los datos del chunk y su \r\n de cierre.
        data = &data[size..];
        if data.len() >= 2 {
            data = &data[2..];
        }
    }
    Ok(out)
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
        let payload = r#"{"kind":"exchange","n":42}"#;
        let out = post_blocking(&url, payload).unwrap();

        assert_eq!(out, payload);
        handle.join().unwrap();
    }

    /// Un puerto cerrado debe dar Err (no colgar): asi el frontend puede mostrar
    /// el mensaje "no se pudo conectar con el PC".
    #[test]
    fn puerto_cerrado_devuelve_error() {
        // Puerto 1 en 127.0.0.1: nadie escucha -> conexion rechazada.
        let res = post_blocking("http://127.0.0.1:1/", "{}");
        assert!(res.is_err());
    }

    #[test]
    fn split_url_separa_autoridad_y_path() {
        assert_eq!(
            split_url("http://192.168.0.48:8787/").unwrap(),
            ("192.168.0.48:8787".to_string(), "/".to_string())
        );
    }

    /// Cuerpo GRANDE: reproduce el caso de la primera sync con un PC nuevo (que
    /// es completa). Si tiny_http lo trocea (chunked), el parseo debe devolverlo
    /// integro igualmente. Antes rompia el JSON en el cliente.
    #[test]
    fn post_roundtrip_cuerpo_grande_intacto() {
        let server = Server::http("127.0.0.1:0").unwrap();
        let port = server.server_addr().to_ip().unwrap().port();
        let grande = format!("{{\"data\":\"{}\"}}", "x".repeat(200_000));
        let esperado = grande.clone();

        let handle = std::thread::spawn(move || {
            let mut req = server.recv().unwrap();
            let mut body = String::new();
            req.as_reader().read_to_string(&mut body).unwrap();
            let _ = req.respond(Response::from_string(grande));
        });

        let url = format!("http://127.0.0.1:{port}/");
        let out = post_blocking(&url, "{}").unwrap();
        assert_eq!(out.len(), esperado.len());
        assert_eq!(out, esperado);
        handle.join().unwrap();
    }

    /// DIAGNOSTICO: confirma que tiny_http (el servidor que usa la app) trocea
    /// (chunked) las respuestas grandes. Es la CAUSA del bug de sincronizar en
    /// otra red: la primera sync es completa (grande) -> chunked -> el cliente
    /// debia decodificarla. Si este test fallara, la causa seria otra.
    #[test]
    fn tiny_http_trocea_respuestas_grandes() {
        use std::net::TcpStream;
        let server = Server::http("127.0.0.1:0").unwrap();
        let port = server.server_addr().to_ip().unwrap().port();
        let handle = std::thread::spawn(move || {
            let req = server.recv().unwrap();
            let _ = req.respond(Response::from_string("y".repeat(200_000)));
        });

        let mut s = TcpStream::connect(("127.0.0.1", port)).unwrap();
        s.write_all(b"GET / HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n")
            .unwrap();
        let mut raw = Vec::new();
        s.read_to_end(&mut raw).unwrap();
        let sep = find_bytes(&raw, b"\r\n\r\n").unwrap();
        let head = String::from_utf8_lossy(&raw[..sep]).to_ascii_lowercase();
        assert!(
            head.contains("transfer-encoding: chunked"),
            "esperabamos chunked para respuesta grande; cabeceras:\n{head}"
        );
        handle.join().unwrap();
    }

    /// Decodifica una respuesta Transfer-Encoding: chunked servida por un socket
    /// crudo (JSON troceado en 2 chunks). Es el fix del bug de "Unexpected
    /// non-whitespace character after JSON" al sincronizar en otra red.
    #[test]
    fn parsea_respuesta_chunked() {
        use std::net::TcpListener;
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();

        let handle = std::thread::spawn(move || {
            let (mut sock, _) = listener.accept().unwrap();
            let mut buf = [0u8; 1024];
            let _ = sock.read(&mut buf); // descartamos la peticion
            // {"a": + 123}  -> {"a":123}  en dos chunks (5 y 4 bytes).
            let resp = "HTTP/1.1 200 OK\r\n\
                        Content-Type: application/json\r\n\
                        Transfer-Encoding: chunked\r\n\
                        \r\n\
                        5\r\n{\"a\":\r\n4\r\n123}\r\n0\r\n\r\n";
            let _ = sock.write_all(resp.as_bytes());
        });

        let url = format!("http://127.0.0.1:{port}/");
        let out = post_blocking(&url, "{}").unwrap();
        assert_eq!(out, "{\"a\":123}");
        handle.join().unwrap();
    }
}
