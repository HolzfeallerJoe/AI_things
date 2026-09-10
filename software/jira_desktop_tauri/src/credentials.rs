//! The API token, kept in the operating system's own credential store: Windows
//! Credential Manager, macOS Keychain, or the Secret Service on Linux. It never touches
//! the config file, so nothing secret is sitting in plain text on disk.

const SERVICE: &str = "jira-native";

fn entry(account: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, account).map_err(|e| e.to_string())
}

/// `account` is the Atlassian e-mail, so several accounts can coexist.
pub fn load_token(account: &str) -> Option<String> {
    entry(account).ok()?.get_password().ok()
}

pub fn store_token(account: &str, token: &str) -> Result<(), String> {
    entry(account)?
        .set_password(token)
        .map_err(|e| e.to_string())
}

pub fn forget_token(account: &str) -> Result<(), String> {
    match entry(account)?.delete_credential() {
        Ok(()) => Ok(()),
        // Nothing stored is the desired end state, not a failure.
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
