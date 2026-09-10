//! Network calls run off the UI thread. egui redraws on the main thread, so a blocking
//! request there would freeze the window; each task gets its own thread and reports back
//! through a channel, waking the UI with `request_repaint`.

use std::sync::mpsc::{Receiver, Sender};
use std::sync::{mpsc, Arc};
use std::thread;

use serde_json::Value;

use crate::jira::{
    Board, BoardColumn, Comment, CurrentUser, Issue, IssueDetail, IssueType, JiraClient, NewIssue,
    Priority, Project, Transition, User, UserScope,
};

pub enum Task {
    Whoami,
    Search(String),
    Transitions(String),
    Transition {
        key: String,
        id: String,
    },
    /// Board drag-and-drop: move to whichever status the target column holds.
    MoveToColumn {
        key: String,
        status_ids: Vec<String>,
    },
    Detail(String),
    Comments(String),
    AddComment {
        key: String,
        text: String,
    },
    UpdateIssue {
        key: String,
        summary: String,
        description: Option<Value>,
    },
    Assign {
        key: String,
        account_id: Option<String>,
    },
    CreateIssue(NewIssue),
    Boards,
    BoardColumns(i64),
    BoardIssues(i64),
    Backlog(i64),
    Projects,
    IssueTypes(String),
    Priorities,
    AssignableUsers {
        scope: UserScope,
        query: String,
    },
}

pub enum Event {
    Whoami(Result<CurrentUser, String>),
    Issues(Result<Vec<Issue>, String>),
    Transitions {
        key: String,
        result: Result<Vec<Transition>, String>,
    },
    Transitioned {
        key: String,
        result: Result<(), String>,
    },
    Detail {
        key: String,
        result: Result<IssueDetail, String>,
    },
    Comments {
        key: String,
        result: Result<Vec<Comment>, String>,
    },
    CommentAdded {
        key: String,
        result: Result<(), String>,
    },
    IssueUpdated {
        key: String,
        result: Result<(), String>,
    },
    Assigned {
        key: String,
        result: Result<(), String>,
    },
    IssueCreated(Result<String, String>),
    Boards(Result<Vec<Board>, String>),
    BoardColumns {
        board_id: i64,
        result: Result<Vec<BoardColumn>, String>,
    },
    BoardIssues {
        board_id: i64,
        result: Result<Vec<Issue>, String>,
    },
    Backlog {
        board_id: i64,
        result: Result<Vec<Issue>, String>,
    },
    Projects(Result<Vec<Project>, String>),
    IssueTypes {
        project_key: String,
        result: Result<Vec<IssueType>, String>,
    },
    Priorities(Result<Vec<Priority>, String>),
    AssignableUsers(Result<Vec<User>, String>),
}

pub struct Backend {
    client: Arc<JiraClient>,
    sender: Sender<Event>,
    receiver: Receiver<Event>,
    ctx: egui::Context,
}

impl Backend {
    pub fn new(client: JiraClient, ctx: egui::Context) -> Self {
        let (sender, receiver) = mpsc::channel();
        Self {
            client: Arc::new(client),
            sender,
            receiver,
            ctx,
        }
    }

    pub fn client(&self) -> &JiraClient {
        &self.client
    }

    pub fn spawn(&self, task: Task) {
        let client = Arc::clone(&self.client);
        let sender = self.sender.clone();
        let ctx = self.ctx.clone();

        thread::spawn(move || {
            let event = run(&client, task);
            // A closed receiver just means the app is shutting down.
            let _ = sender.send(event);
            ctx.request_repaint();
        });
    }

    pub fn drain(&self) -> Vec<Event> {
        self.receiver.try_iter().collect()
    }
}

fn run(client: &JiraClient, task: Task) -> Event {
    match task {
        Task::Whoami => Event::Whoami(client.current_user()),
        Task::Search(jql) => Event::Issues(client.search(&jql, 100)),

        Task::Transitions(key) => Event::Transitions {
            result: client.transitions(&key),
            key,
        },
        Task::Transition { key, id } => Event::Transitioned {
            result: client.transition(&key, &id),
            key,
        },
        Task::MoveToColumn { key, status_ids } => Event::Transitioned {
            result: client.transition_to_status(&key, &status_ids),
            key,
        },

        Task::Detail(key) => Event::Detail {
            result: client.issue_detail(&key),
            key,
        },
        Task::Comments(key) => Event::Comments {
            result: client.comments(&key),
            key,
        },
        Task::AddComment { key, text } => Event::CommentAdded {
            result: client.add_comment(&key, &text),
            key,
        },

        Task::UpdateIssue {
            key,
            summary,
            description,
        } => Event::IssueUpdated {
            result: client.update_issue(&key, &summary, description),
            key,
        },
        Task::Assign { key, account_id } => Event::Assigned {
            result: client.assign(&key, account_id.as_deref()),
            key,
        },
        Task::CreateIssue(new_issue) => Event::IssueCreated(client.create_issue(&new_issue)),

        Task::Boards => Event::Boards(client.boards()),
        Task::BoardColumns(board_id) => Event::BoardColumns {
            board_id,
            result: client.board_columns(board_id),
        },
        Task::BoardIssues(board_id) => Event::BoardIssues {
            board_id,
            result: client.board_issues(board_id),
        },
        Task::Backlog(board_id) => Event::Backlog {
            board_id,
            result: client.board_backlog(board_id),
        },

        Task::Projects => Event::Projects(client.projects()),
        Task::IssueTypes(project_key) => Event::IssueTypes {
            result: client.issue_types(&project_key),
            project_key,
        },
        Task::Priorities => Event::Priorities(client.priorities()),
        Task::AssignableUsers { scope, query } => {
            Event::AssignableUsers(client.assignable_users(&scope, &query))
        }
    }
}
