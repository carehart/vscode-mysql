import * as path from "path";
import * as vscode from "vscode";
import { CacheKey } from "../common/constants";
import { ConnectionManager } from "../service/connectionManager";
import { DatabaseCache } from "../service/common/databaseCache";
import { ConnectionNode } from "../model/database/connectionNode";
import { DatabaseNode } from "../model/database/databaseNode";
import { Node } from "../model/interface/node";

export class DbTreeDataProvider implements vscode.TreeDataProvider<Node> {

    public _onDidChangeTreeData: vscode.EventEmitter<Node> = new vscode.EventEmitter<Node>();
    public readonly onDidChangeTreeData: vscode.Event<Node> = this._onDidChangeTreeData.event;
    private static instance: DbTreeDataProvider

    constructor(private context: vscode.ExtensionContext) {
        DbTreeDataProvider.instance = this
        this.init()
    }

    /**
     * reload treeview context
     */
    public async init() {
        (await this.getConnectionNodes()).forEach(async (connectionNode) => {
            (await connectionNode.getChildren(true)).forEach(async (databaseNode) => {
                (await databaseNode.getChildren(true)).forEach(async (groupNode) => {
                    groupNode.getChildren(true);
                });
            });
        })
        DatabaseCache.clearColumnCache()
        DbTreeDataProvider.refresh()
    }

    public getTreeItem(element: Node): Promise<vscode.TreeItem> | vscode.TreeItem {
        return element;
    }

    public getChildren(element?: Node): Thenable<Node[]> | Node[] {
        if (!element) {
            return this.getConnectionNodes();
        }

        return element.getChildren();
    }

    public async addConnection(connectionNode: Node) {

        let connections = this.context.globalState.get<{ [key: string]: Node }>(CacheKey.ConectionsKey);

        if (!connections) {
            connections = {};
        }

        const connectId = connectionNode.getConnectId();
        connections[connectId] = connectionNode;
        ConnectionManager.removeConnection(connectId)


        await this.context.globalState.update(CacheKey.ConectionsKey, connections);
        DbTreeDataProvider.refresh();
    }

    /**
     * refresh treeview context
     */
    public static refresh(element?: Node): void {
        this.instance._onDidChangeTreeData.fire(element);
    }

    public static getInstnace() {
        return this.instance;
    }

    public async getConnectionNodes(): Promise<ConnectionNode[]> {
        const connectionNodes = [];
        const connections = this.context.globalState.get<{ [key: string]: Node }>(CacheKey.ConectionsKey);
        if (connections) {
            for (const key of Object.keys(connections)) {
                connectionNodes.push(new ConnectionNode(key, connections[key]));
            }
        }
        return connectionNodes;
    }

    public async activeDb() {

        const dbIdList: string[] = [];
        const dbIdMap = new Map<string, DatabaseNode>();
        for (const dbNode of DatabaseCache.getDatabaseNodeList()) {
            dbIdList.push(dbNode.id)
            dbIdMap.set(dbNode.id, dbNode)
        }
        if (dbIdList) {
            vscode.window.showQuickPick(dbIdList).then(async (dbId) => {
                if (dbId) {
                    const dbNode = dbIdMap.get(dbId);
                    await ConnectionManager.getConnection(dbNode, true)
                    vscode.window.showInformationMessage(`Change active database to ${dbNode.database} success!`)
                }

            })
        }

    }

}