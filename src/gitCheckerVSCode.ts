import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { GitignoreParser } from './gitignoreParser';
import { Config } from './config';

const execAsync = promisify(exec);

export class GitCheckerVSCode {
    private cache: Map<string, boolean> = new Map();
    private gitignoreParser: GitignoreParser;
    private config: Config;
    private isGitAvailable: Map<string, boolean> = new Map();

    constructor(config: Config) {
        this.config = config;
        this.gitignoreParser = new GitignoreParser();
    }

    async isFileIgnored(filePath: string): Promise<boolean> {
        if (this.cache.has(filePath)) {
            return this.cache.get(filePath) as boolean;
        }

        try {
            const gitRoot = await this.findGitRoot(filePath);

            if (gitRoot) {
                const relativePath = path.relative(gitRoot, filePath);

                try {
                    const { stdout } = await execAsync(`git check-ignore "${relativePath}"`, {
                        cwd: gitRoot
                    });

                    const isIgnored = stdout.trim().length > 0;
                    this.cache.set(filePath, isIgnored);
                    return isIgnored;
                } catch (error) {
                    if ((error as { code?: number }).code === 1) {
                        this.cache.set(filePath, false);
                        return false;
                    }
                    throw error;
                }
            }

            const gitExtension = vscode.extensions.getExtension('vscode.git');
            if (gitExtension && gitExtension.isActive) {
                const git = gitExtension.exports.getAPI(1);
                const repositories = git.repositories;

                for (const repo of repositories) {
                    const repoPath = repo.rootUri.fsPath;
                    if (filePath.startsWith(repoPath)) {
                        const relativePath = path.relative(repoPath, filePath);

                        try {
                            const { stdout } = await execAsync(
                                `git check-ignore "${relativePath}"`,
                                {
                                    cwd: repoPath
                                }
                            );

                            const isIgnored = stdout.trim().length > 0;
                            this.cache.set(filePath, isIgnored);
                            return isIgnored;
                        } catch (error) {
                            if ((error as { code?: number }).code === 1) {
                                this.cache.set(filePath, false);
                                return false;
                            }
                            throw error;
                        }
                    }
                }
            }

            const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
            if (!workspaceFolder) {
                return false;
            }

            const repoPath = workspaceFolder.uri.fsPath;
            const relativePath = path.relative(repoPath, filePath);

            try {
                const { stdout } = await execAsync(`git check-ignore "${relativePath}"`, {
                    cwd: repoPath
                });

                const isIgnored = stdout.trim().length > 0;
                this.cache.set(filePath, isIgnored);
                return isIgnored;
            } catch (error) {
                if ((error as { code?: number }).code === 1) {
                    this.cache.set(filePath, false);
                    return false;
                }
                throw error;
            }
        } catch (error) {
            console.error('[GITIGNORE-GUARD] Error checking if file is ignored:', error);

            // Always use gitignore parser when Git is not available
            const isIgnored = await this.gitignoreParser.isFileIgnored(filePath);
            this.cache.set(filePath, isIgnored);
            return isIgnored;
        }
    }

    clearCache(): void {
        this.cache.clear();
    }

    clearCacheForFile(filePath: string): void {
        this.cache.delete(filePath);
    }

    async getIgnorePattern(filePath: string): Promise<string | null> {
        try {
            const gitExtension = vscode.extensions.getExtension('vscode.git');
            let repoPath: string | null = null;
            let relativePath = '';

            if (gitExtension && gitExtension.isActive) {
                const git = gitExtension.exports.getAPI(1);
                const repositories = git.repositories;

                for (const repo of repositories) {
                    const repoCandidatePath = repo.rootUri.fsPath;
                    if (filePath.startsWith(repoCandidatePath)) {
                        repoPath = repoCandidatePath;
                        relativePath = path.relative(repoCandidatePath, filePath);
                        break;
                    }
                }
            }

            if (!repoPath) {
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(
                    vscode.Uri.file(filePath)
                );
                if (!workspaceFolder) {
                    return null;
                }
                repoPath = workspaceFolder.uri.fsPath;
                relativePath = path.relative(repoPath, filePath);
            }

            try {
                const { stdout } = await execAsync(`git check-ignore -v "${relativePath}"`, {
                    cwd: repoPath
                });

                const parts = stdout.trim().split('\t');
                if (parts.length >= 1) {
                    const patternInfo = parts[0].split(':');
                    if (patternInfo.length >= 3) {
                        return patternInfo.slice(2).join(':');
                    }
                }
                return null;
            } catch (error) {
                return null;
            }
        } catch (error) {
            console.error('[GITIGNORE-GUARD] Error getting ignore pattern:', error);

            // Always use gitignore parser when Git is not available
            return await this.gitignoreParser.getIgnorePattern(filePath);
        }
    }

    async isGitRepository(workspacePath: string): Promise<boolean> {
        if (this.isGitAvailable.has(workspacePath)) {
            return this.isGitAvailable.get(workspacePath) || false;
        }

        try {
            await execAsync('git rev-parse --git-dir', { cwd: workspacePath });
            this.isGitAvailable.set(workspacePath, true);
            return true;
        } catch (error) {
            this.isGitAvailable.set(workspacePath, false);
            return false;
        }
    }

    async hasGitignoreFile(workspacePath: string): Promise<boolean> {
        return await this.gitignoreParser.hasGitignoreFile(workspacePath);
    }

    updateConfiguration(config: Config): void {
        this.config = config;
    }

    private async findGitRoot(filePath: string): Promise<string | null> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
        const workspaceRoot = workspaceFolder ? workspaceFolder.uri.fsPath : null;

        if (workspaceRoot) {
            const workspaceGitPath = path.join(workspaceRoot, '.git');
            try {
                const stats = await fs.promises.stat(workspaceGitPath);
                if (stats.isDirectory()) {
                    return workspaceRoot;
                }
            } catch {
                // Ignore if directory doesn't exist
            }
        }

        let currentPath = path.dirname(filePath);

        while (currentPath && currentPath !== workspaceRoot) {
            const gitPath = path.join(currentPath, '.git');
            try {
                const stats = await fs.promises.stat(gitPath);
                if (stats.isDirectory()) {
                    return currentPath;
                }
            } catch {
                // Ignore if directory doesn't exist
            }

            if (currentPath === path.dirname(currentPath)) {
                break;
            }

            currentPath = path.dirname(currentPath);
        }

        return null;
    }
}
