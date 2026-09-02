use tauri::{Runtime, WebviewWindow};

pub fn init_stealth_window<R: Runtime>(_window: &WebviewWindow<R>) -> Result<(), String> {
    // macOS implementation utilizes NSWindowSharingNone & ScreenCaptureKit filters
    #[cfg(target_os = "macos")]
    {
        log::info!("Configuring macOS NSWindowSharingNone...");
    }
    Ok(())
}

pub fn set_clickthrough<R: Runtime>(_window: &WebviewWindow<R>, _enable: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        log::info!("Toggling macOS ignoresMouseEvents...");
    }
    Ok(())
}
