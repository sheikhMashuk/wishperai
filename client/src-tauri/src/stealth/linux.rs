use tauri::{Runtime, WebviewWindow};

pub fn init_stealth_window<R: Runtime>(_window: &WebviewWindow<R>) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        log::info!("Configuring Linux compositor hints...");
    }
    Ok(())
}

pub fn set_clickthrough<R: Runtime>(_window: &WebviewWindow<R>, _enable: bool) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        log::info!("Toggling Linux clickthrough shape...");
    }
    Ok(())
}
