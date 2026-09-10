//! A small blocking Jira Cloud REST client - only the calls this app actually makes.
//!
//! Endpoint notes:
//! - Search is POST /rest/api/3/search/jql. The older /search was retired and answers 410.
//! - Boards, backlog and sprints live on the separate Agile API, /rest/agile/1.0.

use base64::Engine;
use serde::Deserialize;
use serde_json::Value;
use std::time::Duration;

use crate::adf;

pub type Result<T> = std::result::Result<T, String>;

const FIELDS: &[&str] = &[
    "summary",
    "status",
    "assignee",
    "priority",
    "issuetype",
    "updated",
    "description",
];

#[derive(Clone, Debug)]
pub struct Credentials {
    pub domain: String,
    pub email: String,
    pub token: String,
}

pub struct JiraClient {
    credentials: Credentials,
    http: reqwest::blocking::Client,
}

#[derive(Clone, Debug, Default)]
pub struct Issue {
    pub key: String,
    pub summary: String,
    pub status: String,
    pub status_id: String,
    pub status_category: String,
    pub assignee: Option<String>,
    pub assignee_id: Option<String>,
    pub priority: Option<String>,
    pub issue_type: String,
    pub updated: String,
    pub description: Option<Value>,
    /// Lowercased summary plus description text, built once so filtering costs nothing per frame.
    pub search_text: String,
}

#[derive(Clone, Debug)]
pub struct Transition {
    pub id: String,
    pub name: String,
    pub to_status: String,
}

#[derive(Clone, Debug)]
pub struct Comment {
    pub author: String,
    pub created: String,
    pub body: Value,
}

#[derive(Clone, Debug, Deserialize)]
pub struct CurrentUser {
    #[serde(rename = "displayName")]
    pub display_name: String,
}

/// The complete field set for one issue, kept raw so nothing is silently dropped.
#[derive(Clone, Debug)]
pub struct IssueDetail {
    pub fields: Value,
    /// field id -> human readable name, from Jira's own `names` expansion.
    pub names: std::collections::BTreeMap<String, String>,
}

impl IssueDetail {
    /// Field ids already shown at the top of the detail pane, or handled elsewhere.
    const SHOWN_ELSEWHERE: &'static [&'static str] = &[
        "summary",
        "description",
        "status",
        "assignee",
        "priority",
        "issuetype",
        "updated",
        "comment",
        "worklog",
        "attachment",
        "subtasks",
        "issuelinks",
    ];

    /// Field ids worth showing first, in this order. Everything else follows
    /// alphabetically by display name.
    const PREFERRED: &'static [&'static str] = &[
        "project",
        "reporter",
        "creator",
        "created",
        "duedate",
        "resolution",
        "resolutiondate",
        "labels",
        "components",
        "fixVersions",
        "versions",
        "environment",
        "parent",
        "timetracking",
        "votes",
        "watches",
    ];

    pub fn label_for(&self, id: &str) -> String {
        self.names.get(id).cloned().unwrap_or_else(|| id.to_string())
    }

    /// Field ids to render generically, ordered for reading.
    pub fn extra_field_ids(&self) -> Vec<String> {
        let Some(map) = self.fields.as_object() else {
            return Vec::new();
        };

        let mut preferred = Vec::new();
        let mut rest = Vec::new();

        for id in map.keys() {
            if Self::SHOWN_ELSEWHERE.contains(&id.as_str()) {
                continue;
            }
            if map.get(id).map(is_blank).unwrap_or(true) {
                continue;
            }
            if Self::PREFERRED.contains(&id.as_str()) {
                preferred.push(id.clone());
            } else {
                rest.push(id.clone());
            }
        }

        preferred.sort_by_key(|id| {
            Self::PREFERRED
                .iter()
                .position(|p| p == id)
                .unwrap_or(usize::MAX)
        });
        rest.sort_by_key(|id| self.label_for(id).to_lowercase());

        preferred.extend(rest);
        preferred
    }

    pub fn field(&self, id: &str) -> Option<&Value> {
        self.fields.get(id).filter(|v| !is_blank(v))
    }
}

