// Hide the console window on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod adf;
mod app;
mod config;
mod credentials;
mod diagnostics;
mod jira;
mod theme;
mod worker;

use app::JiraApp;

fn window_icon() -> Option<egui::IconData> {
    let decoded = image::load_from_memory(include_bytes!("../icons/icon.png")).ok()?;
    let image = decoded.to_rgba8();
    let (width, height) = image.dimensions();
    Some(egui::IconData {
        rgba: image.into_raw(),
        width,
        height,
    })
}

fn main() -> eframe::Result<()> {
    diagnostics::install_panic_logger();
    diagnostics::record(concat!("start jira-native ", env!("CARGO_PKG_VERSION")));

    let mut viewport = egui::ViewportBuilder::default()
        .with_title("Jira")
        .with_inner_size([1200.0, 800.0])
        .with_min_inner_size([820.0, 560.0]);

    if let Some(icon) = window_icon() {
        viewport = viewport.with_icon(icon);
    }

    let options = eframe::NativeOptions {
        viewport,
        ..Default::default()
    };

    let outcome = eframe::run_native(
        "Jira",
        options,
        Box::new(|cc| {
            theme::apply(&cc.egui_ctx);
            Ok(Box::new(JiraApp::new(cc)))
        }),
    );

    // A "start" line with no matching line here means the process died rather than
    // exited - which is exactly the case that was impossible to tell apart before.
    match &outcome {
        Ok(()) => diagnostics::record("clean exit"),
        Err(error) => diagnostics::record(&format!("exit with error: {error}")),
    }
    outcome
}
