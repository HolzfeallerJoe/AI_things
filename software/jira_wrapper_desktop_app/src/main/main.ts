import { app, BrowserWindow, ipcMain, session, shell } from 'electron';
import path from 'node:path';
import { AppConfig, loadConfig, normalizeDomain, saveConfig } from './config';
import { isIdentityProvider, isInternal, isJiraHost } from './links';
import { buildMenu } from './menu';

// Pinned before anything reads app.getPath('userData'). Electron derives that directory
// from the app name, which otherwise differs between `electron .` and an installed build -
// and a change here silently orphans the saved domain and the logged-in session, so this
// string must stay exactly as it is.
app.setName('jira-desktop');

let config: AppConfig = { domain: null, window: { width: 1440, height: 900 } };
let mainWindow: BrowserWindow | null = null;
let setupWindow: BrowserWindow | null = null;

const PRELOAD = path.join(__dirname, '..', 'preload', 'preload.js');
const SETUP_PAGE = () => path.join(app.getAppPath(), 'src', 'renderer', 'setup.html');

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function homeUrl(): string {
  return config.domain ? `https://${config.domain}/` : 'about:blank';
}

/**
 * Atlassian and several identity providers refuse to sign you in from a browser they
 * do not recognise, and an untouched Electron user agent announces itself loudly.
 * Presenting the underlying Chrome string keeps those login flows working.
 */
function anonymizeUserAgent(): void {
  const ua = session.defaultSession
    .getUserAgent()
    .replace(/ Electron\/[0-9.]+/i, '')
    .replace(new RegExp(' ' + app.getName() + '/[0-9.]+', 'i'), '');
  session.defaultSession.setUserAgent(ua);
}

/** Keeps Jira and login pages in the window; sends everything else to the real browser. */
function routeLinks(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    // SSO frequently needs a genuine popup window, so allow those to open.
    if (isIdentityProvider(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 600,
          height: 760,
          autoHideMenuBar: true,
          webPreferences: { partition: 'persist:jira' },
        },
      };
    }
    if (isJiraHost(url, config.domain)) {
      window.loadURL(url);
      return { action: 'deny' };
    }
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (isInternal(url, config.domain)) return;
    event.preventDefault();
    void shell.openExternal(url);
  });
}

function rememberWindowState(window: BrowserWindow): void {
  const persist = () => {
    if (window.isDestroyed()) return;
    const maximized = window.isMaximized();
    config.window = maximized
      ? { ...config.window, maximized: true }
      : { ...window.getBounds(), maximized: false };
    saveConfig(config);
  };
  window.on('close', persist);
}

function createMainWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return;
  }

  const { width, height, x, y, maximized } = config.window;
  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: 900,
    minHeight: 600,
    title: 'Jira',
    autoHideMenuBar: true,
    backgroundColor: '#1f1f21',
    show: false,
    webPreferences: {
      partition: 'persist:jira',
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });

  if (maximized) mainWindow.maximize();
  routeLinks(mainWindow);
  rememberWindowState(mainWindow);

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  void mainWindow.loadURL(homeUrl());
}

export function openSetupWindow(): void {
  if (setupWindow && !setupWindow.isDestroyed()) {
    setupWindow.focus();
    return;
  }

  setupWindow = new BrowserWindow({
    width: 560,
    height: 420,
    resizable: false,
    title: 'Jira Desktop setup',
    autoHideMenuBar: true,
    backgroundColor: '#1f1f21',
    parent: mainWindow ?? undefined,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  setupWindow.on('closed', () => {
    setupWindow = null;
    // Nothing configured and no window left to look at means there is no app to use.
    if (!config.domain && !mainWindow) app.quit();
  });

  void setupWindow.loadFile(SETUP_PAGE());
}

function registerIpc(): void {
  ipcMain.handle('setup:current', () => config.domain);

  ipcMain.handle('setup:save', (_event, rawDomain: string) => {
    const domain = normalizeDomain(rawDomain);
    if (!domain) {
      return { ok: false, error: 'That does not look like a Jira address.' };
    }

    const changed = domain !== config.domain;
    config = { ...config, domain };
    saveConfig(config);

    setupWindow?.close();
    if (!mainWindow) {
      createMainWindow();
    } else if (changed) {
      void mainWindow.loadURL(homeUrl());
      mainWindow.focus();
    }
    return { ok: true };
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const window = mainWindow ?? setupWindow;
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });

  app.whenReady().then(() => {
    config = loadConfig();
    anonymizeUserAgent();
    registerIpc();
    buildMenu({ getMainWindow, openSetupWindow, homeUrl });

    if (config.domain) {
      createMainWindow();
    } else {
      openSetupWindow();
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        config.domain ? createMainWindow() : openSetupWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
