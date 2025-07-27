import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { simpleGit, SimpleGit } from 'simple-git';
import { GitignoreParser } from './gitignoreParser';
import { Config } from './config';

export class GitChecker {
    private cache: Map<string, boolean> = new Map();
    private gitInstances: Map<string, SimpleGit> = new Map();
    private gitignoreParser: GitignoreParser;
    private config: Config;
    private isGitAvailable: Map<string, boolean> = new Map();

    constructor(config: Config) {
        this.config = config;
        this.gitignoreParser = new GitignoreParser();
    }

    async isFileIgnored(filePath: string): Promise<boolean> {
        console.log('[GITIGNORE-GUARD] isFileIgnored called for:', filePath);

        if (this.cache.has(filePath)) {
            console.log('[GITIGNORE-GUARD] Using cached result for:', filePath);
            return this.cache.get(filePath) as boolean;
        }

        try {
            const gitRoot = await this.findGitRoot(filePath);
            console.log('[GITIGNORE-GUARD] Git root search result:', gitRoot);

            if (!gitRoot) {
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(
                    vscode.Uri.file(filePath)
                );
                if (!workspaceFolder) {
                    console.log('[GITIGNORE-GUARD] No workspace folder found for:', filePath);
                    return false;
                }

                // Always use gitignore parser when no Git repository exists
                console.log('[GITIGNORE-GUARD] No Git repo found, using gitignore parser');
                const isIgnored = await this.gitignoreParser.isFileIgnored(filePath);
                console.log('[GITIGNORE-GUARD] Gitignore parser result:', isIgnored);
                this.cache.set(filePath, isIgnored);
                return isIgnored;
            }

            const repoPath = gitRoot;
            console.log('[GITIGNORE-GUARD] Git repository found at:', repoPath);
            let git = this.gitInstances.get(repoPath);

            if (!git) {
                git = simpleGit(repoPath);
                this.gitInstances.set(repoPath, git);
            }

            this.isGitAvailable.set(repoPath, true);

            const relativePath = path.relative(repoPath, filePath);
            console.log('[GITIGNORE-GUARD] Checking relative path:', relativePath);

            const result = await git.raw(['check-ignore', relativePath]);
            const isIgnored = result.trim().length > 0;
            console.log(
                '[GITIGNORE-GUARD] Git check-ignore result:',
                result,
                'Is ignored:',
                isIgnored
            );

            this.cache.set(filePath, isIgnored);
            return isIgnored;
        } catch (error) {
            if (error && typeof error === 'object' && 'exitCode' in error) {
                const exitCode = (error as { exitCode: number }).exitCode;
                if (exitCode === 1) {
                    console.log('[GITIGNORE-GUARD] File is not ignored (exit code 1)');
                    this.cache.set(filePath, false);
                    return false;
                }
            }

            console.error('[GITIGNORE-GUARD] Error checking if file is ignored:', error);
            return false;
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
            const gitRoot = await this.findGitRoot(filePath);

            if (!gitRoot) {
                // Always use gitignore parser when no Git repository exists
                return await this.gitignoreParser.getIgnorePattern(filePath);
            }

            const repoPath = gitRoot;
            let git = this.gitInstances.get(repoPath);

            if (!git) {
                git = simpleGit(repoPath);
                this.gitInstances.set(repoPath, git);
            }

            const relativePath = path.relative(repoPath, filePath);

            try {
                const result = await git.raw(['check-ignore', '-v', relativePath]);

                const parts = result.trim().split('\t');
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
            return null;
        }
    }

    async isGitRepository(workspacePath: string): Promise<boolean> {
        if (this.isGitAvailable.has(workspacePath)) {
            return this.isGitAvailable.get(workspacePath) || false;
        }

        try {
            let git = this.gitInstances.get(workspacePath);
            if (!git) {
                git = simpleGit(workspacePath);
                this.gitInstances.set(workspacePath, git);
            }

            const isRepo = await git.checkIsRepo();
            this.isGitAvailable.set(workspacePath, isRepo);
            return isRepo;
        } catch (error) {
            console.error('[GITIGNORE-GUARD] Error checking if git repository:', error);
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
                    console.log('[GITIGNORE-GUARD] Found .git at workspace root:', workspaceRoot);
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
                    console.log('[GITIGNORE-GUARD] Found .git directory at:', currentPath);
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
