use tracing_subscriber::EnvFilter;

pub fn init_logging() {
    let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| {
        EnvFilter::new("info,tauri=info,webkit2gtk=warn,javascriptcore=warn,notify=warn")
    });

    let _ = tracing_subscriber::fmt()
        .with_env_filter(env_filter)
        .with_target(true)
        .with_thread_names(true)
        .try_init();
}
