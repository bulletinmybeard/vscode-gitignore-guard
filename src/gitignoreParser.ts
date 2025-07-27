import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import ignore, { Ignore } from 'ignore';

export class GitignoreParser {
    private ignoreInstances: Map<string, Ignore> = new Map();
    private gitignorePaths: Map<string, string[]> = new Map();

    async isFileIgnored(filePath: string): Promise<boolean> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
        if (!workspaceFolder) {
            return false;
        }

        const workspacePath = workspaceFolder.uri.fsPath;
        const relativePath = path.relative(workspacePath, filePath);

        const ig = await this.getIgnoreInstance(workspacePath);
        const isIgnored = ig.ignores(relativePath);

        return isIgnored;
    }

    async getIgnorePattern(filePath: string): Promise<string | null> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
        if (!workspaceFolder) {
            return null;
        }

        const workspacePath = workspaceFolder.uri.fsPath;
        const relativePath = path.relative(workspacePath, filePath);

        const gitignoreFiles = this.gitignorePaths.get(workspacePath) || [];
        for (const gitignorePath of gitignoreFiles) {
            try {
                const content = await fs.promises.readFile(gitignorePath, 'utf8');
                const lines = content.split('\n');

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine && !trimmedLine.startsWith('#')) {
                        const testIg = ignore().add(trimmedLine);
                        if (testIg.ignores(relativePath)) {
                            return trimmedLine;
                        }
                    }
                }
            } catch (error) {
                console.error('[[GITIGNORE-GUARD]] Error reading gitignore:', error);
            }
        }

        return null;
    }

    clearCache(workspacePath?: string): void {
        if (workspacePath) {
            this.ignoreInstances.delete(workspacePath);
            this.gitignorePaths.delete(workspacePath);
        } else {
            this.ignoreInstances.clear();
            this.gitignorePaths.clear();
        }
    }

    private async getIgnoreInstance(workspacePath: string): Promise<Ignore> {
        let ig = this.ignoreInstances.get(workspacePath);
        if (ig) {
            return ig;
        }

        ig = ignore();

        const gitignoreFiles = await this.findGitignoreFiles(workspacePath);
        this.gitignorePaths.set(workspacePath, gitignoreFiles);

        for (const gitignorePath of gitignoreFiles) {
            try {
                const content = await fs.promises.readFile(gitignorePath, 'utf8');
                ig.add(content);
            } catch (error) {
                console.error('[[GITIGNORE-GUARD]] Error reading .gitignore:', error);
            }
        }

        this.ignoreInstances.set(workspacePath, ig);
        return ig;
    }

    private async findGitignoreFiles(workspacePath: string): Promise<string[]> {
        const gitignoreFiles: string[] = [];

        const rootGitignore = path.join(workspacePath, '.gitignore');
        if (fs.existsSync(rootGitignore)) {
            gitignoreFiles.push(rootGitignore);
        }

        return gitignoreFiles;
    }

    async hasGitignoreFile(workspacePath: string): Promise<boolean> {
        const rootGitignore = path.join(workspacePath, '.gitignore');
        try {
            await fs.promises.access(rootGitignore, fs.constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }

    async getGitignorePreview(workspacePath: string, maxLines = 10): Promise<string[]> {
        const rootGitignore = path.join(workspacePath, '.gitignore');
        try {
            const content = await fs.promises.readFile(rootGitignore, 'utf8');
            const lines = content.split('\n');
            const previewLines: string[] = [];

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine && !trimmedLine.startsWith('#')) {
                    previewLines.push(trimmedLine);
                    if (previewLines.length >= maxLines) {
                        break;
                    }
                }
            }

            return previewLines;
        } catch {
            return [];
        }
    }
}
