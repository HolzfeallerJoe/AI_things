import { app, BrowserWindow, Menu, MenuItemConstructorOptions, shell, WebContents } from 'electron';

interface MenuDeps {
  getMainWindow: () => BrowserWindow | null;
  openSetupWindow: () => void;
  homeUrl: () => string;
}

/**
 * Electron moved history control onto webContents.navigationHistory and left the old
 * methods behind, so both spellings are tried rather than pinning to one Electron line.
 */
type LegacyNav = WebContents & {
  canGoBack?: () => boolean;
  goBack?: () => void;
  canGoForward?: () => boolean;
  goForward?: () => void;
};

function goBack(contents: WebContents): void {
  const history = contents.navigationHistory;
  if (history?.canGoBack()) {
    history.goBack();
    return;
  }
  const legacy = contents as LegacyNav;
  if (legacy.canGoBack?.()) legacy.goBack?.();
}

function goForward(contents: WebContents): void {
  const history = contents.navigationHistory;
  if (history?.canGoForward()) {
    history.goForward();
    return;
  }
  const legacy = contents as LegacyNav;
  if (legacy.canGoForward?.()) legacy.goForward?.();
}

export function buildMenu({ getMainWindow, openSetupWindow, homeUrl }: MenuDeps): void {
  const withWindow = (action: (window: BrowserWindow) => void) => () => {
    const window = getMainWindow();
    if (window && !window.isDestroyed()) action(window);
  };

  const template: MenuItemConstructorOptions[] = [
    {
      label: '&Jira',
      submenu: [
        {
          label: 'Home',
          accelerator: 'CmdOrCtrl+Shift+H',
          click: withWindow((window) => void window.loadURL(homeUrl())),
        },
        {
          label: 'Back',
          accelerator: 'Alt+Left',
          click: withWindow((window) => goBack(window.webContents)),
        },
        {
          label: 'Forward',
          accelerator: 'Alt+Right',
          click: withWindow((window) => goForward(window.webContents)),
        },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: withWindow((window) => window.webContents.reload()),
        },
        { type: 'separator' },
        {
          // The escape hatch for anything this window is a poor fit for.
          label: 'Open current page in browser',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: withWindow((window) => void shell.openExternal(window.webContents.getURL())),
        },
        { type: 'separator' },
        { label: 'Settings...', accelerator: 'CmdOrCtrl+,', click: () => openSetupWindow() },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: '&Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'selectAll' },
      ],
    },
    {
      label: '&View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { label: 'Developer tools', accelerator: 'F12', role: 'toggleDevTools' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
