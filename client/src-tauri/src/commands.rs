use std::sync::Arc;
use parking_lot::Mutex;
use tauri::ipc::Response;
use tauri::{Emitter, State, WebviewWindow};
use crate::audio::AudioCaptureService;
use crate::stealth;

pub struct AppState {
    pub audio_service: Arc<Mutex<AudioCaptureService>>,
    pub is_clickthrough: Arc<Mutex<bool>>,
}

#[tauri::command]
pub fn set_stealth_clickthrough(
    window: WebviewWindow,
    state: State<AppState>,
    enable: bool,
) -> Result<(), String> {
    stealth::set_clickthrough_mode(&window, enable)?;
    *state.is_clickthrough.lock() = enable;
    let _ = window.emit("clickthrough-changed", enable);
    Ok(())
}

#[tauri::command]
pub fn toggle_stealth_visibility(window: WebviewWindow) -> Result<bool, String> {
    let is_visible = window.is_visible().map_err(|e| e.to_string())?;
    if is_visible {
        window.hide().map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        window.show().map_err(|e| e.to_string())?;
        let _ = window.unminimize();
        let _ = window.set_focus();
        stealth::configure_window_stealth(&window)?;
        Ok(true)
    }
}

#[tauri::command]
pub fn hide_stealth_window(window: WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn show_stealth_window(window: WebviewWindow) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())?;
    let _ = window.unminimize();
    let _ = window.set_focus();
    stealth::configure_window_stealth(&window)?;
    Ok(())
}

#[tauri::command]
pub fn close_stealth_app(window: WebviewWindow) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn start_audio_capture(state: State<AppState>) -> Result<(), String> {
    state.audio_service.lock().start_capture()
}

#[tauri::command]
pub fn stop_audio_capture(state: State<AppState>) -> Result<(), String> {
    state.audio_service.lock().stop_capture();
    Ok(())
}

#[tauri::command]
pub fn get_audio_levels(state: State<AppState>) -> (f32, f32) {
    state.audio_service.lock().get_audio_levels()
}

/// Drain the buffered call audio as a WAV. Empty response = nothing new / silence.
#[tauri::command]
pub fn take_meeting_audio(state: State<AppState>) -> Response {
    let wav = state.audio_service.lock().take_wav().unwrap_or_default();
    Response::new(wav)
}

use keyring::Entry;

#[tauri::command]
pub fn get_api_key() -> Result<String, String> {
    let entry = Entry::new("whisperai", "api_key").map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(pw) => Ok(pw),
        Err(keyring::Error::NoEntry) => Ok(String::new()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn set_api_key(key: String) -> Result<(), String> {
    let entry = Entry::new("whisperai", "api_key").map_err(|e| e.to_string())?;
    if key.is_empty() {
        let _ = entry.delete_credential();
    } else {
        entry.set_password(&key).map_err(|e| e.to_string())?;
    }
    Ok(())
}
