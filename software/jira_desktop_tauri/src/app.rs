//! The interface. Every pixel here is drawn by egui - there is no browser engine in
//! this process, and nothing loads a page from Atlassian.

use std::collections::HashMap;

use egui::RichText;

use crate::adf::{self, Block, Run};
use crate::config::{self, AppConfig};
use crate::credentials;
use crate::jira::{
    self, Board, BoardColumn, Comment, Credentials, Issue, IssueDetail, IssueType, JiraClient,
    NewIssue, Priority, Project, Transition, User, UserScope,
};
use crate::theme::{self, ACCENT, AMBER as WARN, MUTED, RED as DANGER};
use crate::worker::{Backend, Event, Task};


#[derive(PartialEq, Clone, Copy)]
enum Tab {
    Issues,
    Spaces,
    Backlog,
}

/// What the spaces panel currently has selected. Favourites is a virtual space that
/// gathers pinned boards from everywhere, which is what makes pinning worth anything
/// once boards are hidden one level deeper.
#[derive(Clone, PartialEq)]
enum SpaceSel {
    Favourites,
    Project(String),
}

/// A project that has at least one board, as derived from the boards themselves.
struct Space {
    key: String,
    name: String,
    boards: usize,
}

/// The key used for boards Jira reports without a project - a board built from a
/// filter spanning several projects has no single home.
const NO_SPACE: &str = "\u{0}none";

/// Spaces derived from the boards themselves, so every space listed has at least one
/// board in it and no board is unreachable from the panel.
fn group_spaces(boards: &[Board]) -> Vec<Space> {
    let mut grouped: HashMap<String, (String, usize)> = HashMap::new();
    for board in boards {
        let key = board
            .project_key
            .clone()
            .unwrap_or_else(|| NO_SPACE.to_string());
        let name = board
            .project
            .clone()
            .unwrap_or_else(|| "Without a space".to_string());
        let entry = grouped.entry(key).or_insert((name, 0));
        entry.1 += 1;
    }

    let mut spaces: Vec<Space> = grouped
        .into_iter()
        .map(|(key, (name, boards))| Space { key, name, boards })
        .collect();
    spaces.sort_by_key(|space| space.name.to_lowercase());
    spaces
}

#[derive(Default)]
struct SettingsForm {
    domain: String,
    email: String,
    token: String,
    error: Option<String>,
}

/// An in-progress description edit. `plain_text_safe` records whether the original
/// document survives a text round trip; when false, saving would drop formatting.
struct EditState {
    key: String,
    summary: String,
    description: String,
    plain_text_safe: bool,
    had_description: bool,
}

#[derive(Default)]
struct CreateForm {
    open: bool,
    form: NewIssue,
    priority_label: String,
    type_label: String,
    project_filter: String,
    project_filter_focused: bool,
    error: Option<String>,
    submitting: bool,
}

#[derive(Default)]
struct AssigneePicker {
    open_for: Option<String>,
    scope_project: Option<String>,
    query: String,
    results: Vec<User>,
    loading: bool,
}

pub struct JiraApp {
    config: AppConfig,
    backend: Option<Backend>,

    tab: Tab,
    account: Option<String>,

    issues: Vec<Issue>,
    selected: Option<String>,
    transitions: HashMap<String, Vec<Transition>>,
    comments: HashMap<String, Vec<Comment>>,
    details: HashMap<String, IssueDetail>,

    boards: Vec<Board>,
    board: Option<i64>,
    space: Option<SpaceSel>,
    /// False while the spaces tab lists boards, true once one is open.
    showing_board: bool,
    columns: HashMap<i64, Vec<BoardColumn>>,
    board_issues: HashMap<i64, Vec<Issue>>,
    backlog: HashMap<i64, Vec<Issue>>,

    projects: Vec<Project>,
    issue_types: HashMap<String, Vec<IssueType>>,
    priorities: Vec<Priority>,

    jql_input: String,
    filter: String,
    board_filter: String,
    space_filter: String,
    comment_draft: String,

    editing: Option<EditState>,
    create: CreateForm,
    picker: AssigneePicker,

    loading_issues: bool,
    loading_board: bool,
    busy_key: Option<String>,
    status: Option<String>,
    error: Option<String>,

    settings_open: bool,
    form: SettingsForm,
}

impl JiraApp {
    pub fn new(cc: &eframe::CreationContext<'_>) -> Self {
        let config = config::load();
        let jql_input = config.jql.clone();

        let mut app = Self {
            config,
            backend: None,
            tab: Tab::Issues,
            account: None,
            issues: Vec::new(),
            selected: None,
            transitions: HashMap::new(),
            comments: HashMap::new(),
            details: HashMap::new(),
            boards: Vec::new(),
            board: None,
            space: None,
            showing_board: false,
            columns: HashMap::new(),
            board_issues: HashMap::new(),
            backlog: HashMap::new(),
            projects: Vec::new(),
            issue_types: HashMap::new(),
            priorities: Vec::new(),
            jql_input,
            filter: String::new(),
            board_filter: String::new(),
            space_filter: String::new(),
            comment_draft: String::new(),
            editing: None,
            create: CreateForm::default(),
            picker: AssigneePicker::default(),
            loading_issues: false,
            loading_board: false,
            busy_key: None,
            status: None,
            error: None,
            settings_open: false,
            form: SettingsForm::default(),
        };

        if !app.connect(&cc.egui_ctx) {
            app.open_settings();
        }
        app
    }

    fn connect(&mut self, ctx: &egui::Context) -> bool {
        let (Some(domain), Some(email)) = (self.config.domain.clone(), self.config.email.clone())
        else {
            return false;
        };
        let Some(token) = credentials::load_token(&email) else {
            return false;
        };

        match JiraClient::new(Credentials {
            domain,
            email,
            token,
        }) {
            Ok(client) => {
                let backend = Backend::new(client, ctx.clone());
                backend.spawn(Task::Whoami);
                backend.spawn(Task::Search(self.config.jql.clone()));
                backend.spawn(Task::Boards);
                backend.spawn(Task::Projects);
                backend.spawn(Task::Priorities);
                self.loading_issues = true;
                self.backend = Some(backend);
                true
            }
            Err(message) => {
                self.error = Some(message);
                false
            }
        }
    }

    fn spawn(&self, task: Task) {
        if let Some(backend) = &self.backend {
            backend.spawn(task);
        }
    }

    fn open_settings(&mut self) {
        self.form = SettingsForm {
            domain: self.config.domain.clone().unwrap_or_default(),
            email: self.config.email.clone().unwrap_or_default(),
            token: String::new(),
            error: None,
        };
        self.settings_open = true;
    }

    fn refresh(&mut self) {
        self.error = None;
        match self.tab {
            Tab::Issues => {
                self.spawn(Task::Search(self.jql_input.clone()));
                self.loading_issues = true;
            }
            Tab::Spaces => {
                self.spawn(Task::Boards);
                if let Some(id) = self.board {
                    self.spawn(Task::BoardIssues(id));
                    self.loading_board = true;
                }
            }
            Tab::Backlog => {
                if let Some(id) = self.board {
                    self.spawn(Task::Backlog(id));
                    self.loading_board = true;
                }
            }
        }
    }

    fn choose_board(&mut self, id: i64) {
        self.board = Some(id);
        if !self.columns.contains_key(&id) {
            self.spawn(Task::BoardColumns(id));
        }
        if !self.board_issues.contains_key(&id) {
            self.spawn(Task::BoardIssues(id));
            self.loading_board = true;
        }
        if matches!(self.tab, Tab::Backlog) && !self.backlog.contains_key(&id) {
            self.spawn(Task::Backlog(id));
            self.loading_board = true;
        }
    }

    /// Issues can live in any of three caches; the detail pane needs them all.
    fn issue_by_key(&self, key: &str) -> Option<Issue> {
        self.issues
            .iter()
            .chain(self.board_issues.values().flatten())
            .chain(self.backlog.values().flatten())
            .find(|i| i.key == key)
            .cloned()
    }

