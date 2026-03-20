use std::io::{Read, Write};
use std::net::TcpListener;

use tauri::Emitter;

const OAUTH_SUCCESS_HTML: &str = r#"HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Connection: close

<!DOCTYPE html>
<html>
<head><title>KLIN - Sign in</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f0f0f;color:#e5e5e5">
<div style="text-align:center"><h2>Authentication successful!</h2><p>You can close this tab and return to KLIN.</p></div>
</body>
</html>"#;

const OAUTH_ERROR_HTML: &str = r#"HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Connection: close

<!DOCTYPE html>
<html>
<head><title>KLIN - Sign in</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f0f0f;color:#e5e5e5">
<div style="text-align:center"><h2>Authentication failed</h2><p>No authorization code received. Please try again.</p></div>
</body>
</html>"#;

#[tauri::command]
pub fn start_oauth_listener(app: tauri::AppHandle) -> Result<(), String> {
    if let Ok(mut old) = std::net::TcpStream::connect_timeout(
        &"127.0.0.1:17920".parse().unwrap(),
        std::time::Duration::from_millis(50),
    ) {
        let _ = std::io::Write::write_all(&mut old, b"GET /cancel HTTP/1.1\r\n\r\n");
        drop(old);
        std::thread::sleep(std::time::Duration::from_millis(200));
    }

    let listener = TcpListener::bind("127.0.0.1:17920").map_err(|e| {
        if e.kind() == std::io::ErrorKind::AddrInUse {
            "OAuth port 17920 is busy. Please wait a moment and try again.".to_string()
        } else {
            e.to_string()
        }
    })?;

    listener.set_nonblocking(false).map_err(|e| e.to_string())?;

    std::thread::spawn(move || {
        let _ = listener.set_nonblocking(false);
        let timeout = std::time::Duration::from_secs(120);
        let start = std::time::Instant::now();

        loop {
            if start.elapsed() > timeout {
                let _ = app.emit("oauth-callback-code", String::new());
                return;
            }

            let _ = listener.set_nonblocking(true);
            match listener.accept() {
                Ok((mut stream, _)) => {
                    let _ = stream.set_read_timeout(Some(std::time::Duration::from_secs(5)));
                    let mut buf = vec![0u8; 8192];
                    let n = stream.read(&mut buf).unwrap_or(0);
                    let request = String::from_utf8_lossy(&buf[..n]);

                    if let Some(first_line) = request.lines().next() {
                        let path = first_line
                            .strip_prefix("GET ")
                            .and_then(|rest| rest.split_whitespace().next())
                            .unwrap_or("");

                        let query_start = path.find('?');
                        if let Some(qi) = query_start {
                            let query = &path[qi + 1..];
                            let code = query
                                .split('&')
                                .filter_map(|pair| pair.split_once('='))
                                .find(|(k, _)| *k == "code")
                                .map(|(_, v)| v.to_string());

                            if let Some(auth_code) = code {
                                let _ = stream.write_all(OAUTH_SUCCESS_HTML.as_bytes());
                                let _ = stream.flush();
                                drop(stream);
                                let _ = app.emit("oauth-callback-code", auth_code);
                            } else {
                                let _ = stream.write_all(OAUTH_ERROR_HTML.as_bytes());
                                let _ = stream.flush();
                                drop(stream);
                                let _ = app.emit("oauth-callback-code", String::new());
                            }
                        } else {
                            let _ = stream.write_all(b"HTTP/1.1 204 No Content\r\n\r\n");
                            let _ = stream.flush();
                            drop(stream);
                            continue;
                        }
                    }
                    return;
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(std::time::Duration::from_millis(100));
                    continue;
                }
                Err(_) => {
                    let _ = app.emit("oauth-callback-code", String::new());
                    return;
                }
            }
        }
    });

    Ok(())
}
