import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { initStorage } from "./storage";

type SSHConnection = {
  id: string;
  name: string;
  sshCommand: string;
};

type TreeItem = SSHConnection | ActionItem;

type ActionItem = {
  type: "action";
  action: "rename" | "edit" | "delete";
  parentId: string;
  label: string;
  icon: string;
};

const getConnectionsPath = () => path.join(__dirname, "..", "connections.json");

const loadConnections = (): SSHConnection[] =>
  fs.existsSync(getConnectionsPath())
    ? JSON.parse(fs.readFileSync(getConnectionsPath(), "utf8"))
    : [];

const saveConnections = (data: SSHConnection[]) =>
  fs.writeFileSync(getConnectionsPath(), JSON.stringify(data, null, 2));

export class SSHTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined> =
    new vscode.EventEmitter();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    if ("type" in element && element.type === "action") {
      // Action item (child)
      const item = new vscode.TreeItem(
        element.label,
        vscode.TreeItemCollapsibleState.None
      );
      item.contextValue = `sshAction_${element.action}`;
      item.iconPath = new vscode.ThemeIcon(element.icon);
      const commandMap = {
        rename: "sshManager.rename",
        edit: "sshManager.editCommand",
        delete: "sshManager.delete",
      };
      item.command = {
        command: commandMap[element.action],
        title: element.label,
        arguments: [loadConnections().find((c) => c.id === element.parentId)],
      };
      return item;
    } else {
      // SSH Connection (parent)
      const conn = element as SSHConnection;
      const item = new vscode.TreeItem(
        conn.name,
        vscode.TreeItemCollapsibleState.Collapsed
      );
      item.contextValue = "sshConnection";
      item.tooltip = `${conn.name}\n${conn.sshCommand}`;

      // Extract host from SSH command for cleaner description
      const hostMatch = conn.sshCommand.match(/(?:ssh\s+)?(?:\w+@)?([^\s]+)/);
      const host = hostMatch ? hostMatch[1] : conn.sshCommand;
      item.description = `🔗 ${host}`;

      // Use server icon with color
      item.iconPath = new vscode.ThemeIcon(
        "server",
        new vscode.ThemeColor("terminal.ansiBlue")
      );

      return item;
    }
  }

  getChildren(element?: TreeItem): Thenable<TreeItem[]> {
    if (!element) {
      // Root level - return connections
      return Promise.resolve(loadConnections());
    } else if ("type" in element && element.type === "action") {
      // Action items have no children
      return Promise.resolve([]);
    } else {
      // Connection expanded - return action items
      const conn = element as SSHConnection;
      const actions: ActionItem[] = [
        {
          type: "action",
          action: "rename",
          parentId: conn.id,
          label: "Rename",
          icon: "edit",
        },
        {
          type: "action",
          action: "edit",
          parentId: conn.id,
          label: "Edit Command",
          icon: "gear",
        },
        {
          type: "action",
          action: "delete",
          parentId: conn.id,
          label: "Delete",
          icon: "trash",
        },
      ];
      return Promise.resolve(actions);
    }
  }

  static addConnection() {
    const connections = loadConnections();
    const connectionNumber = connections.length + 1;
    connections.push({
      id: Date.now().toString(),
      name: `Server ${connectionNumber}`,
      sshCommand: "ssh user@hostname -p 22",
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

    vscode.commands.registerCommand("sshManager.add", async () => {
      const name = await vscode.window.showInputBox({
        prompt: "Enter a name for this connection",
        placeHolder: "My Server",
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return "Connection name cannot be empty";
          }
          return null;
        },
      });

      if (!name || !name.trim()) {
        return;
      }

      const sshCommand = await vscode.window.showInputBox({
        prompt: "Enter the SSH command",
        placeHolder: "ssh user@hostname -p 22",
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return "SSH command cannot be empty";
          }
          return null;
        },
      });

      if (sshCommand && sshCommand.trim()) {
        const connections = loadConnections();
        connections.push({
          id: Date.now().toString(),
          name: name.trim(),
          sshCommand: sshCommand.trim(),
        });
        saveConnections(connections);
        tree.refresh();
      }
    }),

    vscode.commands.registerCommand(
      "sshManager.rename",
      async (conn: SSHConnection) => {
        const name = await vscode.window.showInputBox({
          value: conn.name,
          prompt: "Enter a new name for this connection",
          placeHolder: "My Server",
          validateInput: (value) => {
            if (!value || value.trim().length === 0) {
              return "Connection name cannot be empty";
            }
            return null;
          },
        });
        if (name && name.trim()) {
          SSHTreeProvider.renameConnection(conn, name.trim());
          tree.refresh();
        }
      }
    ),

    vscode.commands.registerCommand(
      "sshManager.delete",
      async (conn: SSHConnection) => {
        const result = await vscode.window.showWarningMessage(
          `Are you sure you want to delete "${conn.name}"?`,
          { modal: true },
          "Delete"
        );
        if (result === "Delete") {
          SSHTreeProvider.deleteConnection(conn);
          tree.refresh();
        }
      }
    )
  );

  vscode.commands.registerCommand(
    "sshManager.editCommand",
    async (conn: SSHConnection) => {
      const input = await vscode.window.showInputBox({
        value: conn.sshCommand,
        prompt: `Edit SSH command for "${conn.name}"`,
        placeHolder: "ssh user@hostname -p 22 -i ~/.ssh/key.pem",
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return "SSH command cannot be empty";
          }
          return null;
        },
      });
      if (input && input.trim()) {
        const connections = loadConnections();
        const index = connections.findIndex((c) => c.id === conn.id);
        if (index !== -1) {
          connections[index].sshCommand = input.trim();
          saveConnections(connections);
          tree.refresh();
        }
      }
    }
  );
}

export function deactivate() {}