/// Null, empty string, empty list or empty object - nothing worth a row.
pub fn is_blank(value: &Value) -> bool {
    match value {
        Value::Null => true,
        Value::String(s) => s.trim().is_empty(),
        Value::Array(items) => items.is_empty(),
        Value::Object(map) => map.is_empty(),
        _ => false,
    }
}

/// Renders a Jira field value as a single line, where that is possible at all.
/// Returns None for values that carry no readable text (an ADF document, say, which
/// the caller draws properly instead).
pub fn format_field(value: &Value) -> Option<String> {
    match value {
        Value::Null => None,
        Value::Bool(b) => Some(if *b { "yes".into() } else { "no".into() }),
        Value::Number(n) => Some(n.to_string()),
        Value::String(s) => {
            let trimmed = s.trim();
            if trimmed.is_empty() {
                None
            } else if looks_like_timestamp(trimmed) {
                Some(short_date(trimmed))
            } else {
                Some(trimmed.to_string())
            }
        }
        Value::Array(items) => {
            let parts: Vec<String> = items.iter().filter_map(format_field).collect();
            (!parts.is_empty()).then(|| parts.join(", "))
        }
        Value::Object(map) => {
            // ADF documents are drawn as rich text, not squeezed onto one line.
            if map.get("type").and_then(Value::as_str) == Some("doc") {
                return None;
            }
            for key in ["displayName", "name", "value", "key"] {
                if let Some(text) = map.get(key).and_then(Value::as_str) {
                    if !text.trim().is_empty() {
                        return Some(text.to_string());
                    }
                }
            }
            // Objects like timetracking or votes: show their meaningful numbers.
            let parts: Vec<String> = map
                .iter()
                .filter(|(k, v)| {
                    !is_blank(v)
                        && !matches!(
                            k.as_str(),
                            "self" | "id" | "iconUrl" | "avatarUrls" | "accountId" | "active"
                        )
                })
                .filter_map(|(k, v)| format_field(v).map(|text| format!("{k}: {text}")))
                .collect();
            (!parts.is_empty()).then(|| parts.join(", "))
        }
    }
}

fn looks_like_timestamp(text: &str) -> bool {
    text.len() >= 19
        && text.as_bytes()[4] == b'-'
        && text.as_bytes()[7] == b'-'
        && text.as_bytes()[10] == b'T'
}

#[derive(Clone, Debug)]
pub struct Board {
    pub id: i64,
    pub name: String,
    /// Display name of the project the board belongs to.
    pub project: Option<String>,
    /// Project key, which is what boards are grouped by. A board built from a filter
    /// across several projects has none.
    pub project_key: Option<String>,
}

/// A board column and the statuses Jira maps onto it.
#[derive(Clone, Debug)]
pub struct BoardColumn {
    pub name: String,
    pub status_ids: Vec<String>,
}

#[derive(Clone, Debug)]
pub struct Project {
    pub key: String,
    pub name: String,
}

#[derive(Clone, Debug)]
pub struct IssueType {
    pub id: String,
    pub name: String,
}

#[derive(Clone, Debug)]
pub struct Priority {
    pub id: String,
    pub name: String,
}

#[derive(Clone, Debug, PartialEq)]
pub struct User {
    pub account_id: String,
    pub display_name: String,
}

/// Everything needed to create an issue, gathered from the dialog.
#[derive(Clone, Debug, Default)]
pub struct NewIssue {
    pub project_key: String,
    pub issue_type_id: String,
    pub summary: String,
    pub description: String,
    pub assignee_id: Option<String>,
    pub priority_id: Option<String>,
}

impl JiraClient {
    pub fn new(credentials: Credentials) -> Result<Self> {
        let http = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent(concat!("jira-native/", env!("CARGO_PKG_VERSION")))
            .build()
            .map_err(|e| e.to_string())?;
        Ok(Self { credentials, http })
    }

    fn url(&self, path: &str) -> String {
        format!("https://{}{}", self.credentials.domain, path)
    }

