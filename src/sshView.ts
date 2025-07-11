import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

type SSHConnection = {
  id: string;
  name: string;
  user: string;
  host: string;
  port: number;
  identityFile: string;
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

  getTreeItem(connection: SSHConnection): vscode.TreeItem {
    const item = new vscode.TreeItem(
      connection.name,
      vscode.TreeItemCollapsibleState.None
    );
    item.contextValue = "sshConnection";
    item.tooltip = `${connection.user}@${connection.host}`;
    item.command = {
      command: "sshManager.open",
      title: "Connect",
      arguments: [connection],
    };
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
      user: "ubuntu",
      host: "1.2.3.4",
      port: 22,
      identityFile: "~/.ssh/key.pem",
    });
    saveConnections(connections);
  }

  static renameConnection(old: SSHConnection, newName: string) {
    const connections = loadConnections();
    const index = connections.findIndex((c) => c.id === old.id);
    if (index !== -1) {
      connections[index].name = newName;
      saveConnections(connections);
    }
  }

  static deleteConnection(toDelete: SSHConnection) {
    const updated = loadConnections().filter((c) => c.id !== toDelete.id);
    saveConnections(updated);
  }
}