    fn select(&mut self, key: String) {
        if self.selected.as_deref() == Some(key.as_str()) {
            return;
        }
        self.comment_draft.clear();
        self.editing = None;
        if !self.transitions.contains_key(&key) {
            self.spawn(Task::Transitions(key.clone()));
        }
        if !self.comments.contains_key(&key) {
            self.spawn(Task::Comments(key.clone()));
        }
        if !self.details.contains_key(&key) {
            self.spawn(Task::Detail(key.clone()));
        }
        self.selected = Some(key);
    }

    fn reload_after_change(&mut self, key: &str) {
        self.transitions.remove(key);
        self.details.remove(key);
        self.spawn(Task::Detail(key.to_string()));
        self.spawn(Task::Transitions(key.to_string()));
        self.spawn(Task::Search(self.jql_input.clone()));
        self.loading_issues = true;
        if let Some(id) = self.board {
            self.spawn(Task::BoardIssues(id));
            self.spawn(Task::Backlog(id));
        }
    }

    fn apply_events(&mut self) {
        let events = match &self.backend {
            Some(backend) => backend.drain(),
            None => return,
        };

        for event in events {
            match event {
                Event::Whoami(Ok(user)) => self.account = Some(user.display_name),
                Event::Whoami(Err(message)) => self.error = Some(message),

                Event::Issues(Ok(issues)) => {
                    self.loading_issues = false;
                    self.issues = issues;
                    self.error = None;
                }
                Event::Issues(Err(message)) => {
                    self.loading_issues = false;
                    self.error = Some(message);
                }

                Event::Transitions { key, result } => match result {
                    Ok(list) => {
                        self.transitions.insert(key, list);
                    }
                    Err(message) => self.error = Some(message),
                },

                Event::Transitioned { key, result } => {
                    self.busy_key = None;
                    match result {
                        Ok(()) => {
                            self.status = Some(format!("{key} moved"));
                            self.reload_after_change(&key);
                        }
                        Err(message) => self.error = Some(message),
                    }
                }

                Event::Detail { key, result } => match result {
                    Ok(detail) => {
                        self.details.insert(key, detail);
                    }
                    Err(message) => self.error = Some(message),
                },

                Event::Comments { key, result } => match result {
                    Ok(list) => {
                        self.comments.insert(key, list);
                    }
                    Err(message) => self.error = Some(message),
                },

                Event::CommentAdded { key, result } => {
                    self.busy_key = None;
                    match result {
                        Ok(()) => {
                            self.status = Some(format!("comment added to {key}"));
                            self.comment_draft.clear();
                            self.comments.remove(&key);
                            self.spawn(Task::Comments(key));
                        }
                        Err(message) => self.error = Some(message),
                    }
                }

                Event::IssueUpdated { key, result } => {
                    self.busy_key = None;
                    match result {
                        Ok(()) => {
                            self.status = Some(format!("{key} saved"));
                            self.editing = None;
                            self.reload_after_change(&key);
                        }
                        Err(message) => self.error = Some(message),
                    }
                }

                Event::Assigned { key, result } => {
                    self.busy_key = None;
                    match result {
                        Ok(()) => {
                            self.status = Some(format!("{key} reassigned"));
                            self.reload_after_change(&key);
                        }
                        Err(message) => self.error = Some(message),
                    }
                }

                Event::IssueCreated(result) => {
                    self.create.submitting = false;
                    match result {
                        Ok(key) => {
                            self.status = Some(format!("created {key}"));
                            self.create = CreateForm::default();
                            self.spawn(Task::Search(self.jql_input.clone()));
                            self.loading_issues = true;
                            if let Some(id) = self.board {
                                self.spawn(Task::BoardIssues(id));
                                self.spawn(Task::Backlog(id));
                            }
                        }
                        Err(message) => self.create.error = Some(message),
                    }
                }

                Event::Boards(Ok(boards)) => {
                    if self.board.is_none() {
                        if let Some(first) = boards.first() {
                            let id = first.id;
                            self.boards = boards;
                            self.choose_board(id);
                            continue;
                        }
                    }
                    self.boards = boards;
                }
                Event::Boards(Err(message)) => self.error = Some(message),

                Event::BoardColumns { board_id, result } => match result {
                    Ok(list) => {
                        self.columns.insert(board_id, list);
                    }
                    Err(message) => self.error = Some(message),
                },

                Event::BoardIssues { board_id, result } => {
                    self.loading_board = false;
                    match result {
                        Ok(list) => {
                            self.board_issues.insert(board_id, list);
                        }
                        Err(message) => self.error = Some(message),
                    }
                }

                Event::Backlog { board_id, result } => {
                    self.loading_board = false;
                    match result {
                        Ok(list) => {
                            self.backlog.insert(board_id, list);
                        }
                        Err(message) => self.error = Some(message),
                    }
                }

                Event::Projects(Ok(list)) => self.projects = list,
                Event::Projects(Err(message)) => self.error = Some(message),

                Event::IssueTypes {
                    project_key,
                    result,
                } => match result {
                    Ok(list) => {
                        self.issue_types.insert(project_key, list);
                    }
                    Err(message) => self.create.error = Some(message),
                },

                Event::Priorities(Ok(list)) => self.priorities = list,
                Event::Priorities(Err(message)) => self.error = Some(message),

                Event::AssignableUsers(result) => {
                    self.picker.loading = false;
                    match result {
                        Ok(list) => self.picker.results = list,
                        Err(message) => self.error = Some(message),
                    }
                }
            }
        }
    }
}


fn split_lines(runs: &[Run]) -> Vec<Vec<Run>> {
    let mut lines: Vec<Vec<Run>> = vec![Vec::new()];
    for run in runs {
        for (index, piece) in run.text.split('\n').enumerate() {
            if index > 0 {
                lines.push(Vec::new());
            }
            if !piece.is_empty() {
                let mut copy = run.clone();
                copy.text = piece.to_string();
                if let Some(line) = lines.last_mut() {
                    line.push(copy);
                }
            }
        }
    }
    lines
}

fn draw_runs(ui: &mut egui::Ui, runs: &[Run]) {
    if runs.is_empty() {
        ui.add_space(4.0);
        return;
    }

    for line in split_lines(runs) {
        if line.is_empty() {
            ui.add_space(4.0);
            continue;
        }
        ui.horizontal_wrapped(|ui| {
            ui.spacing_mut().item_spacing.x = 0.0;
            for run in &line {
                let mut text = RichText::new(&run.text);
                if run.bold {
                    text = text.strong();
                }
                if run.italic {
                    text = text.italics();
                }
                if run.code {
                    text = text.monospace().background_color(theme::SURFACE_HI);
                }
                if run.strike {
                    text = text.strikethrough();
                }
                match &run.link {
                    Some(href) => {
                        ui.hyperlink_to(text.color(ACCENT), href);
                    }
                    None => {
                        ui.label(text);
                    }
                }
            }
        });
    }
}