    fn auth(&self) -> String {
        let raw = format!("{}:{}", self.credentials.email, self.credentials.token);
        format!(
            "Basic {}",
            base64::engine::general_purpose::STANDARD.encode(raw)
        )
    }

    fn send(&self, request: reqwest::blocking::RequestBuilder) -> Result<Option<Value>> {
        let response = request
            .header(reqwest::header::AUTHORIZATION, self.auth())
            .header(reqwest::header::ACCEPT, "application/json")
            .send()
            .map_err(|e| friendly_transport_error(&e))?;

        let status = response.status();
        let body = response.text().unwrap_or_default();

        if !status.is_success() {
            return Err(friendly_api_error(status, &body));
        }
        if body.trim().is_empty() {
            return Ok(None);
        }
        serde_json::from_str(&body)
            .map(Some)
            .map_err(|e| format!("Jira sent something unreadable: {e}"))
    }

    fn get(&self, path: &str) -> Result<Value> {
        self.send(self.http.get(self.url(path)))?
            .ok_or_else(|| "Jira returned an empty response".to_string())
    }

    // ---------- identity ----------

    pub fn current_user(&self) -> Result<CurrentUser> {
        serde_json::from_value(self.get("/rest/api/3/myself")?).map_err(|e| e.to_string())
    }

    // ---------- issues ----------

    pub fn search(&self, jql: &str, max_results: u32) -> Result<Vec<Issue>> {
        let payload = serde_json::json!({
            "jql": jql,
            "maxResults": max_results,
            "fields": FIELDS,
        });

        let value = self
            .send(
                self.http
                    .post(self.url("/rest/api/3/search/jql"))
                    .json(&payload),
            )?
            .ok_or_else(|| "Jira returned an empty response".to_string())?;

        Ok(issues_from(&value))
    }

