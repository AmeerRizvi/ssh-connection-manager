import * as vscode from 'vscode';
import { loadConnections, saveConnections, SSHConnection } from './storage';

export class SSHWebviewPanel {
  public static currentPanel: SSHWebviewPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (SSHWebviewPanel.currentPanel) {
      SSHWebviewPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'sshManager',
      'SSH Connections',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
      }
    );

    SSHWebviewPanel.currentPanel = new SSHWebviewPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._update();
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  private _update() {
    const webview = this._panel.webview;
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const connections = loadConnections();
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SSH Connections</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .connection-card {
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: all 0.2s ease;
        }
        .connection-card:hover {
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
        .connection-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .connection-name {
            font-weight: bold;
            font-size: 16px;
        }
        .connection-host {
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
        }
        .connect-btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 6px;
            padding: 8px 16px;
            cursor: pointer;
            font-weight: bold;
        }
        .connect-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .actions {
            display: flex;
            gap: 8px;
            margin-top: 12px;
        }
        .action-btn {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 4px;
            padding: 6px 12px;
            cursor: pointer;
            font-size: 12px;
        }
        .action-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
    </style>
</head>
<body>
    <h2>SSH Connections</h2>
    ${connections.map(conn => `
        <div class="connection-card">
            <div class="connection-header">
                <div>
                    <div class="connection-name">🖥️ ${conn.name}</div>
                    <div class="connection-host">${this._extractHost(conn.sshCommand)}</div>
                </div>
                <button class="connect-btn" onclick="connect('${conn.id}')">
                    → Connect
                </button>
            </div>
            <div class="actions">
                <button class="action-btn" onclick="rename('${conn.id}')">✏️ Rename</button>
                <button class="action-btn" onclick="edit('${conn.id}')">⚙️ Edit</button>
                <button class="action-btn" onclick="deleteConn('${conn.id}')">🗑️ Delete</button>
            </div>
        </div>
    `).join('')}
    
    <script>
        const vscode = acquireVsCodeApi();
        
        function connect(id) {
            vscode.postMessage({ command: 'connect', id: id });
        }
        
        function rename(id) {
            vscode.postMessage({ command: 'rename', id: id });
        }
        
        function edit(id) {
            vscode.postMessage({ command: 'edit', id: id });
        }
        
        function deleteConn(id) {
            vscode.postMessage({ command: 'delete', id: id });
        }
    </script>
</body>
</html>`;
  }

  private _extractHost(sshCommand: string): string {
    const hostMatch = sshCommand.match(/(?:ssh\s+)?(?:\w+@)?([^\s]+)/);
    return hostMatch ? hostMatch[1] : sshCommand;
  }

  public dispose() {
    SSHWebviewPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
