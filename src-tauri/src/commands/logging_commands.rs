use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendLogPayload {
    pub level: String,
    pub message: String,
    pub context: Option<String>,
}

#[tauri::command]
pub fn log_frontend(payload: FrontendLogPayload) {
    let msg = payload.message.as_str();
    let ctx = payload.context.as_deref();
    match payload.level.as_str() {
        "debug" => match ctx {
            Some(c) => tracing::debug!(target: "frontend", "{} | {}", msg, c),
            None => tracing::debug!(target: "frontend", "{}", msg),
        },
        "warn" => match ctx {
            Some(c) => tracing::warn!(target: "frontend", "{} | {}", msg, c),
            None => tracing::warn!(target: "frontend", "{}", msg),
        },
        "error" => match ctx {
            Some(c) => tracing::error!(target: "frontend", "{} | {}", msg, c),
            None => tracing::error!(target: "frontend", "{}", msg),
        },
        _ => match ctx {
            Some(c) => tracing::info!(target: "frontend", "{} | {}", msg, c),
            None => tracing::info!(target: "frontend", "{}", msg),
        },
    }
}
