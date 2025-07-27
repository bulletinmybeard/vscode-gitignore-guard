import * as vscode from 'vscode';
import { GitChecker } from './gitChecker';
import { GitCheckerVSCode } from './gitCheckerVSCode';
import { Config } from './config';

export class GitignoreCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor(
        private gitChecker: GitChecker | GitCheckerVSCode,
        private config: Config
    ) {}

    async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        if (!this.config.getShowCodeLens()) {
            return [];
        }

        if (document.uri.scheme !== 'file') {
            return [];
        }

        const isIgnored = await this.gitChecker.isFileIgnored(document.uri.fsPath);
        if (!isIgnored) {
            return [];
        }

        const topOfDocument = new vscode.Range(0, 0, 0, 0);

        const warningInfo = this.config.getWarningLevelForFile(document.fileName);

        const commandArgs = {
            title: warningInfo.config.codeLensMessage,
            command: 'gitignoreGuard.showIgnoredFileInfo',
            arguments: []
        };

        const codeLens = new vscode.CodeLens(topOfDocument, commandArgs);
        return [codeLens];
    }

    refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }

    updateConfiguration(config: Config): void {
        this.config = config;
        this.refresh();
    }
}
