import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { initStorage } from "./storage";

type SSHConnection = {
  id: string;
  name: string;
  sshCommand: string;
};

const getConnectionsPath = () => path.join(__dirname, "..", "connections.json");

const loadConnections = (): SSHConnection[] =>
  fs.existsSync(getConnectionsPath())
    ? JSON.parse(fs.readFileSync(getConnectionsPath(), "utf8"))
    : [];

const saveConnections = (data: SSHConnection[]) =>
  fs.writeFileSync(getConnectionsPath(), JSON.stringify(data, null, 2));

export class SSHTreeProvider implements vscode.TreeDataProvider<SSHConnection> {
  private _onDidChangeTreeData: vscode.EventEmitter<SSHConnection | undefined> =
    new vscode.EventEmitter();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(conn: SSHConnection): vscode.TreeItem {
    const item = new vscode.TreeItem(
      conn.name,
      vscode.TreeItemCollapsibleState.None
    );
    item.contextValue = "sshConnection";
    item.tooltip = conn.sshCommand;
    item.command = {
      command: "sshManager.open",
      title: "Connect",
      arguments: [conn],
    };
    item.description = conn.sshCommand;
    return item;
  }

  getChildren(): Thenable<SSHConnection[]> {
    return Promise.resolve(loadConnections());
  }

  static addConnection() {
    const connections = loadConnections();
    connections.push({
      id: Date.now().toString(),
      name: "New Server",
      sshCommand: "ssh user@host -p 22 -i ~/.ssh/key.pem",
    });
    saveConnections(connections);
  }

  static renameConnection(conn: SSHConnection, newName: string) {
    const connections = loadConnections();
    const index = connections.findIndex((c) => c.id === conn.id);
    if (index !== -1) {
      connections[index].name = newName;
      saveConnections(connections);
    }
  }

  static deleteConnection(conn: SSHConnection) {
    const updated = loadConnections().filter((c) => c.id !== conn.id);
    saveConnections(updated);
  }
}

export function activate(context: vscode.ExtensionContext) {
  initStorage(context);

  const tree = new SSHTreeProvider();
  vscode.window.createTreeView("sshView", { treeDataProvider: tree });

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "sshManager.open",
      (conn: SSHConnection) => {
        const terminal = vscode.window.createTerminal(conn.name);
        terminal.show();
        terminal.sendText(conn.sshCommand);
      }
    ),

    vscode.commands.registerCommand("sshManager.add", () => {
      SSHTreeProvider.addConnection();
      tree.refresh();
    }),

    vscode.commands.registerCommand(
      "sshManager.rename",
      async (conn: SSHConnection) => {
        const name = await vscode.window.showInputBox({
          value: conn.name,
          prompt: "Rename server",
        });
        if (name) {
          SSHTreeProvider.renameConnection(conn, name);
          tree.refresh();
        }
      }
    ),

    vscode.commands.registerCommand(
      "sshManager.delete",
      (conn: SSHConnection) => {
        SSHTreeProvider.deleteConnection(conn);
        tree.refresh();
      }
    )
  );

  vscode.commands.registerCommand(
    "sshManager.editCommand",
    async (conn: SSHConnection) => {
      const input = await vscode.window.showInputBox({
        value: conn.sshCommand,
        prompt: `Edit SSH Command for ${conn.name}`,
      });
      if (input) {
        const connections = loadConnections();
        const index = connections.findIndex((c) => c.id === conn.id);
        if (index !== -1) {
          connections[index].sshCommand = input;
          saveConnections(connections);
          tree.refresh();
        }
      }
    }
  );
}

export function deactivate() {}
