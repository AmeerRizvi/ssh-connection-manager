import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export type SSHConnection = {
  id: string;
  name: string;
  sshCommand: string;
};

let globalConnectionsPath: string;

export function initStorage(context: vscode.ExtensionContext) {
  const dir = context.globalStorageUri.fsPath;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  globalConnectionsPath = path.join(dir, "connections.json");
}

export function loadConnections(): SSHConnection[] {
  if (!globalConnectionsPath) throw new Error("Storage not initialized");
  return fs.existsSync(globalConnectionsPath)
    ? JSON.parse(fs.readFileSync(globalConnectionsPath, "utf8"))
    : [];
}

export function saveConnections(connections: SSHConnection[]) {
  if (!globalConnectionsPath) throw new Error("Storage not initialized");
  fs.writeFileSync(globalConnectionsPath, JSON.stringify(connections, null, 2));
}
