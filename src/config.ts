import * as vscode from 'vscode';

export interface WarningLevel {
    codeLensMessage: string;
    statusBarMessage: string;
}

export interface WarningLevels {
    critical: WarningLevel;
    moderate: WarningLevel;
    low: WarningLevel;
}

export type WarningLevelType = 'critical' | 'moderate' | 'low';

export class Config {
    private configuration: vscode.WorkspaceConfiguration;
    private context?: vscode.ExtensionContext;

    constructor(context?: vscode.ExtensionContext) {
        this.configuration = vscode.workspace.getConfiguration('gitignoreGuard');
        this.context = context;
    }

    reload(): void {
        this.configuration = vscode.workspace.getConfiguration('gitignoreGuard');
    }

    isEnabled(): boolean {
        return this.configuration.get<boolean>('enabled', true);
    }

    getShowStatusBar(): boolean {
        return this.configuration.get<boolean>('showStatusBar', true);
    }

    getShowCodeLens(): boolean {
        return this.configuration.get<boolean>('showCodeLens', true);
    }

    getOpenAsReadOnly(): boolean {
        return this.configuration.get<boolean>('openAsReadOnly', false);
    }

    getReadOnlyWhitelist(): string[] {
        return this.configuration.get<string[]>('readOnlyWhitelist', []);
    }

    getWarningLevels(): WarningLevels {
        return this.configuration.get<WarningLevels>('warningLevels', {
            critical: {
                codeLensMessage: '⚠️ This file is ignored by .gitignore ⚠️',
                statusBarMessage: '⚠️ Ignored file'
            },
            moderate: {
                codeLensMessage: '⚠️ This file is ignored by .gitignore ⚠️',
                statusBarMessage: '⚠️ Ignored file'
            },
            low: {
                codeLensMessage: 'ℹ️ This file is ignored by .gitignore',
                statusBarMessage: 'ℹ️ Ignored file'
            }
        });
    }

    getCriticalFilePatterns(): string[] {
        return this.configuration.get<string[]>('criticalFilePatterns', [
            '.env',
            '*.key',
            '*.pem',
            '**/secrets/*',
            '**/.env.*'
        ]);
    }

    getLowPriorityFilePatterns(): string[] {
        return this.configuration.get<string[]>('lowPriorityFilePatterns', [
            'dist/*',
            'build/*',
            'out/*',
            'node_modules/*',
            '*.min.js',
            '*.min.css'
        ]);
    }

    getWarningLevelForFile(filePath: string): { level: WarningLevelType; config: WarningLevel } {
        const warningLevels = this.getWarningLevels();
        const relativePath = vscode.workspace.asRelativePath(filePath);
        const fileName = filePath.split('/').pop() || '';

        const matchesPatterns = (patterns: string[]): boolean => {
            return patterns.some((pattern) => {
                if (pattern.includes('*')) {
                    const regex = new RegExp(
                        '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
                    );
                    return regex.test(relativePath) || regex.test(fileName);
                }
                return relativePath === pattern || fileName === pattern;
            });
        };

        if (matchesPatterns(this.getCriticalFilePatterns())) {
            return { level: 'critical', config: warningLevels.critical };
        }

        if (matchesPatterns(this.getLowPriorityFilePatterns())) {
            return { level: 'low', config: warningLevels.low };
        }

        return { level: 'moderate', config: warningLevels.moderate };
    }

    getEnableWithoutGit(): boolean {
        if (!this.context) {
            return false;
        }
        return this.context.workspaceState.get<boolean>('enableWithoutGit', false);
    }

    hasShownNoGitMessage(): boolean {
        if (!this.context) {
            return false;
        }
        return this.context.workspaceState.get<boolean>('hasShownNoGitMessage', false);
    }

    setHasShownNoGitMessage(value: boolean): void {
        if (this.context) {
            this.context.workspaceState.update('hasShownNoGitMessage', value);
        }
    }

    setEnableWithoutGit(value: boolean): void {
        if (this.context) {
            this.context.workspaceState.update('enableWithoutGit', value);
        }
    }
}
