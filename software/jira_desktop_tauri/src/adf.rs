//! Atlassian Document Format, flattened into something drawable.
//!
//! Jira returns descriptions and comments as a node tree rather than text or HTML. This
//! turns the parts that carry meaning into blocks of styled runs. Anything unrecognised
//! becomes a visible placeholder rather than vanishing silently - a comment that quietly
//! loses half its content is worse than one that admits it.

use serde_json::Value;

#[derive(Debug, Clone, Default, PartialEq)]
pub struct Run {
    pub text: String,
    pub bold: bool,
    pub italic: bool,
    pub code: bool,
    pub strike: bool,
    pub link: Option<String>,
}

impl Run {
    fn plain(text: impl Into<String>) -> Self {
        Self {
            text: text.into(),
            ..Default::default()
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum Block {
    Paragraph(Vec<Run>),
    Heading { level: u8, runs: Vec<Run> },
    Bullet { depth: usize, runs: Vec<Run> },
    Ordered { depth: usize, number: usize, runs: Vec<Run> },
    Quote(Vec<Run>),
    Code { language: Option<String>, text: String },
    Rule,
    Unsupported(String),
}

/// Entry point: an ADF document value becomes a list of blocks.
pub fn parse(doc: &Value) -> Vec<Block> {
    let mut blocks = Vec::new();
    if let Some(content) = doc.get("content").and_then(Value::as_array) {
        for node in content {
            walk_block(node, 0, &mut blocks);
        }
    }
    blocks
}

/// Everything as one plain string, for list previews and searching.
pub fn to_plain_text(doc: &Value) -> String {
    let mut out = String::new();
    for block in parse(doc) {
        let line = match &block {
            Block::Paragraph(runs)
            | Block::Heading { runs, .. }
            | Block::Bullet { runs, .. }
            | Block::Ordered { runs, .. }
            | Block::Quote(runs) => runs.iter().map(|r| r.text.as_str()).collect::<String>(),
            Block::Code { text, .. } => text.clone(),
            Block::Rule => String::new(),
            Block::Unsupported(label) => label.clone(),
        };
        if !line.is_empty() {
            if !out.is_empty() {
                out.push(' ');
            }
            out.push_str(line.trim());
        }
    }
    out
}

fn walk_block(node: &Value, depth: usize, out: &mut Vec<Block>) {
    let kind = node.get("type").and_then(Value::as_str).unwrap_or("");

    match kind {
        "paragraph" => {
            let runs = inline_runs(node);
            // A genuinely empty paragraph is ADF's blank line; keep it as spacing.
            out.push(Block::Paragraph(runs));
        }
        "heading" => {
            let level = node
                .get("attrs")
                .and_then(|a| a.get("level"))
                .and_then(Value::as_u64)
                .unwrap_or(3)
                .clamp(1, 6) as u8;
            out.push(Block::Heading {
                level,
                runs: inline_runs(node),
            });
        }
        "bulletList" => {
            for item in children(node) {
                for para in children(item) {
                    if para.get("type").and_then(Value::as_str) == Some("paragraph") {
                        out.push(Block::Bullet {
                            depth,
                            runs: inline_runs(para),
                        });
                    } else {
                        walk_block(para, depth + 1, out);
                    }
                }
            }
        }
        "orderedList" => {
            let start = node
                .get("attrs")
                .and_then(|a| a.get("order"))
                .and_then(Value::as_u64)
                .unwrap_or(1) as usize;
            for (index, item) in children(node).iter().enumerate() {
                for para in children(item) {
                    if para.get("type").and_then(Value::as_str) == Some("paragraph") {
                        out.push(Block::Ordered {
                            depth,
                            number: start + index,
                            runs: inline_runs(para),
                        });
                    } else {
                        walk_block(para, depth + 1, out);
                    }
                }
            }
        }
        "blockquote" => {
            for child in children(node) {
                out.push(Block::Quote(inline_runs(child)));
            }
        }
        "codeBlock" => {
            let language = node
                .get("attrs")
                .and_then(|a| a.get("language"))
                .and_then(Value::as_str)
                .map(str::to_string);
            out.push(Block::Code {
                language,
                text: collect_text(node),
            });
        }
        "rule" => out.push(Block::Rule),
        "mediaSingle" | "mediaGroup" | "media" => {
            out.push(Block::Unsupported("[attachment]".to_string()))
        }
        "table" => out.push(Block::Unsupported("[table - open in browser]".to_string())),
        "panel" => {
            // Panels wrap ordinary content; keeping the children is better than a placeholder.
            for child in children(node) {
                walk_block(child, depth, out);
            }
        }
        "" => {}
        other => out.push(Block::Unsupported(format!("[{other}]"))),
    }
}

fn children(node: &Value) -> Vec<&Value> {
    node.get("content")
        .and_then(Value::as_array)
        .map(|items| items.iter().collect())
        .unwrap_or_default()
}

/// All descendant text, ignoring styling - used for code blocks.
fn collect_text(node: &Value) -> String {
    let mut out = String::new();
    if let Some(text) = node.get("text").and_then(Value::as_str) {
        out.push_str(text);
    }
    for child in children(node) {
        out.push_str(&collect_text(child));
    }
    out
}

fn inline_runs(node: &Value) -> Vec<Run> {
    let mut runs = Vec::new();
    for child in children(node) {
        push_inline(child, &mut runs);
    }
    runs
}

fn push_inline(node: &Value, runs: &mut Vec<Run>) {
    match node.get("type").and_then(Value::as_str).unwrap_or("") {
        "text" => {
            let text = node.get("text").and_then(Value::as_str).unwrap_or("");
            if text.is_empty() {
                return;
            }
            let mut run = Run::plain(text);
            if let Some(marks) = node.get("marks").and_then(Value::as_array) {
                for mark in marks {
                    match mark.get("type").and_then(Value::as_str).unwrap_or("") {
                        "strong" => run.bold = true,
                        "em" => run.italic = true,
                        "code" => run.code = true,
                        "strike" => run.strike = true,
                        "link" => {
                            run.link = mark
                                .get("attrs")
                                .and_then(|a| a.get("href"))
                                .and_then(Value::as_str)
                                .map(str::to_string);
                        }
                        _ => {}
                    }
                }
            }
            runs.push(run);
        }
        "hardBreak" => runs.push(Run::plain("\n")),
        "mention" => {
            let name = node
                .get("attrs")
                .and_then(|a| a.get("text"))
                .and_then(Value::as_str)
                .unwrap_or("@someone");
            let mut run = Run::plain(name);
            run.bold = true;
            runs.push(run);
        }
        "emoji" => {
            let symbol = node
                .get("attrs")
                .and_then(|a| a.get("text"))
                .and_then(Value::as_str)
                .unwrap_or("");
            if !symbol.is_empty() {
                runs.push(Run::plain(symbol));
            }
        }
        "inlineCard" => {
            let url = node
                .get("attrs")
                .and_then(|a| a.get("url"))
                .and_then(Value::as_str)
                .unwrap_or("");
            let mut run = Run::plain(url);
            run.link = Some(url.to_string());
            runs.push(run);
        }
        _ => {
            // Unknown inline node: fall back to whatever text hides inside it.
            let text = collect_text(node);
            if !text.is_empty() {
                runs.push(Run::plain(text));
            }
        }
    }
}

/// The document as editable text, one line per paragraph.
pub fn to_editable_text(doc: &Value) -> String {
    parse(doc)
        .iter()
        .map(|block| match block {
            Block::Paragraph(runs) => runs.iter().map(|r| r.text.as_str()).collect::<String>(),
            Block::Heading { runs, .. } => runs.iter().map(|r| r.text.as_str()).collect::<String>(),
            Block::Bullet { runs, .. } => {
                format!("- {}", runs.iter().map(|r| r.text.as_str()).collect::<String>())
            }
            Block::Ordered { number, runs, .. } => format!(
                "{number}. {}",
                runs.iter().map(|r| r.text.as_str()).collect::<String>()
            ),
            Block::Quote(runs) => {
                format!("> {}", runs.iter().map(|r| r.text.as_str()).collect::<String>())
            }
            Block::Code { text, .. } => text.clone(),
            Block::Rule => "---".to_string(),
            Block::Unsupported(label) => label.clone(),
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// Whether editing this document as plain text and saving it back would preserve it.
///
/// This app edits descriptions as text. For a document that is only plain paragraphs
/// that round-trips exactly; for one containing tables, images, links or any styling,
/// saving would quietly throw that away - so the caller warns instead of destroying it.
pub fn is_plain_text_safe(doc: &Value) -> bool {
    parse(doc).iter().all(|block| match block {
        Block::Paragraph(runs) => runs.iter().all(|run| {
            !run.bold && !run.italic && !run.code && !run.strike && run.link.is_none()
        }),
        _ => false,
    })
}

/// Wraps plain text back into an ADF document, for posting a comment.
pub fn from_plain_text(text: &str) -> Value {
    let paragraphs: Vec<Value> = text
        .split('\n')
        .map(|line| {
            if line.is_empty() {
                serde_json::json!({ "type": "paragraph" })
            } else {
                serde_json::json!({
                    "type": "paragraph",
                    "content": [{ "type": "text", "text": line }]
                })
            }
        })
        .collect();

    serde_json::json!({
        "type": "doc",
        "version": 1,
        "content": paragraphs
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn reads_a_paragraph_with_marks() {
        let doc = json!({
            "type": "doc", "version": 1,
            "content": [{ "type": "paragraph", "content": [
                { "type": "text", "text": "plain " },
                { "type": "text", "text": "bold", "marks": [{ "type": "strong" }] },
                { "type": "text", "text": " and a ", "marks": [] },
                { "type": "text", "text": "link", "marks": [
                    { "type": "link", "attrs": { "href": "https://example.com" } }
                ]}
            ]}]
        });

        let blocks = parse(&doc);
        assert_eq!(blocks.len(), 1);
        let Block::Paragraph(runs) = &blocks[0] else {
            panic!("expected a paragraph, got {:?}", blocks[0]);
        };
        assert_eq!(runs.len(), 4);
        assert!(runs[1].bold);
        assert_eq!(runs[3].link.as_deref(), Some("https://example.com"));
        assert_eq!(to_plain_text(&doc), "plain bold and a link");
    }

    #[test]
    fn reads_lists_and_code() {
        let doc = json!({
            "type": "doc", "version": 1,
            "content": [
                { "type": "bulletList", "content": [
                    { "type": "listItem", "content": [
                        { "type": "paragraph", "content": [{ "type": "text", "text": "first" }] }
                    ]},
                    { "type": "listItem", "content": [
                        { "type": "paragraph", "content": [{ "type": "text", "text": "second" }] }
                    ]}
                ]},
                { "type": "codeBlock", "attrs": { "language": "rust" },
                  "content": [{ "type": "text", "text": "fn main() {}" }] }
            ]
        });

        let blocks = parse(&doc);
        assert_eq!(blocks.len(), 3);
        assert!(matches!(blocks[0], Block::Bullet { .. }));
        assert!(matches!(blocks[1], Block::Bullet { .. }));
        match &blocks[2] {
            Block::Code { language, text } => {
                assert_eq!(language.as_deref(), Some("rust"));
                assert_eq!(text, "fn main() {}");
            }
            other => panic!("expected code, got {other:?}"),
        }
    }

    #[test]
    fn unknown_nodes_stay_visible_instead_of_disappearing() {
        let doc = json!({
            "type": "doc", "version": 1,
            "content": [{ "type": "someFutureNode" }]
        });
        assert_eq!(parse(&doc), vec![Block::Unsupported("[someFutureNode]".to_string())]);
    }

    #[test]
    fn mentions_survive_as_text() {
        let doc = json!({
            "type": "doc", "version": 1,
            "content": [{ "type": "paragraph", "content": [
                { "type": "mention", "attrs": { "text": "@Dominik", "id": "abc" } },
                { "type": "text", "text": " please look" }
            ]}]
        });
        assert_eq!(to_plain_text(&doc), "@Dominik please look");
    }

    #[test]
    fn plain_text_round_trips_into_a_document() {
        let doc = from_plain_text("first line\nsecond line");
        assert_eq!(to_plain_text(&doc), "first line second line");
        assert_eq!(to_editable_text(&doc), "first line\nsecond line");
        assert!(is_plain_text_safe(&doc));
    }

    #[test]
    fn formatting_makes_a_document_unsafe_to_edit_as_text() {
        let styled = json!({
            "type": "doc", "version": 1,
            "content": [{ "type": "paragraph", "content": [
                { "type": "text", "text": "bold", "marks": [{ "type": "strong" }] }
            ]}]
        });
        assert!(!is_plain_text_safe(&styled));

        let tabled = json!({
            "type": "doc", "version": 1,
            "content": [{ "type": "table", "content": [] }]
        });
        assert!(!is_plain_text_safe(&tabled));
    }
}