fn draw_blocks(ui: &mut egui::Ui, blocks: &[Block]) {
    for block in blocks {
        match block {
            Block::Paragraph(runs) => {
                draw_runs(ui, runs);
                ui.add_space(4.0);
            }
            Block::Heading { level, runs } => {
                ui.add_space(6.0);
                let size = match level {
                    1 => 20.0,
                    2 => 17.0,
                    _ => 15.0,
                };
                let joined: String = runs.iter().map(|r| r.text.as_str()).collect();
                ui.label(RichText::new(joined).size(size).strong());
                ui.add_space(2.0);
            }
            Block::Bullet { depth, runs } => {
                ui.horizontal_wrapped(|ui| {
                    ui.add_space(12.0 + *depth as f32 * 12.0);
                    ui.label(RichText::new("\u{2022}").color(MUTED));
                    ui.add_space(6.0);
                    draw_runs(ui, runs);
                });
            }
            Block::Ordered {
                depth,
                number,
                runs,
            } => {
                ui.horizontal_wrapped(|ui| {
                    ui.add_space(12.0 + *depth as f32 * 12.0);
                    ui.label(RichText::new(format!("{number}.")).color(MUTED));
                    ui.add_space(6.0);
                    draw_runs(ui, runs);
                });
            }
            Block::Quote(runs) => {
                ui.horizontal_wrapped(|ui| {
                    ui.add_space(8.0);
                    ui.label(RichText::new("\u{2503}").color(MUTED));
                    ui.add_space(6.0);
                    draw_runs(ui, runs);
                });
            }
            Block::Code { language, text } => {
                if let Some(language) = language {
                    ui.label(RichText::new(language).small().color(MUTED));
                }
                egui::Frame::default()
                    .fill(theme::BG)
                    .stroke(egui::Stroke::new(1.0, theme::BORDER))
                    .inner_margin(9.0)
                    .corner_radius(6.0)
                    .show(ui, |ui| {
                        ui.label(RichText::new(text).monospace());
                    });
                ui.add_space(4.0);
            }
            Block::Rule => {
                ui.separator();
            }
            Block::Unsupported(label) => {
                ui.label(RichText::new(label).italics().color(MUTED));
            }
        }
    }
}

impl JiraApp {
    // ---------- chrome ----------

