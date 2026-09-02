pub mod windows;
pub mod macos;
pub mod linux;

use tauri::{Runtime, WebviewWindow};

pub fn configure_window_stealth<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        windows::init_stealth_window(window)?;
    }

    #[cfg(target_os = "macos")]
    {
        macos::init_stealth_window(window)?;
    }

    #[cfg(target_os = "linux")]
    {
        linux::init_stealth_window(window)?;
    }

    Ok(())
}

pub fn set_clickthrough_mode<R: Runtime>(window: &WebviewWindow<R>, enable: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        windows::set_clickthrough(window, enable)
    }

    #[cfg(target_os = "macos")]
    {
        macos::set_clickthrough(window, enable)
    }

    #[cfg(target_os = "linux")]
    {
        linux::set_clickthrough(window, enable)
    }
}