    pub fn transitions(&self, key: &str) -> Result<Vec<Transition>> {
        let value = self.get(&format!("/rest/api/3/issue/{key}/transitions"))?;
        Ok(value
            .get("transitions")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .map(|t| Transition {
                        id: string_at(t, "id"),
                        name: string_at(t, "name"),
                        to_status: t
                            .get("to")
                            .map(|to| string_at(to, "name"))
                            .unwrap_or_default(),
                    })
                    .collect()
            })
            .unwrap_or_default())
    }

    pub fn transition(&self, key: &str, transition_id: &str) -> Result<()> {
        let payload = serde_json::json!({ "transition": { "id": transition_id } });
        self.send(
            self.http
                .post(self.url(&format!("/rest/api/3/issue/{key}/transitions")))
                .json(&payload),
        )?;
        Ok(())
    }

    /// Finds the transition that lands on one of `status_ids`, then takes it. Boards drag
    /// issues between columns, but Jira only moves an issue along its workflow.
    pub fn transition_to_status(&self, key: &str, status_ids: &[String]) -> Result<()> {
        let value = self.get(&format!(
            "/rest/api/3/issue/{key}/transitions?expand=transitions.fields"
        ))?;
        let empty = Vec::new();
        let transitions = value
            .get("transitions")
            .and_then(Value::as_array)
            .unwrap_or(&empty);

        let target = transitions.iter().find(|t| {
            t.get("to")
                .map(|to| status_ids.contains(&string_at(to, "id")))
                .unwrap_or(false)
        });

        match target {
            Some(t) => self.transition(key, &string_at(t, "id")),
            None => Err("Jira's workflow has no move from here to that column.".to_string()),
        }
    }

    pub fn update_issue(&self, key: &str, summary: &str, description: Option<Value>) -> Result<()> {
        let mut fields = serde_json::Map::new();
        fields.insert("summary".to_string(), Value::String(summary.to_string()));
        if let Some(doc) = description {
            fields.insert("description".to_string(), doc);
        }
        let payload = serde_json::json!({ "fields": fields });
        self.send(
            self.http
                .put(self.url(&format!("/rest/api/3/issue/{key}")))
                .json(&payload),
        )?;
        Ok(())
    }

    pub fn assign(&self, key: &str, account_id: Option<&str>) -> Result<()> {
        let payload = serde_json::json!({ "accountId": account_id });
        self.send(
            self.http
                .put(self.url(&format!("/rest/api/3/issue/{key}/assignee")))
                .json(&payload),
        )?;
        Ok(())
    }

    pub fn create_issue(&self, new_issue: &NewIssue) -> Result<String> {
        let mut fields = serde_json::Map::new();
        fields.insert(
            "project".to_string(),
            serde_json::json!({ "key": new_issue.project_key }),
        );
        fields.insert(
            "issuetype".to_string(),
            serde_json::json!({ "id": new_issue.issue_type_id }),
        );
        fields.insert(
            "summary".to_string(),
            Value::String(new_issue.summary.clone()),
        );
        if !new_issue.description.trim().is_empty() {
            fields.insert(
                "description".to_string(),
                adf::from_plain_text(&new_issue.description),
            );
        }
        if let Some(account_id) = &new_issue.assignee_id {
            fields.insert(
                "assignee".to_string(),
                serde_json::json!({ "accountId": account_id }),
            );
        }
        if let Some(priority_id) = &new_issue.priority_id {
            fields.insert(
                "priority".to_string(),
                serde_json::json!({ "id": priority_id }),
            );
        }

        let payload = serde_json::json!({ "fields": fields });
        let value = self
            .send(self.http.post(self.url("/rest/api/3/issue")).json(&payload))?
            .ok_or_else(|| "Jira created the issue but said nothing".to_string())?;
        Ok(string_at(&value, "key"))
    }

    /// Every field Jira holds for one issue, with `names` mapping the raw field ids
    /// (customfield_10014 and friends) to what a person actually calls them.
    pub fn issue_detail(&self, key: &str) -> Result<IssueDetail> {
        let value = self.get(&format!("/rest/api/3/issue/{key}?fields=*all&expand=names"))?;

        let names = value
            .get("names")
            .and_then(Value::as_object)
            .map(|map| {
                map.iter()
                    .filter_map(|(id, label)| {
                        label.as_str().map(|l| (id.clone(), l.to_string()))
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(IssueDetail {
            fields: value.get("fields").cloned().unwrap_or(Value::Null),
            names,
        })
    }

    // ---------- comments ----------

    pub fn comments(&self, key: &str) -> Result<Vec<Comment>> {
        let value = self.get(&format!(
            "/rest/api/3/issue/{key}/comment?orderBy=created&maxResults=50"
        ))?;
        Ok(value
            .get("comments")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .map(|c| Comment {
                        author: c
                            .get("author")
                            .map(|a| string_at(a, "displayName"))
                            .unwrap_or_else(|| "Unknown".to_string()),
                        created: short_date(&string_at(c, "created")),
                        body: c.get("body").cloned().unwrap_or(Value::Null),
                    })
                    .collect()
            })
            .unwrap_or_default())
    }

    pub fn add_comment(&self, key: &str, text: &str) -> Result<()> {
        let payload = serde_json::json!({ "body": adf::from_plain_text(text) });
        self.send(
            self.http
                .post(self.url(&format!("/rest/api/3/issue/{key}/comment")))
                .json(&payload),
        )?;
        Ok(())
    }

    // ---------- boards ----------

    pub fn boards(&self) -> Result<Vec<Board>> {
        let value = self.get("/rest/agile/1.0/board?maxResults=100")?;
        Ok(value
            .get("values")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .map(|b| Board {
                        id: b.get("id").and_then(Value::as_i64).unwrap_or_default(),
                        name: string_at(b, "name"),
                        project: b
                            .get("location")
                            .map(|l| string_at(l, "projectName"))
                            .filter(|p| !p.is_empty()),
                        project_key: b
                            .get("location")
                            .map(|l| string_at(l, "projectKey"))
                            .filter(|p| !p.is_empty()),
                    })
                    .collect()
            })
            .unwrap_or_default())
    }

    pub fn board_columns(&self, board_id: i64) -> Result<Vec<BoardColumn>> {
        let value = self.get(&format!("/rest/agile/1.0/board/{board_id}/configuration"))?;
        Ok(value
            .get("columnConfig")
            .and_then(|c| c.get("columns"))
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .map(|c| BoardColumn {
                        name: string_at(c, "name"),
                        status_ids: c
                            .get("statuses")
                            .and_then(Value::as_array)
                            .map(|s| s.iter().map(|st| string_at(st, "id")).collect())
                            .unwrap_or_default(),
                    })
                    .collect()
            })
            .unwrap_or_default())
    }

    pub fn board_issues(&self, board_id: i64) -> Result<Vec<Issue>> {
        let fields = FIELDS.join(",");
        let value = self.get(&format!(
            "/rest/agile/1.0/board/{board_id}/issue?maxResults=200&fields={fields}"
        ))?;
        Ok(issues_from(&value))
    }

    pub fn board_backlog(&self, board_id: i64) -> Result<Vec<Issue>> {
        let fields = FIELDS.join(",");
        let value = self.get(&format!(
            "/rest/agile/1.0/board/{board_id}/backlog?maxResults=200&fields={fields}"
        ))?;
        Ok(issues_from(&value))
    }

    // ---------- metadata for the create dialog ----------

    pub fn projects(&self) -> Result<Vec<Project>> {
        let value = self.get("/rest/api/3/project/search?maxResults=100&orderBy=name")?;
        Ok(value
            .get("values")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .map(|p| Project {
                        key: string_at(p, "key"),
                        name: string_at(p, "name"),
                    })
                    .collect()
            })
            .unwrap_or_default())
    }

    pub fn issue_types(&self, project_key: &str) -> Result<Vec<IssueType>> {
        let value = self.get(&format!(
            "/rest/api/3/issue/createmeta/{project_key}/issuetypes?maxResults=100"
        ))?;
        Ok(value
            .get("values")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    // Sub-tasks need a parent, which this dialog does not ask for.
                    .filter(|t| !t.get("subtask").and_then(Value::as_bool).unwrap_or(false))
                    .map(|t| IssueType {
                        id: string_at(t, "id"),
                        name: string_at(t, "name"),
                    })
                    .collect()
            })
            .unwrap_or_default())
    }

    pub fn priorities(&self) -> Result<Vec<Priority>> {
        let value = self.get("/rest/api/3/priority")?;
        Ok(value
            .as_array()
            .map(|items| {
                items
                    .iter()
                    .map(|p| Priority {
                        id: string_at(p, "id"),
                        name: string_at(p, "name"),
                    })
                    .collect()
            })
            .unwrap_or_default())
    }

    /// Who may be assigned. Scoped to an issue when there is one, else to a project.
    pub fn assignable_users(&self, scope: &UserScope, query: &str) -> Result<Vec<User>> {
        let encoded = encode_query(query);
        let path = match scope {
            UserScope::Issue(key) => format!(
                "/rest/api/3/user/assignable/search?issueKey={key}&query={encoded}&maxResults=50"
            ),
            UserScope::Project(key) => format!(
                "/rest/api/3/user/assignable/search?project={key}&query={encoded}&maxResults=50"
            ),
        };
        let value = self.get(&path)?;
        Ok(value
            .as_array()
            .map(|items| {
                items
                    .iter()
                    .map(|u| User {
                        account_id: string_at(u, "accountId"),
                        display_name: string_at(u, "displayName"),
                    })
                    .collect()
            })
            .unwrap_or_default())
    }

    pub fn browse_url(&self, key: &str) -> String {
        self.url(&format!("/browse/{key}"))
    }
}

