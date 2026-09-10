//! One place for colour, spacing and the small repeated pieces of the interface.
//!
//! egui draws every pixel itself, which means nothing here comes from the operating
//! system - the palette below is the whole visual identity of the app.

use egui::{Color32, CornerRadius, FontFamily, FontId, Margin, RichText, Stroke, TextStyle};

pub const BG: Color32 = Color32::from_rgb(0x14, 0x16, 0x1a);
pub const PANEL: Color32 = Color32::from_rgb(0x1a, 0x1d, 0x23);
pub const SURFACE: Color32 = Color32::from_rgb(0x22, 0x26, 0x2e);
pub const SURFACE_HI: Color32 = Color32::from_rgb(0x2b, 0x30, 0x3a);
pub const BORDER: Color32 = Color32::from_rgb(0x31, 0x37, 0x42);
pub const TEXT: Color32 = Color32::from_rgb(0xe6, 0xe9, 0xed);
pub const MUTED: Color32 = Color32::from_rgb(0x8b, 0x93, 0xa1);

pub const ACCENT: Color32 = Color32::from_rgb(0x5c, 0x97, 0xff);
pub const GREEN: Color32 = Color32::from_rgb(0x46, 0xc0, 0x66);
pub const AMBER: Color32 = Color32::from_rgb(0xe0, 0xa2, 0x33);
pub const RED: Color32 = Color32::from_rgb(0xf2, 0x67, 0x5e);
pub const PURPLE: Color32 = Color32::from_rgb(0xa3, 0x82, 0xf7);
pub const TEAL: Color32 = Color32::from_rgb(0x3f, 0xb5, 0xb5);

/// A translucent version of a colour, for chip and selection backgrounds.
pub fn tint(color: Color32, alpha: u8) -> Color32 {
    Color32::from_rgba_unmultiplied(color.r(), color.g(), color.b(), alpha)
}

/// Applied to every theme egui knows about, so the app looks the same whatever the
/// system is set to - the palette here is the design, not a variation on a default.
pub fn apply(ctx: &egui::Context) {
    ctx.all_styles_mut(style_one);
}

fn style_one(style: &mut egui::Style) {
    let visuals = &mut style.visuals;

    *visuals = egui::Visuals::dark();
    visuals.panel_fill = PANEL;
    visuals.window_fill = SURFACE;
    visuals.faint_bg_color = SURFACE;
    visuals.extreme_bg_color = BG;
    visuals.override_text_color = Some(TEXT);
    visuals.window_corner_radius = CornerRadius::same(12);
    visuals.window_stroke = Stroke::new(1.0, BORDER);
    visuals.window_shadow = egui::epaint::Shadow {
        offset: [0, 8],
        blur: 24,
        spread: 0,
        color: Color32::from_black_alpha(120),
    };
    visuals.popup_shadow = visuals.window_shadow;
    visuals.selection.bg_fill = tint(ACCENT, 70);
    visuals.selection.stroke = Stroke::new(1.0, ACCENT);
    visuals.hyperlink_color = ACCENT;

    let widgets = &mut visuals.widgets;
    for widget in [
        &mut widgets.noninteractive,
        &mut widgets.inactive,
        &mut widgets.hovered,
        &mut widgets.active,
        &mut widgets.open,
    ] {
        widget.corner_radius = CornerRadius::same(7);
    }
    widgets.noninteractive.bg_fill = PANEL;
    widgets.noninteractive.bg_stroke = Stroke::new(1.0, BORDER);
    widgets.noninteractive.fg_stroke = Stroke::new(1.0, TEXT);

    widgets.inactive.bg_fill = SURFACE;
    widgets.inactive.weak_bg_fill = SURFACE;
    widgets.inactive.bg_stroke = Stroke::new(1.0, BORDER);
    widgets.inactive.fg_stroke = Stroke::new(1.0, TEXT);

    widgets.hovered.bg_fill = SURFACE_HI;
    widgets.hovered.weak_bg_fill = SURFACE_HI;
    widgets.hovered.bg_stroke = Stroke::new(1.0, tint(ACCENT, 130));
    widgets.hovered.fg_stroke = Stroke::new(1.0, TEXT);

    widgets.active.bg_fill = tint(ACCENT, 60);
    widgets.active.weak_bg_fill = tint(ACCENT, 60);
    widgets.active.bg_stroke = Stroke::new(1.0, ACCENT);
    widgets.active.fg_stroke = Stroke::new(1.0, TEXT);

    style.spacing.item_spacing = egui::vec2(8.0, 6.0);
    style.spacing.button_padding = egui::vec2(10.0, 5.0);
    style.spacing.window_margin = Margin::same(16);
    style.spacing.menu_margin = Margin::same(8);
    style.spacing.scroll.bar_width = 9.0;

    style.text_styles = [
        (TextStyle::Heading, FontId::new(19.0, FontFamily::Proportional)),
        (TextStyle::Body, FontId::new(13.5, FontFamily::Proportional)),
        (TextStyle::Button, FontId::new(13.0, FontFamily::Proportional)),
        (TextStyle::Small, FontId::new(11.5, FontFamily::Proportional)),
        (TextStyle::Monospace, FontId::new(12.5, FontFamily::Monospace)),
    ]
    .into();
}

pub fn status_color(category: &str) -> Color32 {
    match category {
        "done" => GREEN,
        "indeterminate" => ACCENT,
        _ => MUTED,
    }
}

