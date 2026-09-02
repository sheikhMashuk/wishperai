use tauri::{Runtime, WebviewWindow};
use log::{info, warn};

#[cfg(target_os = "windows")]
use windows::{
    Win32::Foundation::HWND,
    Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowDisplayAffinity, SetWindowLongPtrW, SetWindowPos, ShowWindow,
        GWL_EXSTYLE, SWP_FRAMECHANGED, SWP_NOACTIVATE,
        SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, SW_SHOWNOACTIVATE,
        WDA_EXCLUDEFROMCAPTURE,
        WS_EX_APPWINDOW, WS_EX_LAYERED, WS_EX_TOOLWINDOW, WS_EX_TRANSPARENT,
    },
};

/// Applies pre-show stealth affinity and cloaking styles to the Win32 window
pub fn init_stealth_window<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let hwnd_raw = window.hwnd().map_err(|e| format!("Failed to obtain HWND: {}", e))?;
        let hwnd = HWND(hwnd_raw.0 as *mut core::ffi::c_void);

        unsafe {
            // 1. Exclude the window from all capture pipelines at the DWM compositor layer
            if let Err(e) = SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE) {
                warn!("SetWindowDisplayAffinity returned warning or fallback needed: {:?}", e);
            } else {
                info!("Successfully applied WDA_EXCLUDEFROMCAPTURE to HWND {:?}", hwnd_raw);
            }

            // 2. Adjust Extended Window Styles:
            // - Add WS_EX_LAYERED (alpha transparency support)
            // - Add WS_EX_TOOLWINDOW (prevent showing in taskbar and Alt-Tab switcher)
            // - Remove WS_EX_APPWINDOW (prevent force-app taskbar representation)
            let mut ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            ex_style |= WS_EX_LAYERED.0 as isize;
            ex_style |= WS_EX_TOOLWINDOW.0 as isize;
            ex_style &= !(WS_EX_APPWINDOW.0 as isize);

            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style);

            // 3. Notify the window manager of the frame change without activating or moving
            let _ = SetWindowPos(
                hwnd,
                None,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED | SWP_NOACTIVATE,
            );

            // 4. Reveal the window cleanly without stealing focus (SW_SHOWNOACTIVATE)
            let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
            info!("Stealth window revealed via SW_SHOWNOACTIVATE.");
        }
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = window;
        Ok(())
    }
}

/// Dynamically enables or disables mouse click-through via WS_EX_TRANSPARENT
pub fn set_clickthrough<R: Runtime>(window: &WebviewWindow<R>, enable: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let hwnd_raw = window.hwnd().map_err(|e| format!("Failed to obtain HWND: {}", e))?;
        let hwnd = HWND(hwnd_raw.0 as *mut core::ffi::c_void);

        unsafe {
            let mut ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            if enable {
                ex_style |= WS_EX_TRANSPARENT.0 as isize;
                info!("Enabled WS_EX_TRANSPARENT (Click-Through Mode active).");
            } else {
                ex_style &= !(WS_EX_TRANSPARENT.0 as isize);
                info!("Disabled WS_EX_TRANSPARENT (Interactive HUD Mode active).");
            }

            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style);

            let _ = SetWindowPos(
                hwnd,
                None,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED | SWP_NOACTIVATE,
            );
        }
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = window;
        let _ = enable;
        Ok(())
    }
}