#[derive(Clone, Debug)]
pub enum UserScope {
    Issue(String),
    Project(String),
}

/// Percent-encodes the handful of characters a name or e-mail can realistically contain.
fn encode_query(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    for byte in raw.as_bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(*byte as char)
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

fn issues_from(value: &Value) -> Vec<Issue> {
    value
        .get("issues")
        .and_then(Value::as_array)
        .map(|items| items.iter().map(parse_issue).collect())
        .unwrap_or_default()
}

fn string_at(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string()
}

/// "2026-09-10T14:22:31.000+0200" reads better as "2026-09-10 14:22".
fn short_date(raw: &str) -> String {
    if raw.len() >= 16 {
        format!("{} {}", &raw[0..10], &raw[11..16])
    } else {
        raw.to_string()
    }
}

fn parse_issue(value: &Value) -> Issue {
    let fields = value.get("fields").cloned().unwrap_or(Value::Null);
    let status = fields.get("status");

    let summary = fields
        .get("summary")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let description = fields
        .get("description")
        .filter(|d| !d.is_null())
        .cloned();

    // Flattening the description once here keeps the filter free of per-frame work.
    let search_text = match &description {
        Some(doc) => format!("{summary} {}", adf::to_plain_text(doc)).to_lowercase(),
        None => summary.to_lowercase(),
    };

    let assignee_field = fields.get("assignee").filter(|a| !a.is_null());

    Issue {
        key: string_at(value, "key"),
        summary,
        status: status.map(|s| string_at(s, "name")).unwrap_or_default(),
        status_id: status.map(|s| string_at(s, "id")).unwrap_or_default(),
        status_category: status
            .and_then(|s| s.get("statusCategory"))
            .map(|c| string_at(c, "key"))
            .unwrap_or_default(),
        assignee: assignee_field.map(|a| string_at(a, "displayName")),
        assignee_id: assignee_field.map(|a| string_at(a, "accountId")),
        priority: fields
            .get("priority")
            .filter(|p| !p.is_null())
            .map(|p| string_at(p, "name")),
        issue_type: fields
            .get("issuetype")
            .map(|t| string_at(t, "name"))
            .unwrap_or_default(),
        updated: short_date(&string_at(&fields, "updated")),
        description,
        search_text,
    }
}

fn friendly_transport_error(error: &reqwest::Error) -> String {
    if error.is_timeout() {
        "Jira did not answer in time.".to_string()
    } else if error.is_connect() {
        "Could not reach Jira - check the address and your connection.".to_string()
    } else {
        format!("Request failed: {error}")
    }
}

/// Jira's error bodies are JSON with the useful part buried; dig it out.
fn friendly_api_error(status: reqwest::StatusCode, body: &str) -> String {
    let detail = serde_json::from_str::<Value>(body)
        .ok()
        .and_then(|value| {
            value
                .get("errorMessages")
                .and_then(Value::as_array)
                .and_then(|messages| messages.first().cloned())
                .and_then(|m| m.as_str().map(str::to_string))
                .or_else(|| {
                    value
                        .get("errors")
                        .and_then(Value::as_object)
                        .and_then(|errors| errors.values().next().cloned())
                        .and_then(|v| v.as_str().map(str::to_string))
                })
        })
        .unwrap_or_default();

    match status.as_u16() {
        401 => "Jira rejected the credentials - check the e-mail and API token.".to_string(),
        403 => "That account is not allowed to do this.".to_string(),
        404 => "Jira could not find that.".to_string(),
        410 => "This Jira endpoint has been retired.".to_string(),
        429 => "Jira is rate limiting - wait a moment and retry.".to_string(),
        _ if detail.is_empty() => format!("Jira returned {status}."),
        _ => format!("{status}: {detail}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_an_issue_from_a_search_response() {
        let raw = json!({
            "key": "AS-142",
            "fields": {
                "summary": "Fix login redirect",
                "status": { "id": "3", "name": "In Progress",
                            "statusCategory": { "key": "indeterminate" } },
                "assignee": { "displayName": "Dominik", "accountId": "abc123" },
                "priority": { "name": "High" },
                "issuetype": { "name": "Bug" },
                "updated": "2026-09-10T14:22:31.000+0200"
            }
        });

        let issue = parse_issue(&raw);
        assert_eq!(issue.key, "AS-142");
        assert_eq!(issue.summary, "Fix login redirect");
        assert_eq!(issue.status, "In Progress");
        assert_eq!(issue.status_id, "3");
        assert_eq!(issue.status_category, "indeterminate");
        assert_eq!(issue.assignee.as_deref(), Some("Dominik"));
        assert_eq!(issue.assignee_id.as_deref(), Some("abc123"));
        assert_eq!(issue.updated, "2026-09-10 14:22");
    }

    #[test]
    fn an_unassigned_issue_has_no_assignee() {
        let raw = json!({ "key": "AS-1", "fields": { "summary": "x", "assignee": null } });
        let issue = parse_issue(&raw);
        assert_eq!(issue.assignee, None);
        assert_eq!(issue.assignee_id, None);
    }

    #[test]
    fn api_errors_become_readable() {
        let unauthorized = friendly_api_error(reqwest::StatusCode::UNAUTHORIZED, "");
        assert!(unauthorized.contains("API token"));

        let detailed = friendly_api_error(
            reqwest::StatusCode::BAD_REQUEST,
            r#"{"errorMessages":["The JQL query is malformed."]}"#,
        );
        assert!(detailed.contains("malformed"));
    }

    #[test]
    fn formats_the_shapes_jira_fields_actually_take() {
        // A user object: the display name is what a person wants to see.
        assert_eq!(
            format_field(&json!({ "displayName": "Dominik", "accountId": "abc" })).as_deref(),
            Some("Dominik")
        );
        // Named things: priority, resolution, components.
        assert_eq!(
            format_field(&json!({ "name": "High", "id": "2" })).as_deref(),
            Some("High")
        );
        // Lists become one readable line.
        assert_eq!(
            format_field(&json!([{ "name": "backend" }, { "name": "api" }])).as_deref(),
            Some("backend, api")
        );
        assert_eq!(
            format_field(&json!(["urgent", "regression"])).as_deref(),
            Some("urgent, regression")
        );
        // Timestamps get shortened the same way as everywhere else.
        assert_eq!(
            format_field(&json!("2026-09-10T14:22:31.000+0200")).as_deref(),
            Some("2026-09-10 14:22")
        );
        assert_eq!(format_field(&json!(8.0)).as_deref(), Some("8.0"));
        assert_eq!(format_field(&json!(true)).as_deref(), Some("yes"));
    }

    #[test]
    fn a_rich_text_field_is_not_flattened_to_a_line() {
        // The caller draws these as a document instead.
        let doc = json!({ "type": "doc", "version": 1, "content": [] });
        assert_eq!(format_field(&doc), None);
    }

    #[test]
    fn empty_values_produce_no_row() {
        assert!(is_blank(&json!(null)));
        assert!(is_blank(&json!("")));
        assert!(is_blank(&json!("   ")));
        assert!(is_blank(&json!([])));
        assert!(is_blank(&json!({})));
        assert!(!is_blank(&json!(0)));
        assert!(!is_blank(&json!(false)));
    }

    #[test]
    fn extra_fields_put_the_useful_ones_first_then_sort_by_name() {
        let detail = IssueDetail {
            fields: json!({
                "summary": "hidden - shown at the top",
                "customfield_1": "Alpha",
                "reporter": { "displayName": "Anna" },
                "customfield_2": "Zulu",
                "labels": [],
                "created": "2026-01-01T00:00:00.000+0000"
            }),
            names: [
                ("customfield_1".to_string(), "Zebra field".to_string()),
                ("customfield_2".to_string(), "Apple field".to_string()),
            ]
            .into_iter()
            .collect(),
        };

        let ids = detail.extra_field_ids();
        // Preferred fields keep their curated order, blank ones drop out entirely.
        assert_eq!(ids[0], "reporter");
        assert_eq!(ids[1], "created");
        // The rest sort by the name a person sees, not by the raw field id.
        assert_eq!(ids[2], "customfield_2", "Apple field should precede Zebra");
        assert_eq!(ids[3], "customfield_1");
        assert!(!ids.contains(&"summary".to_string()));
        assert!(!ids.contains(&"labels".to_string()));
    }

    #[test]
    fn query_encoding_survives_names_and_addresses() {
        assert_eq!(encode_query("dominik"), "dominik");
        assert_eq!(encode_query("a b"), "a%20b");
        assert_eq!(encode_query("me@example.com"), "me%40example.com");
        assert_eq!(encode_query("O'Brien & co"), "O%27Brien%20%26%20co");
    }
}
