use tauri::{Runtime, WebviewWindow};
use log::{info, warn};

#[cfg(target_os = "windows")]
use windows::{
    Win32::Foundation::HWND,
    Win32::UI::WindowsAndMessaging::{
        SetWindowDisplayAffinity,
        WDA_EXCLUDEFROMCAPTURE,
    },
};

/// Applies pre-show stealth capture exclusion to the Win32 window at the DWM compositor layer
pub fn init_stealth_window<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let hwnd_raw = window.hwnd().map_err(|e| format!("Failed to obtain HWND: {}", e))?;
        let hwnd = HWND(hwnd_raw.0 as *mut core::ffi::c_void);

        unsafe {
            // Exclude the window from all capture pipelines at the DWM compositor layer (OBS, Discord, Zoom, etc.)
            if let Err(e) = SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE) {
                warn!("SetWindowDisplayAffinity returned warning or fallback needed: {:?}", e);
            } else {
                info!("Successfully applied WDA_EXCLUDEFROMCAPTURE to HWND {:?}", hwnd_raw);
            }
        }
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = window;
        Ok(())
    }
}

/// Dynamically enables or disables mouse click-through via Tauri's native ignore_cursor_events
pub fn set_clickthrough<R: Runtime>(window: &WebviewWindow<R>, enable: bool) -> Result<(), String> {
    window.set_ignore_cursor_events(enable).map_err(|e| e.to_string())
}