pub fn priority_color(name: &str) -> Color32 {
    match name.to_lowercase().as_str() {
        "highest" | "blocker" | "critical" => RED,
        "high" | "major" => AMBER,
        "low" | "minor" | "lowest" | "trivial" => TEAL,
        _ => MUTED,
    }
}

pub fn type_color(name: &str) -> Color32 {
    match name.to_lowercase().as_str() {
        "bug" | "fehler" => RED,
        "story" | "geschichte" => GREEN,
        "epic" => PURPLE,
        "task" | "aufgabe" => ACCENT,
        "sub-task" | "subtask" | "unteraufgabe" => TEAL,
        _ => MUTED,
    }
}

/// A small rounded label: status, issue type, priority.
pub fn chip(ui: &mut egui::Ui, text: &str, color: Color32) {
    egui::Frame::default()
        .fill(tint(color, 38))
        .corner_radius(CornerRadius::same(6))
        .inner_margin(Margin::symmetric(7, 2))
        .show(ui, |ui| {
            ui.label(RichText::new(text).size(11.0).color(color).strong());
        });
}

/// Deterministic colour per person, so the same face keeps the same colour.
fn person_color(name: &str) -> Color32 {
    const PALETTE: [Color32; 6] = [ACCENT, GREEN, AMBER, PURPLE, TEAL, RED];
    let sum: u32 = name.bytes().map(u32::from).sum();
    PALETTE[(sum as usize) % PALETTE.len()]
}

fn initials(name: &str) -> String {
    let letters: Vec<char> = name
        .split_whitespace()
        .filter_map(|word| word.chars().next())
        .take(2)
        .collect();
    if letters.is_empty() {
        "?".to_string()
    } else {
        letters.iter().collect::<String>().to_uppercase()
    }
}

/// A circular initials badge. `None` renders a muted placeholder for unassigned.
pub fn avatar(ui: &mut egui::Ui, name: Option<&str>, diameter: f32) {
    let (rect, _) = ui.allocate_exact_size(egui::vec2(diameter, diameter), egui::Sense::hover());
    let painter = ui.painter();

    match name {
        Some(name) => {
            painter.circle_filled(rect.center(), diameter / 2.0, person_color(name));
            painter.text(
                rect.center(),
                egui::Align2::CENTER_CENTER,
                initials(name),
                FontId::new(diameter * 0.42, FontFamily::Proportional),
                Color32::from_rgb(0x12, 0x14, 0x18),
            );
        }
        None => {
            painter.circle_stroke(
                rect.center(),
                diameter / 2.0 - 0.5,
                Stroke::new(1.0, BORDER),
            );
            painter.text(
                rect.center(),
                egui::Align2::CENTER_CENTER,
                "?",
                FontId::new(diameter * 0.42, FontFamily::Proportional),
                MUTED,
            );
        }
    }
}

/// A quiet uppercase section heading.
pub fn section(ui: &mut egui::Ui, text: &str) {
    ui.label(
        RichText::new(text.to_uppercase())
            .size(10.5)
            .color(MUTED)
            .strong(),
    );
    ui.add_space(3.0);
}

/// A close button with a real hover state.
///
/// egui's own window close button paints two bare strokes with `fg_stroke`, so it can
/// only react to hover by changing that colour - and changing it globally would repaint
/// the text of every other button too. Drawing it here keeps the effect local.
pub fn close_button(ui: &mut egui::Ui) -> egui::Response {
    let (rect, response) = ui.allocate_exact_size(egui::vec2(24.0, 24.0), egui::Sense::click());
    let hovered = response.hovered();

    if hovered {
        ui.painter()
            .rect_filled(rect, CornerRadius::same(6), tint(RED, 60));
    }

    let stroke = Stroke::new(if hovered { 1.8 } else { 1.4 }, if hovered { RED } else { MUTED });
    let cross = rect.shrink(7.5);
    ui.painter()
        .line_segment([cross.left_top(), cross.right_bottom()], stroke);
    ui.painter()
        .line_segment([cross.right_top(), cross.left_bottom()], stroke);

    response.on_hover_text("Close")
}

/// A dialog header: title on the left, close button on the right.
/// Returns true when the close button was clicked.
pub fn dialog_header(ui: &mut egui::Ui, title: &str) -> bool {
    let mut closed = false;
    ui.horizontal(|ui| {
        ui.label(RichText::new(title).size(15.0).strong());
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            closed = close_button(ui).clicked();
        });
    });
    ui.add_space(2.0);
    ui.separator();
    ui.add_space(6.0);
    closed
}

/// A card surface: the repeated container for issues and board tiles.
pub fn card_frame(selected: bool) -> egui::Frame {
    egui::Frame::default()
        .fill(if selected { tint(ACCENT, 30) } else { SURFACE })
        .stroke(Stroke::new(1.0, if selected { ACCENT } else { BORDER }))
        .corner_radius(CornerRadius::same(8))
        .inner_margin(Margin::symmetric(10, 8))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initials_come_from_the_first_two_words() {
        assert_eq!(initials("Dominik Mustermann"), "DM");
        assert_eq!(initials("Dominik"), "D");
        assert_eq!(initials("anna lena schmidt"), "AL");
        assert_eq!(initials(""), "?");
    }

    #[test]
    fn a_person_always_gets_the_same_colour() {
        assert_eq!(person_color("Dominik"), person_color("Dominik"));
    }
}
