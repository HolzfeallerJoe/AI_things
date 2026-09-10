//! Per-user settings. Nothing here is ever written into the repository, and the API
//! token is deliberately absent - that lives in the OS keychain, see `credentials`.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

pub const DEFAULT_JQL: &str =
    "assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC";

fn default_jql() -> String {
    DEFAULT_JQL.to_string()
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppConfig {
    /// Jira host, e.g. "example.atlassian.net".
    pub domain: Option<String>,
    /// Atlassian account e-mail, the user half of the API token credential.
    pub email: Option<String>,
    #[serde(default = "default_jql")]
    pub jql: String,
    /// Board ids pinned to the top of the picker. Jira's REST API does not expose
    /// starred boards, so this is kept here rather than fetched.
    #[serde(default)]
    pub favourite_boards: Vec<i64>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            domain: None,
            email: None,
            jql: default_jql(),
            favourite_boards: Vec::new(),
        }
    }
}

impl AppConfig {
    /// True once there is enough to attempt an API call.
    pub fn is_complete(&self) -> bool {
        self.domain.is_some() && self.email.is_some()
    }
}

fn config_path() -> Option<PathBuf> {
    directories::ProjectDirs::from("com", "HolzfeallerJoe", "jira-native")
        .map(|dirs| dirs.config_dir().join("config.json"))
}

pub fn load() -> AppConfig {
    config_path()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

pub fn save(config: &AppConfig) {
    let Some(path) = config_path() else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(text) = serde_json::to_string_pretty(config) {
        let _ = fs::write(path, text);
    }
}

/// Accepts what a person would actually paste - "https://example.atlassian.net/jira/software",
/// "example.atlassian.net", a self-hosted host with a port - and reduces it to a bare
/// hostname. Returns None when the input could not be a host at all.
pub fn normalize_domain(input: &str) -> Option<String> {
    let lowered = input.trim().to_lowercase();

    let without_scheme = match lowered.find("://") {
        Some(index) => &lowered[index + 3..],
        None => lowered.as_str(),
    };

    let host: String = without_scheme
        .split('/')
        .next()
        .unwrap_or("")
        .split(':')
        .next()
        .unwrap_or("")
        .to_string();

    if host.is_empty() || !host.contains('.') {
        return None;
    }

    let every_label_valid = host.split('.').all(|label| {
        !label.is_empty()
            && !label.starts_with('-')
            && !label.ends_with('-')
            && label.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
    });

    every_label_valid.then_some(host)
}

#[cfg(test)]
mod tests {
    use super::normalize_domain;

    #[test]
    fn accepts_what_people_actually_paste() {
        let expected = Some("acme.atlassian.net".to_string());
        assert_eq!(normalize_domain("acme.atlassian.net"), expected);
        assert_eq!(normalize_domain("https://acme.atlassian.net"), expected);
        assert_eq!(
            normalize_domain("https://acme.atlassian.net/jira/software/projects/AS/boards/3"),
            expected
        );
        assert_eq!(normalize_domain("  ACME.Atlassian.NET  "), expected);
    }

    #[test]
    fn handles_self_hosted_instances() {
        assert_eq!(
            normalize_domain("jira.internal.company.de:8443"),
            Some("jira.internal.company.de".to_string())
        );
        assert_eq!(
            normalize_domain("http://jira.company.local/secure/Dashboard.jspa"),
            Some("jira.company.local".to_string())
        );
    }

    #[test]
    fn rejects_what_is_not_a_host() {
        assert_eq!(normalize_domain(""), None);
        assert_eq!(normalize_domain("   "), None);
        assert_eq!(normalize_domain("not a domain"), None);
        assert_eq!(normalize_domain("localhost"), None);
        assert_eq!(normalize_domain("-bad.example.com"), None);
    }
}
