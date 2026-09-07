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
                if let Err(e) = window.show() {
                    log::error!("Failed to show main window: {}", e);
                }
                let _ = window.unminimize();
                let _ = window.set_focus();
                // Apply stealth configuration immediately on the window
                if let Err(e) = stealth::configure_window_stealth(&window) {
                    log::error!("Failed to configure initial stealth window: {}", e);
                }
            }

            // Register global hotkeys:
            // Ctrl+Shift+H / Alt+Shift+H -> Emergency Hide/Show
            // Ctrl+Shift+T -> Toggle Click-Through
            // Ctrl+Shift+Q -> Emergency Close/Quit Application
            let app_handle = app.handle().clone();
            let hide_shortcut: Shortcut = "Ctrl+Shift+H".parse().expect("Valid shortcut");
            let hide_fallback: Shortcut = "Alt+Shift+H".parse().expect("Valid shortcut");
            let clickthrough_shortcut: Shortcut = "Ctrl+Shift+T".parse().expect("Valid shortcut");
            let quit_shortcut: Shortcut = "Ctrl+Shift+Q".parse().expect("Valid shortcut");

            let trigger_toggle = {
                let handle = app_handle.clone();
                move |key_name: &str| {
                    log::info!("Global shortcut [{}] triggered!", key_name);
                    if let Some(window) = handle.get_webview_window("main") {
                        match commands::toggle_stealth_visibility(window.clone()) {
                            Ok(vis) => log::info!("Visibility toggled successfully to: {}", vis),
                            Err(e) => log::error!("Failed to toggle stealth visibility: {}", e),
                        }
                        let _ = window.emit("stealth-visibility-toggled", ());
                    } else {
                        log::warn!("Could not find main window on shortcut trigger");
                    }
                }
            };

            let trigger_toggle1 = trigger_toggle.clone();
            match app.global_shortcut().on_shortcut(hide_shortcut, move |_app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    trigger_toggle1("Ctrl+Shift+H");
                }
            }) {
                Ok(_) => log::info!("Successfully registered Ctrl+Shift+H"),
                Err(e) => log::error!("Failed to register Ctrl+Shift+H shortcut: {:?}", e),
            }

            let trigger_toggle2 = trigger_toggle.clone();
            match app.global_shortcut().on_shortcut(hide_fallback, move |_app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    trigger_toggle2("Alt+Shift+H");
                }
            }) {
                Ok(_) => log::info!("Successfully registered Alt+Shift+H fallback"),
                Err(e) => log::error!("Failed to register Alt+Shift+H shortcut: {:?}", e),
            }

            let app_handle2 = app.handle().clone();
            match app.global_shortcut().on_shortcut(clickthrough_shortcut, move |_app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    log::info!("Global shortcut [Ctrl+Shift+T] triggered!");
                    if let Some(window) = app_handle2.get_webview_window("main") {
                        let state = app_handle2.state::<AppState>();
                        let current = *state.is_clickthrough.lock();
                        let new_val = !current;
                        if let Err(e) = commands::set_stealth_clickthrough(window.clone(), state, new_val) {
                            log::error!("Failed to set clickthrough: {}", e);
                        }
                    }
                }
            }) {
                Ok(_) => log::info!("Successfully registered Ctrl+Shift+T"),
                Err(e) => log::error!("Failed to register Ctrl+Shift+T shortcut: {:?}", e),
            }

            let app_handle3 = app.handle().clone();
            match app.global_shortcut().on_shortcut(quit_shortcut, move |_app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    log::info!("Emergency quit shortcut [Ctrl+Shift+Q] pressed - exiting application.");
                    app_handle3.exit(0);
                }
            }) {
                Ok(_) => log::info!("Successfully registered Ctrl+Shift+Q"),
                Err(e) => log::error!("Failed to register Ctrl+Shift+Q shortcut: {:?}", e),
            }

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
            commands::get_audio_levels,
            commands::get_api_key,
            commands::set_api_key
        ])
        .run(tauri::generate_context!())
        .expect("error while running whisperai tauri application");
}
