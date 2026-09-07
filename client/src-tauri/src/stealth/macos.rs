use tauri::{Runtime, WebviewWindow};

pub fn init_stealth_window<R: Runtime>(_window: &WebviewWindow<R>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        log::info!("Configuring macOS NSWindowSharingNone...");
        if let Ok(ns_window) = _window.ns_window() {
            unsafe {
                // NSWindowSharingNone = 0
                let _: () = objc2::msg_send![ns_window as *mut objc2::runtime::AnyObject, setSharingType: 0isize];
            }
        }
    }
    Ok(())
}

pub fn set_clickthrough<R: Runtime>(_window: &WebviewWindow<R>, _enable: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        log::info!("Toggling macOS ignoresMouseEvents to {}", _enable);
        if let Ok(ns_window) = _window.ns_window() {
            unsafe {
                let _: () = objc2::msg_send![ns_window as *mut objc2::runtime::AnyObject, setIgnoresMouseEvents: _enable];
            }
        }
    }
    Ok(())
}
