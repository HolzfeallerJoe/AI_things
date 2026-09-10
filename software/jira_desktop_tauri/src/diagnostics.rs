//! A small append-only log next to the config file.
//!
//! The app hides its console on Windows, so a panic would otherwise vanish without
//! trace. Recording start, clean exit and panic separately is what makes the three
//! cases distinguishable afterwards: a panic leaves a message, a crash or an external
//! kill leaves a start with no exit, and a normal run leaves both.

use std::fmt::Write as _;
use std::fs::OpenOptions;
use std::io::Write as _;
use std::path::PathBuf;

pub fn log_path() -> Option<PathBuf> {
    directories::ProjectDirs::from("com", "HolzfeallerJoe", "jira-native")
        .map(|dirs| dirs.config_dir().join("jira-native.log"))
}

pub fn record(line: &str) {
    let Some(path) = log_path() else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    // Keep the file from growing without bound across many sessions.
    if let Ok(meta) = std::fs::metadata(&path) {
        if meta.len() > 512 * 1024 {
            let _ = std::fs::remove_file(&path);
        }
    }

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&path) {
        let _ = writeln!(file, "{} {line}", now_utc());
    }
}

pub fn install_panic_logger() {
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let location = info
            .location()
            .map(|l| format!("{}:{}", l.file(), l.line()))
            .unwrap_or_else(|| "unknown location".to_string());

        let message = info
            .payload()
            .downcast_ref::<&str>()
            .map(|s| (*s).to_string())
            .or_else(|| info.payload().downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "no message".to_string());

        record(&format!("PANIC at {location}: {message}"));
        previous(info);
    }));
}

fn now_utc() -> String {
    let seconds = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    format_utc(seconds)
}

/// Epoch seconds as "YYYY-MM-DD HH:MM:SS", so the log can be read without tooling.
/// Uses the civil-from-days conversion rather than pulling in a date crate.
fn format_utc(epoch_seconds: i64) -> String {
    let days = epoch_seconds.div_euclid(86_400);
    let seconds_of_day = epoch_seconds.rem_euclid(86_400);

    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let day_of_era = z.rem_euclid(146_097);
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let shifted_month = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * shifted_month + 2) / 5 + 1;
    let month = if shifted_month < 10 {
        shifted_month + 3
    } else {
        shifted_month - 9
    };
    let year = if month <= 2 { year + 1 } else { year };

    let mut out = String::with_capacity(19);
    let _ = write!(
        out,
        "{year:04}-{month:02}-{day:02} {:02}:{:02}:{:02}",
        seconds_of_day / 3_600,
        (seconds_of_day % 3_600) / 60,
        seconds_of_day % 60
    );
    out
}

#[cfg(test)]
mod tests {
    use super::format_utc;

    #[test]
    fn formats_known_instants() {
        assert_eq!(format_utc(0), "1970-01-01 00:00:00");
        assert_eq!(format_utc(1_000_000_000), "2001-09-09 01:46:40");
        // A leap day, which is where naive date maths usually goes wrong.
        assert_eq!(format_utc(1_709_164_800), "2024-02-29 00:00:00");
    }
}