    fn top_bar(&mut self, ui: &mut egui::Ui) {
        egui::Panel::top("top").show(ui, |ui| {
            ui.add_space(6.0);
            ui.horizontal(|ui| {
                ui.label(RichText::new("Jira").size(17.0).strong());
                ui.add_space(10.0);

                ui.selectable_value(&mut self.tab, Tab::Issues, "My issues");
                ui.selectable_value(&mut self.tab, Tab::Spaces, "Spaces");
                if ui
                    .selectable_value(&mut self.tab, Tab::Backlog, "Backlog")
                    .clicked()
                {
                    if let Some(id) = self.board {
                        if !self.backlog.contains_key(&id) {
                            self.spawn(Task::Backlog(id));
                            self.loading_board = true;
                        }
                    }
                }

                ui.add_space(10.0);
                if ui.button("Refresh").clicked() {
                    self.refresh();
                }
                if ui
                    .button(RichText::new("+ Create").color(ACCENT))
                    .clicked()
                {
                    self.create.open = true;
                    self.create.error = None;
                }
                if self.loading_issues || self.loading_board {
                    ui.spinner();
                }

                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if ui.button("Settings").clicked() {
                        self.open_settings();
                    }
                    if let Some(account) = &self.account {
                        ui.label(RichText::new(account).color(MUTED));
                    }
                });
            });

            ui.add_space(4.0);
            match self.tab {
                Tab::Issues => {
                    ui.horizontal(|ui| {
                        ui.label(RichText::new("JQL").small().color(MUTED));
                        let response = ui.add(
                            egui::TextEdit::singleline(&mut self.jql_input)
                                .desired_width(f32::INFINITY)
                                .font(egui::TextStyle::Monospace),
                        );
                        if response.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter)) {
                            self.config.jql = self.jql_input.clone();
                            config::save(&self.config);
                            self.spawn(Task::Search(self.jql_input.clone()));
                            self.loading_issues = true;
                        }
                    });
                }
                Tab::Spaces => self.breadcrumb(ui),
                Tab::Backlog => {
                    let name = self
                        .board
                        .and_then(|id| self.boards.iter().find(|b| b.id == id))
                        .map(|b| b.name.clone());
                    ui.horizontal(|ui| match name {
                        Some(name) => {
                            ui.label(RichText::new("Board").small().color(MUTED));
                            ui.label(RichText::new(name).small().strong());
                        }
                        None => {
                            ui.label(
                                RichText::new("Open a board under Spaces first.")
                                    .small()
                                    .color(MUTED),
                            );
                        }
                    });
                }
            }
            ui.add_space(6.0);
        });
    }

    fn spaces(&self) -> Vec<Space> {
        group_spaces(&self.boards)
    }

    fn boards_in(&self, selection: &SpaceSel) -> Vec<&Board> {
        let mut boards: Vec<&Board> = match selection {
            SpaceSel::Favourites => self
                .boards
                .iter()
                .filter(|b| self.config.favourite_boards.contains(&b.id))
                .collect(),
            SpaceSel::Project(key) => self
                .boards
                .iter()
                .filter(|b| b.project_key.as_deref().unwrap_or(NO_SPACE) == key.as_str())
                .collect(),
        };
        boards.sort_by_key(|b| b.name.to_lowercase());
        boards
    }

    fn open_board(&mut self, id: i64) {
        self.choose_board(id);
        self.showing_board = true;
    }

    /// Left panel of the spaces tab.
    fn spaces_panel(&mut self, ui: &mut egui::Ui) {
        egui::Panel::left("spaces")
            .resizable(true)
            .default_size(300.0)
            .size_range(220.0..=460.0)
            .show(ui, |ui| {
                ui.add_space(6.0);
                ui.add(
                    egui::TextEdit::singleline(&mut self.space_filter)
                        .hint_text("Search spaces")
                        .desired_width(f32::INFINITY),
                );
                ui.add_space(6.0);

                let needle = self.space_filter.trim().to_lowercase();
                let spaces = self.spaces();
                let favourites = self.config.favourite_boards.len();
                let mut chosen: Option<SpaceSel> = None;

                egui::ScrollArea::vertical()
                    .id_salt("spaces-list")
                    .auto_shrink([false, false])
                    .show(ui, |ui| {
                        if favourites > 0 && needle.is_empty() {
                            let selected = self.space == Some(SpaceSel::Favourites);
                            if Self::space_row(
                                ui,
                                "\u{2605} Favourites",
                                favourites,
                                selected,
                                WARN,
                            )
                            .clicked()
                            {
                                chosen = Some(SpaceSel::Favourites);
                            }
                            ui.add_space(6.0);
                            ui.separator();
                            ui.add_space(6.0);
                        }

                        let mut any = false;
                        for space in &spaces {
                            if !needle.is_empty()
                                && !space.name.to_lowercase().contains(&needle)
                                && !space.key.to_lowercase().contains(&needle)
                            {
                                continue;
                            }
                            any = true;
                            let selected =
                                self.space == Some(SpaceSel::Project(space.key.clone()));
                            if Self::space_row(ui, &space.name, space.boards, selected, ACCENT)
                                .clicked()
                            {
                                chosen = Some(SpaceSel::Project(space.key.clone()));
                            }
                            ui.add_space(5.0);
                        }

                        if !any {
                            ui.add_space(16.0);
                            ui.vertical_centered(|ui| {
                                ui.label(
                                    RichText::new(if self.boards.is_empty() {
                                        "No boards visible."
                                    } else {
                                        "No space matches."
                                    })
                                    .color(MUTED),
                                );
                            });
                        }
                    });

                if let Some(selection) = chosen {
                    self.space = Some(selection);
                    // Picking a different space returns to its board list.
                    self.showing_board = false;
                    self.board_filter.clear();
                }
            });
    }

    fn space_row(
        ui: &mut egui::Ui,
        name: &str,
        boards: usize,
        selected: bool,
        accent: egui::Color32,
    ) -> egui::Response {
        theme::card_frame(selected)
            .show(ui, |ui| {
                ui.set_width(ui.available_width());
                ui.horizontal(|ui| {
                    ui.label(
                        RichText::new(name).color(if selected { accent } else { theme::TEXT }),
                    );
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        theme::chip(ui, &boards.to_string(), MUTED);
                    });
                });
            })
            .response
            .interact(egui::Sense::click())
    }

    /// Central area of the spaces tab while no board is open.
    fn boards_grid(&mut self, ui: &mut egui::Ui) {
        egui::CentralPanel::default().show(ui, |ui| {
            let Some(selection) = self.space.clone() else {
                ui.add_space(40.0);
                ui.vertical_centered(|ui| {
                    ui.label(RichText::new("Pick a space on the left.").color(MUTED));
                });
                return;
            };

            ui.add_space(6.0);
            ui.add(
                egui::TextEdit::singleline(&mut self.board_filter)
                    .hint_text("Search boards in this space")
                    .desired_width(f32::INFINITY),
            );
            ui.add_space(8.0);

            let needle = self.board_filter.trim().to_lowercase();
            let boards: Vec<(i64, String, bool)> = self
                .boards_in(&selection)
                .into_iter()
                .filter(|b| needle.is_empty() || b.name.to_lowercase().contains(&needle))
                .map(|b| {
                    (
                        b.id,
                        b.name.clone(),
                        self.config.favourite_boards.contains(&b.id),
                    )
                })
                .collect();

            let mut open: Option<i64> = None;
            let mut toggled: Option<i64> = None;

            egui::ScrollArea::vertical()
                .id_salt("boards-grid")
                .auto_shrink([false, false])
                .show(ui, |ui| {
                    if boards.is_empty() {
                        ui.add_space(30.0);
                        ui.vertical_centered(|ui| {
                            ui.label(RichText::new("No board here.").color(MUTED));
                        });
                        return;
                    }

                    for (id, name, favourite) in &boards {
                        let selected = self.board == Some(*id);
                        let response = theme::card_frame(selected)
                            .show(ui, |ui| {
                                ui.set_width(ui.available_width());
                                ui.horizontal(|ui| {
                                    ui.label(RichText::new(name).size(14.0));
                                    ui.with_layout(
                                        egui::Layout::right_to_left(egui::Align::Center),
                                        |ui| {
                                            let star =
                                                if *favourite { "\u{2605}" } else { "\u{2606}" };
                                            let colour = if *favourite { WARN } else { MUTED };
                                            if ui
                                                .add(
                                                    egui::Button::new(
                                                        RichText::new(star).color(colour),
                                                    )
                                                    .frame(false),
                                                )
                                                .on_hover_text(if *favourite {
                                                    "Remove from favourites"
                                                } else {
                                                    "Pin to Favourites"
                                                })
                                                .clicked()
                                            {
                                                toggled = Some(*id);
                                            }
                                        },
                                    );
                                });
                            })
                            .response
                            .interact(egui::Sense::click());

                        if response.clicked() {
                            open = Some(*id);
                        }
                        ui.add_space(6.0);
                    }
                });

            if let Some(id) = toggled {
                if let Some(position) = self.config.favourite_boards.iter().position(|b| *b == id) {
                    self.config.favourite_boards.remove(position);
                } else {
                    self.config.favourite_boards.push(id);
                }
                config::save(&self.config);
            }
            if let Some(id) = open {
                self.open_board(id);
            }
        });
    }

    /// The trail above the content: which space, which board, and the way back.
    fn breadcrumb(&mut self, ui: &mut egui::Ui) {
        ui.horizontal(|ui| {
            if self.showing_board && ui.button("\u{2190} Boards").clicked() {
                self.showing_board = false;
            }

            let space_name = match &self.space {
                Some(SpaceSel::Favourites) => Some("Favourites".to_string()),
                Some(SpaceSel::Project(key)) => self
                    .spaces()
                    .into_iter()
                    .find(|s| &s.key == key)
                    .map(|s| s.name),
                None => None,
            };

            match space_name {
                Some(name) => ui.label(RichText::new(name).small().color(MUTED)),
                None => ui.label(RichText::new("No space chosen").small().color(MUTED)),
            };

            if self.showing_board {
                let board_name = self
                    .board
                    .and_then(|id| self.boards.iter().find(|b| b.id == id))
                    .map(|b| b.name.clone())
                    .unwrap_or_default();
                ui.label(RichText::new("/").small().color(MUTED));
                ui.label(RichText::new(board_name).small().strong());
            }
        });
    }

    fn status_bar(&mut self, ui: &mut egui::Ui) {
        if self.error.is_none() && self.status.is_none() {
            return;
        }
        let mut dismiss = false;

        egui::Panel::bottom("status").show(ui, |ui| {
            ui.add_space(4.0);
            ui.horizontal(|ui| {
                if let Some(message) = self.error.clone() {
                    ui.label(RichText::new(message).color(DANGER));
                } else if let Some(message) = self.status.clone() {
                    ui.label(RichText::new(message).color(MUTED));
                }
                if ui.small_button("dismiss").clicked() {
                    dismiss = true;
                }
            });
            ui.add_space(4.0);
        });

        if dismiss {
            self.error = None;
            self.status = None;
        }
    }

    // ---------- lists ----------

    fn issue_list(&mut self, ui: &mut egui::Ui) {
        egui::Panel::left("issues")
            .resizable(true)
            .default_size(360.0)
            .size_range(260.0..=560.0)
            .show(ui, |ui| {
                ui.add_space(6.0);
                ui.add(
                    egui::TextEdit::singleline(&mut self.filter)
                        .hint_text("Filter by key or text")
                        .desired_width(f32::INFINITY),
                );
                ui.add_space(6.0);

                let needle = self.filter.trim().to_lowercase();
                let source: Vec<Issue> = match self.tab {
                    Tab::Issues => self.issues.clone(),
                    Tab::Backlog => self
                        .board
                        .and_then(|id| self.backlog.get(&id))
                        .cloned()
                        .unwrap_or_default(),
                    // The spaces tab has its own panels and never reaches here.
                    Tab::Spaces => Vec::new(),
                };

                let visible: Vec<Issue> = source
                    .into_iter()
                    .filter(|issue| {
                        needle.is_empty()
                            || issue.key.to_lowercase().contains(&needle)
                            || issue.search_text.contains(&needle)
                    })
                    .collect();

                ui.label(
                    RichText::new(format!("{} issues", visible.len()))
                        .small()
                        .color(MUTED),
                );
                ui.separator();

                let mut clicked: Option<String> = None;
                egui::ScrollArea::vertical()
                    .id_salt("issue-list")
                    .show(ui, |ui| {
                        if visible.is_empty() && !self.loading_issues && !self.loading_board {
                            ui.add_space(20.0);
                            ui.vertical_centered(|ui| {
                                ui.label(RichText::new("Nothing here.").color(MUTED));
                            });
                        }

                        for issue in visible {
                            let selected = self.selected.as_deref() == Some(issue.key.as_str());
                            if Self::issue_row(ui, &issue, selected).clicked() {
                                clicked = Some(issue.key);
                            }
                            ui.add_space(6.0);
                        }
                    });

                if let Some(key) = clicked {
                    self.select(key);
                }
            });
    }

    // ---------- board ----------

    fn board_view(&mut self, ui: &mut egui::Ui) {
        let Some(board_id) = self.board else {
            ui.add_space(40.0);
            ui.vertical_centered(|ui| {
                ui.label(RichText::new("Pick a board above.").color(MUTED));
            });
            return;
        };

        let columns = self.columns.get(&board_id).cloned().unwrap_or_default();
        let issues = self.board_issues.get(&board_id).cloned().unwrap_or_default();

        if columns.is_empty() {
            ui.add_space(40.0);
            ui.vertical_centered(|ui| {
                ui.spinner();
                ui.label(RichText::new("Loading board layout...").color(MUTED));
            });
            return;
        }

        let mut moved: Option<(String, Vec<String>)> = None;
        let mut clicked: Option<String> = None;

        egui::ScrollArea::horizontal()
            .id_salt("board-scroll")
            .show(ui, |ui| {
                ui.horizontal_top(|ui| {
                    for column in &columns {
                        let cards: Vec<&Issue> = issues
                            .iter()
                            .filter(|i| column.status_ids.contains(&i.status_id))
                            .collect();

                        ui.vertical(|ui| {
                            ui.set_width(260.0);
                            ui.horizontal(|ui| {
                                ui.label(
                                    RichText::new(column.name.to_uppercase())
                                        .size(11.0)
                                        .strong()
                                        .color(MUTED),
                                );
                                theme::chip(ui, &cards.len().to_string(), MUTED);
                            });
                            ui.add_space(6.0);

                            let frame = egui::Frame::default()
                                .fill(theme::BG)
                                .stroke(egui::Stroke::new(1.0, theme::BORDER))
                                .inner_margin(7.0)
                                .corner_radius(10.0);

                            let (_, dropped) =
                                ui.dnd_drop_zone::<String, _>(frame, |ui| {
                                    ui.set_min_height(360.0);
                                    ui.set_width(248.0);

                                    for issue in &cards {
                                        let id = egui::Id::new(("card", &issue.key));
                                        let response = ui
                                            .dnd_drag_source(id, issue.key.clone(), |ui| {
                                                Self::draw_card(ui, issue);
                                            })
                                            .response;
                                        if response.clicked() {
                                            clicked = Some(issue.key.clone());
                                        }
                                        ui.add_space(4.0);
                                    }

                                    if cards.is_empty() {
                                        ui.add_space(8.0);
                                        ui.label(RichText::new("empty").small().color(MUTED));
                                    }
                                });

                            if let Some(key) = dropped {
                                let key = key.as_ref().clone();
                                // Only a real column change is worth a request.
                                let already_here = issues
                                    .iter()
                                    .find(|i| i.key == key)
                                    .map(|i| column.status_ids.contains(&i.status_id))
                                    .unwrap_or(false);
                                if !already_here {
                                    moved = Some((key, column.status_ids.clone()));
                                }
                            }
                        });
                        ui.add_space(8.0);
                    }
                });
            });

        if let Some(key) = clicked {
            self.select(key);
        }
        if let Some((key, status_ids)) = moved {
            self.busy_key = Some(key.clone());
            self.status = None;
            self.spawn(Task::MoveToColumn { key, status_ids });
        }
    }

    /// One row in the side list: key and status on top, summary, then who owns it.
    fn issue_row(ui: &mut egui::Ui, issue: &Issue, selected: bool) -> egui::Response {
        let response = theme::card_frame(selected)
            .show(ui, |ui| {
                ui.set_width(ui.available_width());

                ui.horizontal(|ui| {
                    ui.label(RichText::new(&issue.key).size(11.5).strong().color(ACCENT));
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        theme::chip(
                            ui,
                            &issue.status,
                            theme::status_color(&issue.status_category),
                        );
                    });
                });

                ui.add_space(1.0);
                ui.label(RichText::new(&issue.summary));
                ui.add_space(3.0);

                ui.horizontal(|ui| {
                    theme::avatar(ui, issue.assignee.as_deref(), 18.0);
                    ui.add_space(2.0);
                    theme::chip(ui, &issue.issue_type, theme::type_color(&issue.issue_type));
                    if let Some(priority) = &issue.priority {
                        theme::chip(ui, priority, theme::priority_color(priority));
                    }
                });
            })
            .response;

        response.interact(egui::Sense::click())
    }

    /// A board tile. Kept compact so a column shows several without scrolling.
    fn draw_card(ui: &mut egui::Ui, issue: &Issue) {
        theme::card_frame(false).show(ui, |ui| {
            ui.set_width(210.0);
            ui.horizontal(|ui| {
                ui.label(RichText::new(&issue.key).size(11.0).strong().color(ACCENT));
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    theme::avatar(ui, issue.assignee.as_deref(), 17.0);
                });
            });
            ui.add_space(1.0);
            ui.label(RichText::new(&issue.summary).size(12.5));
            ui.add_space(3.0);
            ui.horizontal(|ui| {
                theme::chip(ui, &issue.issue_type, theme::type_color(&issue.issue_type));
                if let Some(priority) = &issue.priority {
                    theme::chip(ui, priority, theme::priority_color(priority));
                }
            });
        });
    }

    // ---------- detail ----------

    /// The ticket beside an open board, rather than instead of it.
    fn detail_side(&mut self, ui: &mut egui::Ui) {
        let Some(key) = self.selected.clone() else {
            return;
        };
        let Some(issue) = self.issue_by_key(&key) else {
            return;
        };
        let mut close = false;

        egui::Panel::right("detail-side")
            .resizable(true)
            .default_size(460.0)
            .size_range(340.0..=760.0)
            .show(ui, |ui| {
                ui.add_space(6.0);
                ui.horizontal(|ui| {
                    ui.label(RichText::new("Ticket").small().color(MUTED));
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        close = theme::close_button(ui).clicked();
                    });
                });
                ui.separator();
                egui::ScrollArea::vertical()
                    .id_salt("detail-side-scroll")
                    .show(ui, |ui| {
                        self.detail_body(ui, &issue);
                    });
            });

        if close {
            self.selected = None;
        }
    }

    fn detail(&mut self, ui: &mut egui::Ui) {
        egui::CentralPanel::default().show(ui, |ui| {
            let Some(key) = self.selected.clone() else {
                ui.add_space(40.0);
                ui.vertical_centered(|ui| {
                    ui.label(RichText::new("Pick an issue on the left.").color(MUTED));
                });
                return;
            };
            let Some(issue) = self.issue_by_key(&key) else {
                return;
            };

            egui::ScrollArea::vertical()
                .id_salt("detail")
                .show(ui, |ui| {
                    self.detail_body(ui, &issue);
                });
        });
    }

    fn detail_body(&mut self, ui: &mut egui::Ui, issue: &Issue) {
        let key = issue.key.clone();
        let busy = self.busy_key.as_deref() == Some(key.as_str());

        ui.horizontal(|ui| {
            ui.label(RichText::new(&issue.key).size(16.0).strong().color(ACCENT));
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                if ui.button("Open in browser").clicked() {
                    if let Some(backend) = &self.backend {
                        let _ = opener::open_browser(backend.client().browse_url(&key));
                    }
                }
                if self.editing.is_none() && ui.button("Edit").clicked() {
                    let description = issue
                        .description
                        .as_ref()
                        .map(adf::to_editable_text)
                        .unwrap_or_default();
                    let plain_text_safe = issue
                        .description
                        .as_ref()
                        .map(adf::is_plain_text_safe)
                        .unwrap_or(true);
                    self.editing = Some(EditState {
                        key: key.clone(),
                        summary: issue.summary.clone(),
                        description,
                        plain_text_safe,
                        had_description: issue.description.is_some(),
                    });
                }
            });
        });

        let editing_this = self
            .editing
            .as_ref()
            .map(|e| e.key == key)
            .unwrap_or(false);

        if editing_this {
            self.edit_form(ui, busy);
        } else {
            ui.label(RichText::new(&issue.summary).size(19.0).strong());
        }

        ui.add_space(8.0);
        ui.horizontal_wrapped(|ui| {
            theme::chip(ui, &issue.issue_type, theme::type_color(&issue.issue_type));
            if let Some(priority) = &issue.priority {
                theme::chip(ui, priority, theme::priority_color(priority));
            }
            ui.add_space(8.0);

            theme::avatar(ui, issue.assignee.as_deref(), 20.0);
            ui.add_space(2.0);
            let label = issue.assignee.clone().unwrap_or_else(|| "Unassigned".into());
            if ui.small_button(label).clicked() {
                self.picker.open_for = Some(key.clone());
                self.picker.query.clear();
                self.picker.results.clear();
                self.picker.loading = true;
                self.spawn(Task::AssignableUsers {
                    scope: UserScope::Issue(key.clone()),
                    query: String::new(),
                });
            }
            ui.add_space(14.0);
            ui.label(RichText::new("updated").small().color(MUTED));
            ui.label(RichText::new(&issue.updated).small().color(MUTED));
        });

        ui.add_space(10.0);
        theme::section(ui, "Status");
        self.transition_row(ui, issue);

        if !editing_this {
            ui.add_space(14.0);
            ui.separator();
            theme::section(ui, "Description");
            ui.add_space(4.0);
            match &issue.description {
                Some(doc) => draw_blocks(ui, &adf::parse(doc)),
                None => {
                    ui.label(RichText::new("No description.").italics().color(MUTED));
                }
            }
        }

        ui.add_space(14.0);
        ui.separator();
        self.all_fields(ui, &key);

        ui.add_space(14.0);
        ui.separator();
        self.comment_section(ui, &key);
    }

    /// Everything else Jira holds for this issue, including custom fields.
    fn all_fields(&mut self, ui: &mut egui::Ui, key: &str) {
        theme::section(ui, "Details");

        let Some(detail) = self.details.get(key) else {
            ui.horizontal(|ui| {
                ui.spinner();
                ui.label(RichText::new("loading fields").small().color(MUTED));
            });
            return;
        };

        // Attachments, sub-tasks and links are lists of things, not single values.
        if let Some(attachments) = detail.field("attachment").and_then(|v| v.as_array()) {
            Self::field_row(ui, "Attachments", |ui| {
                for item in attachments {
                    let name = item
                        .get("filename")
                        .and_then(|v| v.as_str())
                        .unwrap_or("file");
                    match item.get("content").and_then(|v| v.as_str()) {
                        Some(url) => {
                            ui.hyperlink_to(RichText::new(name).color(ACCENT), url);
                        }
                        None => {
                            ui.label(name);
                        }
                    }
                }
            });
        }

        if let Some(subtasks) = detail.field("subtasks").and_then(|v| v.as_array()) {
            Self::field_row(ui, "Sub-tasks", |ui| {
                for item in subtasks {
                    let child = item.get("key").and_then(|v| v.as_str()).unwrap_or("");
                    let summary = item
                        .get("fields")
                        .and_then(|f| f.get("summary"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    ui.label(RichText::new(format!("{child}  {summary}")).small());
                }
            });
        }

        if let Some(links) = detail.field("issuelinks").and_then(|v| v.as_array()) {
            Self::field_row(ui, "Linked issues", |ui| {
                for item in links {
                    let (relation, other) = if let Some(outward) = item.get("outwardIssue") {
                        (
                            item.get("type")
                                .and_then(|t| t.get("outward"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("relates to"),
                            outward,
                        )
                    } else if let Some(inward) = item.get("inwardIssue") {
                        (
                            item.get("type")
                                .and_then(|t| t.get("inward"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("relates to"),
                            inward,
                        )
                    } else {
                        continue;
                    };
                    let other_key = other.get("key").and_then(|v| v.as_str()).unwrap_or("");
                    let summary = other
                        .get("fields")
                        .and_then(|f| f.get("summary"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    ui.label(RichText::new(format!("{relation} {other_key}  {summary}")).small());
                }
            });
        }

        // Everything else, generically: preferred fields first, then alphabetical.
        for id in detail.extra_field_ids() {
            let Some(value) = detail.field(&id) else {
                continue;
            };
            let label = detail.label_for(&id);

            // A rich-text field is drawn as a document rather than squeezed to a line.
            if value.get("type").and_then(|v| v.as_str()) == Some("doc") {
                Self::field_row(ui, &label, |ui| {
                    draw_blocks(ui, &adf::parse(value));
                });
                continue;
            }

            if let Some(text) = jira::format_field(value) {
                Self::field_row(ui, &label, |ui| {
                    ui.label(RichText::new(text).small());
                });
            }
        }
    }

    /// A label column and a value column, so the details read as a table.
    fn field_row(ui: &mut egui::Ui, label: &str, value: impl FnOnce(&mut egui::Ui)) {
        ui.horizontal_top(|ui| {
            ui.add_sized(
                [148.0, 18.0],
                egui::Label::new(RichText::new(label).small().color(MUTED)).wrap(),
            );
            ui.vertical(|ui| {
                value(ui);
            });
        });
        ui.add_space(3.0);
    }

    fn edit_form(&mut self, ui: &mut egui::Ui, busy: bool) {
        let Some(edit) = self.editing.as_mut() else {
            return;
        };

        ui.add(
            egui::TextEdit::singleline(&mut edit.summary)
                .desired_width(f32::INFINITY)
                .font(egui::TextStyle::Heading),
        );
        ui.add_space(8.0);
        theme::section(ui, "Description");

        if !edit.plain_text_safe {
            // The warning I would want if this were my ticket.
            egui::Frame::default()
                .fill(theme::tint(WARN, 34))
                .inner_margin(8.0)
                .corner_radius(4.0)
                .show(ui, |ui| {
                    ui.label(
                        RichText::new(
                            "This description contains formatting this editor cannot represent \
                             - tables, images, links or styled text. Saving replaces it with \
                             plain text and that formatting is lost. Use \"Open in browser\" \
                             to keep it.",
                        )
                        .color(WARN)
                        .small(),
                    );
                });
            ui.add_space(6.0);
        }

        ui.add(
            egui::TextEdit::multiline(&mut edit.description)
                .desired_width(f32::INFINITY)
                .desired_rows(8),
        );

        let key = edit.key.clone();
        let summary = edit.summary.clone();
        let description = edit.description.clone();
        let had_description = edit.had_description;
        let safe = edit.plain_text_safe;

        ui.add_space(6.0);
        let mut save = false;
        let mut cancel = false;
        ui.horizontal(|ui| {
            let label = if safe { "Save" } else { "Save as plain text" };
            if ui
                .add_enabled(
                    !busy && !summary.trim().is_empty(),
                    egui::Button::new(RichText::new(label).strong()),
                )
                .clicked()
            {
                save = true;
            }
            if ui.button("Cancel").clicked() {
                cancel = true;
            }
            if busy {
                ui.spinner();
            }
        });

        if cancel {
            self.editing = None;
        }
        if save {
            // Sending an empty document where there was none only adds noise.
            let doc = if description.trim().is_empty() && !had_description {
                None
            } else {
                Some(adf::from_plain_text(&description))
            };
            self.busy_key = Some(key.clone());
            self.spawn(Task::UpdateIssue {
                key,
                summary,
                description: doc,
            });
        }
    }

    fn transition_row(&mut self, ui: &mut egui::Ui, issue: &Issue) {
        let busy = self.busy_key.as_deref() == Some(issue.key.as_str());
        let transitions = self.transitions.get(&issue.key).cloned();
        let mut chosen: Option<String> = None;

        ui.horizontal_wrapped(|ui| {
            ui.label(
                RichText::new(&issue.status)
                    .strong()
                    .color(theme::status_color(&issue.status_category)),
            );
            ui.add_space(10.0);

            match transitions {
                None => {
                    ui.spinner();
                    ui.label(RichText::new("loading moves").small().color(MUTED));
                }
                Some(list) if list.is_empty() => {
                    ui.label(RichText::new("no moves available").small().color(MUTED));
                }
                Some(list) => {
                    for transition in list {
                        let label = if transition.to_status.is_empty() {
                            transition.name.clone()
                        } else {
                            format!("\u{2192} {}", transition.to_status)
                        };
                        if ui.add_enabled(!busy, egui::Button::new(label)).clicked() {
                            chosen = Some(transition.id.clone());
                        }
                    }
                }
            }
            if busy {
                ui.spinner();
            }
        });

        if let Some(id) = chosen {
            self.busy_key = Some(issue.key.clone());
            self.status = None;
            self.spawn(Task::Transition {
                key: issue.key.clone(),
                id,
            });
        }
    }

    fn comment_section(&mut self, ui: &mut egui::Ui, key: &str) {
        theme::section(ui, "Comments");

        match self.comments.get(key).cloned() {
            None => {
                ui.horizontal(|ui| {
                    ui.spinner();
                    ui.label(RichText::new("loading").small().color(MUTED));
                });
            }
            Some(list) if list.is_empty() => {
                ui.label(RichText::new("No comments yet.").italics().color(MUTED));
            }
            Some(list) => {
                for comment in list {
                    ui.horizontal(|ui| {
                        ui.label(RichText::new(&comment.author).strong().size(13.0));
                        ui.label(RichText::new(&comment.created).small().color(MUTED));
                    });
                    draw_blocks(ui, &adf::parse(&comment.body));
                    ui.add_space(8.0);
                }
            }
        }

        ui.add_space(8.0);
        let busy = self.busy_key.as_deref() == Some(key);
        ui.add(
            egui::TextEdit::multiline(&mut self.comment_draft)
                .hint_text("Write a comment")
                .desired_width(f32::INFINITY)
                .desired_rows(3),
        );

        let mut send = false;
        ui.horizontal(|ui| {
            let can_send = !busy && !self.comment_draft.trim().is_empty();
            if ui
                .add_enabled(
                    can_send,
                    egui::Button::new(RichText::new("Comment").strong()),
                )
                .clicked()
            {
                send = true;
            }
            if busy {
                ui.spinner();
            }
        });
        ui.add_space(10.0);

        if send {
            self.busy_key = Some(key.to_string());
            self.spawn(Task::AddComment {
                key: key.to_string(),
                text: self.comment_draft.trim().to_string(),
            });
        }
    }

    // ---------- dialogs ----------

    fn assignee_window(&mut self, ctx: &egui::Context) {
        let Some(key) = self.picker.open_for.clone() else {
            return;
        };
        let mut open = true;
        let mut chosen: Option<Option<String>> = None;
        let mut search = false;
        let current_assignee = self.issue_by_key(&key).and_then(|i| i.assignee_id);

        egui::Window::new("assign-issue")
            .title_bar(false)
            .collapsible(false)
            .resizable(false)
            .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
            .show(ctx, |ui| {
                ui.set_width(360.0);
                if theme::dialog_header(ui, &format!("Assign {key}")) {
                    open = false;
                }
                let response = ui.add(
                    egui::TextEdit::singleline(&mut self.picker.query)
                        .hint_text("Search people")
                        .desired_width(f32::INFINITY),
                );
                if response.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter)) {
                    search = true;
                }
                ui.add_space(6.0);

                if ui.button("Unassign").clicked() {
                    chosen = Some(None);
                }
                ui.separator();

                if self.picker.loading {
                    ui.horizontal(|ui| {
                        ui.spinner();
                        ui.label(RichText::new("searching").small().color(MUTED));
                    });
                }

                egui::ScrollArea::vertical()
                    .max_height(260.0)
                    .id_salt("people")
                    .show(ui, |ui| {
                        for user in self.picker.results.clone() {
                            let is_current =
                                current_assignee.as_deref() == Some(user.account_id.as_str());
                            let label = if is_current {
                                RichText::new(format!("{} (current)", user.display_name))
                                    .color(ACCENT)
                            } else {
                                RichText::new(user.display_name.clone())
                            };
                            if ui.add(egui::Button::selectable(is_current, label)).clicked() {
                                chosen = Some(Some(user.account_id.clone()));
                            }
                        }
                        if self.picker.results.is_empty() && !self.picker.loading {
                            ui.label(RichText::new("Nobody found.").small().color(MUTED));
                        }
                    });
            });

        if search {
            self.picker.loading = true;
            let scope = match &self.picker.scope_project {
                Some(project) => UserScope::Project(project.clone()),
                None => UserScope::Issue(key.clone()),
            };
            self.spawn(Task::AssignableUsers {
                scope,
                query: self.picker.query.clone(),
            });
        }

        if let Some(account_id) = chosen {
            self.busy_key = Some(key.clone());
            self.spawn(Task::Assign { key, account_id });
            self.picker.open_for = None;
        } else if !open {
            self.picker.open_for = None;
        }
    }

    fn create_window(&mut self, ctx: &egui::Context) {
        if !self.create.open {
            return;
        }
        let mut open = true;
        let mut submit = false;
        let mut load_types: Option<String> = None;

        // Alphabetical by name, independent of what order the API happened to return.
        let mut projects: Vec<&Project> = self.projects.iter().collect();
        projects.sort_by_key(|p| p.name.to_lowercase());

        egui::Window::new("create-issue")
            .title_bar(false)
            .collapsible(false)
            .resizable(false)
            .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
            .show(ctx, |ui| {
                ui.set_width(460.0);
                if theme::dialog_header(ui, "Create issue") {
                    open = false;
                }

                ui.label(RichText::new("Project").strong());
                let project_label = if self.create.form.project_key.is_empty() {
                    "Choose a project".to_string()
                } else {
                    self.create.form.project_key.clone()
                };
                let needle = self.create.project_filter.trim().to_lowercase();
                let popup = egui::ComboBox::from_id_salt("create-project")
                    .selected_text(project_label)
                    .width(ui.available_width())
                    .height(340.0)
                    .show_ui(ui, |ui| {
                        ui.set_min_width(360.0);
                        let search = ui.add(
                            egui::TextEdit::singleline(&mut self.create.project_filter)
                                .hint_text("Search projects")
                                .desired_width(f32::INFINITY),
                        );
                        if !self.create.project_filter_focused {
                            search.request_focus();
                            self.create.project_filter_focused = true;
                        }
                        ui.add_space(6.0);

                        // Outside this scroll area the search would scroll away with
                        // the list; the fixed height keeps the popup from collapsing.
                        egui::ScrollArea::vertical()
                            .id_salt("project-list")
                            .max_height(260.0)
                            .auto_shrink([false, false])
                            .show(ui, |ui| {
                                let mut any = false;
                                for project in &projects {
                                    if !needle.is_empty()
                                        && !project.name.to_lowercase().contains(&needle)
                                        && !project.key.to_lowercase().contains(&needle)
                                    {
                                        continue;
                                    }
                                    any = true;
                                    let label = format!("{} - {}", project.key, project.name);
                                    if ui
                                        .selectable_label(
                                            self.create.form.project_key == project.key,
                                            label,
                                        )
                                        .clicked()
                                    {
                                        self.create.form.project_key = project.key.clone();
                                        self.create.form.issue_type_id.clear();
                                        self.create.type_label.clear();
                                        load_types = Some(project.key.clone());
                                    }
                                }
                                if !any {
                                    ui.add_space(6.0);
                                    ui.label(
                                        RichText::new(if self.projects.is_empty() {
                                            "No projects visible."
                                        } else {
                                            "No project matches."
                                        })
                                        .color(MUTED),
                                    );
                                }
                            });
                    });
                if popup.inner.is_none() {
                    self.create.project_filter_focused = false;
                    self.create.project_filter.clear();
                }
                ui.add_space(8.0);

                ui.label(RichText::new("Type").strong());
                let types = self
                    .issue_types
                    .get(&self.create.form.project_key)
                    .cloned()
                    .unwrap_or_default();
                let type_label = if self.create.type_label.is_empty() {
                    "Choose a type".to_string()
                } else {
                    self.create.type_label.clone()
                };
                egui::ComboBox::from_id_salt("create-type")
                    .selected_text(type_label)
                    .width(ui.available_width())
                    .show_ui(ui, |ui| {
                        for issue_type in &types {
                            if ui
                                .selectable_label(
                                    self.create.form.issue_type_id == issue_type.id,
                                    &issue_type.name,
                                )
                                .clicked()
                            {
                                self.create.form.issue_type_id = issue_type.id.clone();
                                self.create.type_label = issue_type.name.clone();
                            }
                        }
                        if types.is_empty() {
                            ui.label(RichText::new("pick a project first").color(MUTED));
                        }
                    });
                ui.add_space(8.0);

                ui.label(RichText::new("Summary").strong());
                ui.add(
                    egui::TextEdit::singleline(&mut self.create.form.summary)
                        .desired_width(f32::INFINITY),
                );
                ui.add_space(8.0);

                ui.label(RichText::new("Description").strong());
                ui.add(
                    egui::TextEdit::multiline(&mut self.create.form.description)
                        .desired_width(f32::INFINITY)
                        .desired_rows(5),
                );
                ui.add_space(8.0);

                ui.label(RichText::new("Priority").strong());
                let priority_label = if self.create.priority_label.is_empty() {
                    "Default".to_string()
                } else {
                    self.create.priority_label.clone()
                };
                egui::ComboBox::from_id_salt("create-priority")
                    .selected_text(priority_label)
                    .width(ui.available_width())
                    .show_ui(ui, |ui| {
                        for priority in &self.priorities {
                            if ui
                                .selectable_label(
                                    self.create.form.priority_id.as_deref()
                                        == Some(priority.id.as_str()),
                                    &priority.name,
                                )
                                .clicked()
                            {
                                self.create.form.priority_id = Some(priority.id.clone());
                                self.create.priority_label = priority.name.clone();
                            }
                        }
                    });

                if let Some(message) = &self.create.error {
                    ui.add_space(6.0);
                    ui.label(RichText::new(message).color(DANGER));
                }

                ui.add_space(12.0);
                ui.horizontal(|ui| {
                    let ready = !self.create.form.project_key.is_empty()
                        && !self.create.form.issue_type_id.is_empty()
                        && !self.create.form.summary.trim().is_empty()
                        && !self.create.submitting;
                    if ui
                        .add_enabled(ready, egui::Button::new(RichText::new("Create").strong()))
                        .clicked()
                    {
                        submit = true;
                    }
                    if self.create.submitting {
                        ui.spinner();
                    }
                });
            });

        if let Some(project_key) = load_types {
            self.spawn(Task::IssueTypes(project_key));
        }
        if submit {
            self.create.submitting = true;
            self.create.error = None;
            self.spawn(Task::CreateIssue(self.create.form.clone()));
        }
        if !open {
            self.create.open = false;
        }
    }

    fn settings_window(&mut self, ctx: &egui::Context) {
        let mut open = self.settings_open;
        let configured = self.config.is_complete();
        let mut submit = false;
        let mut sign_out = false;

        egui::Window::new("connect-to-jira")
            .title_bar(false)
            .collapsible(false)
            .resizable(false)
            .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
            .show(ctx, |ui| {
                ui.set_width(420.0);
                if theme::dialog_header(ui, "Connect to Jira") {
                    open = false;
                }
                ui.label(
                    RichText::new(
                        "Stored on this machine only. The token goes to the OS keychain, \
                         never into a file.",
                    )
                    .color(MUTED),
                );
                ui.add_space(10.0);

                ui.label(RichText::new("Jira address").strong());
                ui.add(
                    egui::TextEdit::singleline(&mut self.form.domain)
                        .hint_text("your-company.atlassian.net")
                        .desired_width(f32::INFINITY),
                );
                ui.add_space(8.0);

                ui.label(RichText::new("Atlassian e-mail").strong());
                ui.add(
                    egui::TextEdit::singleline(&mut self.form.email)
                        .hint_text("you@company.com")
                        .desired_width(f32::INFINITY),
                );
                ui.add_space(8.0);

                ui.label(RichText::new("API token").strong());
                ui.add(
                    egui::TextEdit::singleline(&mut self.form.token)
                        .password(true)
                        .hint_text(if configured {
                            "leave blank to keep the stored token"
                        } else {
                            "from id.atlassian.com"
                        })
                        .desired_width(f32::INFINITY),
                );
                ui.hyperlink_to(
                    RichText::new("Create an API token").small().color(ACCENT),
                    "https://id.atlassian.com/manage-profile/security/api-tokens",
                );

                if let Some(message) = &self.form.error {
                    ui.add_space(6.0);
                    ui.label(RichText::new(message).color(DANGER));
                }

                ui.add_space(12.0);
                ui.horizontal(|ui| {
                    if ui.button(RichText::new("Connect").strong()).clicked() {
                        submit = true;
                    }
                    if configured && ui.button("Sign out").clicked() {
                        sign_out = true;
                    }
                });
            });

        if submit {
            self.submit_settings(ctx);
            open = self.settings_open;
        }
        if sign_out {
            if let Some(email) = self.config.email.clone() {
                let _ = credentials::forget_token(&email);
            }
            self.backend = None;
            self.issues.clear();
            self.boards.clear();
            self.selected = None;
            self.account = None;
            self.form.error = Some("Token removed from the keychain.".to_string());
            open = true;
        }

        // A window closed by its X button must not strand an unconfigured app.
        if !open && !self.config.is_complete() {
            open = true;
        }
        self.settings_open = open;
    }

    fn submit_settings(&mut self, ctx: &egui::Context) {
        let Some(domain) = config::normalize_domain(&self.form.domain) else {
            self.form.error = Some("That does not look like a Jira address.".to_string());
            return;
        };
        let email = self.form.email.trim().to_string();
        if !email.contains('@') {
            self.form.error = Some("That does not look like an e-mail address.".to_string());
            return;
        }

        let token = self.form.token.trim().to_string();
        if token.is_empty() {
            if credentials::load_token(&email).is_none() {
                self.form.error = Some("An API token is needed the first time.".to_string());
                return;
            }
        } else if let Err(message) = credentials::store_token(&email, &token) {
            self.form.error = Some(format!("Could not reach the keychain: {message}"));
            return;
        }

        self.config.domain = Some(domain);
        self.config.email = Some(email);
        config::save(&self.config);

        if self.connect(ctx) {
            self.settings_open = false;
            self.form.token.clear();
            self.form.error = None;
        } else {
            self.form.error = Some("Could not build a client with those details.".to_string());
        }
    }
}

impl eframe::App for JiraApp {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        self.apply_events();

        let ctx = ui.ctx().clone();
        if self.settings_open || !self.config.is_complete() {
            self.settings_window(&ctx);
        }
        self.create_window(&ctx);
        self.assignee_window(&ctx);

        self.top_bar(ui);
        self.status_bar(ui);

        match self.tab {
            Tab::Issues | Tab::Backlog => {
                self.issue_list(ui);
                self.detail(ui);
            }
            Tab::Spaces => {
                self.spaces_panel(ui);
                if self.showing_board {
                    // A right panel keeps the board visible while reading a ticket.
                    self.detail_side(ui);
                    egui::CentralPanel::default().show(ui, |ui| self.board_view(ui));
                } else {
                    self.boards_grid(ui);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn board(id: i64, name: &str, project: Option<&str>, key: Option<&str>) -> Board {
        Board {
            id,
            name: name.to_string(),
            project: project.map(str::to_string),
            project_key: key.map(str::to_string),
        }
    }

    #[test]
    fn boards_group_into_spaces_sorted_by_name() {
        let boards = vec![
            board(1, "Sprint board", Some("Zebra"), Some("ZEB")),
            board(2, "Kanban", Some("Apple"), Some("APP")),
            board(3, "Second board", Some("Apple"), Some("APP")),
        ];

        let spaces = group_spaces(&boards);
        assert_eq!(spaces.len(), 2);
        assert_eq!(spaces[0].name, "Apple");
        assert_eq!(spaces[0].boards, 2, "both Apple boards belong to one space");
        assert_eq!(spaces[1].name, "Zebra");
    }

    #[test]
    fn a_board_without_a_project_still_gets_a_home() {
        // Boards built from a filter across projects report no location at all;
        // dropping them would make them unreachable from the panel.
        let boards = vec![
            board(1, "Cross-project", None, None),
            board(2, "Team board", Some("Apple"), Some("APP")),
        ];

        let spaces = group_spaces(&boards);
        assert_eq!(spaces.len(), 2);
        let homeless = spaces.iter().find(|s| s.key == NO_SPACE).expect("group exists");
        assert_eq!(homeless.boards, 1);
        assert_eq!(homeless.name, "Without a space");
    }

    #[test]
    fn no_boards_means_no_spaces() {
        assert!(group_spaces(&[]).is_empty());
    }
}
