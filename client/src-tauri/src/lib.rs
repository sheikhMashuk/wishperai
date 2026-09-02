use std::sync::Arc;
use parking_lot::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

pub mod audio;
pub mod commands;
pub mod stealth;

pub use commands::AppState;

pub fn run() {
    let audio_service = Arc::new(Mutex::new(audio::AudioCaptureService::new()));
    let is_clickthrough = Arc::new(Mutex::new(false));

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(AppState {
            audio_service,
            is_clickthrough,
        })
        .setup(|app| {
            env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));

            if let Some(window) = app.get_webview_window("main") {
                // Apply stealth configuration immediately on the window
                if let Err(e) = stealth::configure_window_stealth(&window) {
                    log::error!("Failed to configure initial stealth window: {}", e);
                }
            }

            // Register global hotkeys:
            // Ctrl+Shift+H -> Emergency Hide/Show
            // Ctrl+Shift+T -> Toggle Click-Through
            // Ctrl+Shift+Q -> Emergency Close/Quit Application
            let app_handle = app.handle().clone();
            let hide_shortcut: Shortcut = "Ctrl+Shift+H".parse().expect("Valid shortcut");
            let clickthrough_shortcut: Shortcut = "Ctrl+Shift+T".parse().expect("Valid shortcut");
            let quit_shortcut: Shortcut = "Ctrl+Shift+Q".parse().expect("Valid shortcut");

            let _ = app.global_shortcut().on_shortcut(hide_shortcut, move |_app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let _ = commands::toggle_stealth_visibility(window.clone());
                        let _ = window.emit("stealth-visibility-toggled", ());
                    }
                }
            });

            let app_handle2 = app.handle().clone();
            let _ = app.global_shortcut().on_shortcut(clickthrough_shortcut, move |_app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    if let Some(window) = app_handle2.get_webview_window("main") {
                        let state = app_handle2.state::<AppState>();
                        let current = *state.is_clickthrough.lock();
                        let new_val = !current;
                        let _ = commands::set_stealth_clickthrough(window.clone(), state, new_val);
                    }
                }
            });

            let app_handle3 = app.handle().clone();
            let _ = app.global_shortcut().on_shortcut(quit_shortcut, move |_app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    app_handle3.exit(0);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::set_stealth_clickthrough,
            commands::toggle_stealth_visibility,
            commands::hide_stealth_window,
            commands::show_stealth_window,
            commands::close_stealth_app,
            commands::start_audio_capture,
            commands::stop_audio_capture,
            commands::get_audio_levels
        ])
        .run(tauri::generate_context!())
        .expect("error while running whisperai tauri application");
}
