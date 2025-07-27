import * as vscode from 'vscode';
import * as path from 'path';
import { Config } from './config';
import { GitChecker } from './gitChecker';
import { GitCheckerVSCode } from './gitCheckerVSCode';

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    private activeFiles: Set<string> = new Set();
    private config: Config;
    private temporarilyEditableFiles: Set<string>;
    private gitChecker: GitChecker | GitCheckerVSCode;
    private isNonGitMode = false;
    private isGitignoreOnlyMode = false;

    constructor(
        config: Config,
        temporarilyEditableFiles: Set<string>,
        gitChecker: GitChecker | GitCheckerVSCode
    ) {
        this.config = config;
        this.temporarilyEditableFiles = temporarilyEditableFiles;
        this.gitChecker = gitChecker;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.setupStatusBarItem();
        this.checkNonGitMode();
    }

    private setupStatusBarItem(): void {
        this.statusBarItem.command = 'gitignoreGuard.showIgnoredFileInfo';
        this.statusBarItem.tooltip =
            'This file is ignored by .gitignore. Click for more information.';
    }

    showForFile(filePath: string): void {
        if (!this.config.getShowStatusBar()) {
            return;
        }

        this.activeFiles.add(filePath);
        this.updateStatusBar();
    }

    hideForFile(filePath: string): void {
        this.activeFiles.delete(filePath);
        this.updateStatusBar();
    }

    updateStatusBar(): void {
        const activeEditor = vscode.window.activeTextEditor;

        if (!activeEditor) {
            this.statusBarItem.hide();
            return;
        }

        const currentFile = activeEditor.document.uri.fsPath;

        if (this.activeFiles.has(currentFile)) {
            const warningInfo = this.config.getWarningLevelForFile(currentFile);
            const fileCount = this.activeFiles.size;

            const isReadOnly = this.config.getOpenAsReadOnly();
            const hasTemporaryAccess = this.temporarilyEditableFiles.has(currentFile);

            let statusText = '';
            if (isReadOnly) {
                const whitelist = this.config.getReadOnlyWhitelist();
                const relativePath = vscode.workspace.asRelativePath(currentFile);
                const fileName = path.basename(currentFile);

                const isWhitelisted = whitelist.some((pattern) => {
                    const languages = vscode.languages.match({ pattern }, activeEditor.document);
                    if (languages > 0) {
                        return true;
                    }

                    if (pattern.includes('*')) {
                        const regex = new RegExp(
                            '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
                        );
                        return regex.test(relativePath) || regex.test(fileName);
                    }

                    return relativePath === pattern || fileName === pattern;
                });

                if (hasTemporaryAccess) {
                    statusText = ' (temporary write access)';
                } else if (!isWhitelisted) {
                    statusText = ' (read-only)';
                }
            }

            switch (warningInfo.level) {
                case 'critical':
                    this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                        'statusBarItem.errorBackground'
                    );
                    this.statusBarItem.color = new vscode.ThemeColor(
                        'statusBarItem.errorForeground'
                    );
                    break;
                case 'low':
                    this.statusBarItem.backgroundColor = undefined;
                    this.statusBarItem.color = undefined;
                    break;
                case 'moderate':
                default:
                    this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                        'statusBarItem.warningBackground'
                    );
                    this.statusBarItem.color = new vscode.ThemeColor(
                        'statusBarItem.warningForeground'
                    );
                    break;
            }

            const modeIndicator = this.isGitignoreOnlyMode || this.isNonGitMode ? ' 📄' : '';
            this.statusBarItem.text = `${warningInfo.config.statusBarMessage}${statusText}${modeIndicator}`;

            if (fileCount > 1) {
                const modeText =
                    this.isGitignoreOnlyMode || this.isNonGitMode
                        ? ' (using .gitignore directly)'
                        : '';
                this.statusBarItem.tooltip = `${fileCount} ignored files are open${statusText}${modeText}. Click for more information.`;
            } else {
                const modeText =
                    this.isGitignoreOnlyMode || this.isNonGitMode
                        ? ' (using .gitignore directly)'
                        : '';
                this.statusBarItem.tooltip = `This file is ignored by .gitignore${statusText}${modeText}. Click for more information.`;
            }

            this.statusBarItem.show();
        } else {
            this.statusBarItem.hide();
        }
    }

    updateConfiguration(config: Config): void {
        this.config = config;
        this.checkNonGitMode();
        this.updateStatusBar();
    }

    showTemporaryDisableCountdown(minutes: number, seconds: number): void {
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.color = undefined;
        this.statusBarItem.text = `⏸️ Gitignore Guard re-enabling in ${minutes}:${seconds.toString().padStart(2, '0')}`;
        this.statusBarItem.tooltip = 'Extension is temporarily disabled';
        this.statusBarItem.show();
    }

    setGitignoreOnlyMode(enabled: boolean): void {
        this.isGitignoreOnlyMode = enabled;
        this.updateStatusBar();
    }

    private async checkNonGitMode(): Promise<void> {
        if (this.config.getEnableWithoutGit()) {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                const isGitRepo = await this.gitChecker.isGitRepository(
                    workspaceFolders[0].uri.fsPath
                );
                this.isNonGitMode = !isGitRepo;
            }
        } else {
            this.isNonGitMode = false;
        }
    }

    dispose(): void {
        this.statusBarItem.dispose();
        this.activeFiles.clear();
    }
}
