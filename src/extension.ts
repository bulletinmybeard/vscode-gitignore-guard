import * as vscode from 'vscode';
import * as path from 'path';
import { GitChecker } from './gitChecker';
import { GitCheckerVSCode } from './gitCheckerVSCode';
import { GitignoreCodeLensProvider } from './codeLensProvider';
import { StatusBarManager } from './statusBarManager';
import { Config } from './config';

let gitChecker: GitChecker | GitCheckerVSCode;
let codeLensProvider: GitignoreCodeLensProvider;
let statusBarManager: StatusBarManager;
let config: Config;
let isUpdatingFromConfigChange = false;
const readOnlyFiles: Set<string> = new Set();
const temporarilyEditableFiles: Set<string> = new Set();

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    config = new Config(context);

    gitChecker = new GitCheckerVSCode(config);
    statusBarManager = new StatusBarManager(config, temporarilyEditableFiles, gitChecker);

    await checkWorkspaceStatus(context, config, gitChecker);

    codeLensProvider = new GitignoreCodeLensProvider(gitChecker, config);
    const codeLensDisposable = vscode.languages.registerCodeLensProvider(
        { scheme: 'file' },
        codeLensProvider
    );
    context.subscriptions.push(codeLensDisposable);

    const updateDecorations = async (
        editor: vscode.TextEditor | undefined,
        applyReadOnly = true
    ): Promise<void> => {
        if (!editor || !config.isEnabled()) {
            return;
        }

        const document = editor.document;
        if (document.uri.scheme !== 'file') {
            return;
        }

        const isIgnored = await gitChecker.isFileIgnored(document.uri.fsPath);

        if (isIgnored) {
            statusBarManager.showForFile(document.uri.fsPath);

            if (config.getOpenAsReadOnly()) {
                const whitelist = config.getReadOnlyWhitelist();
                const relativePath = vscode.workspace.asRelativePath(document.uri.fsPath);
                const fileName = path.basename(document.uri.fsPath);

                const isWhitelisted = whitelist.some((pattern) => {
                    const languages = vscode.languages.match({ pattern }, document);
                    if (languages > 0) {
                        return true;
                    }

                    if (pattern.includes('*')) {
                        const regex = new RegExp(
                            '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
                        );
                        const matchesRelative = regex.test(relativePath);
                        const matchesFilename = regex.test(fileName);
                        return matchesRelative || matchesFilename;
                    }

                    return relativePath === pattern || fileName === pattern;
                });

                if (!isWhitelisted) {
                    if (temporarilyEditableFiles.has(document.uri.fsPath)) {
                        return;
                    }

                    if (applyReadOnly && !isUpdatingFromConfigChange) {
                        if (vscode.window.activeTextEditor?.document !== document) {
                            await vscode.window.showTextDocument(document, {
                                preview: false,
                                preserveFocus: false
                            });
                            await new Promise((resolve) => setTimeout(resolve, 50));
                        }

                        try {
                            await vscode.commands.executeCommand(
                                'workbench.action.files.setActiveEditorReadonlyInSession'
                            );
                            readOnlyFiles.add(document.uri.fsPath);
                        } catch (error) {
                            console.error(
                                '[GITIGNORE-GUARD][UPDATE DECORATIONS] Failed to set read-only:',
                                error
                            );
                        }
                    }
                } else {
                    if (readOnlyFiles.has(document.uri.fsPath)) {
                        if (vscode.window.activeTextEditor?.document === document) {
                            try {
                                await vscode.commands.executeCommand(
                                    'workbench.action.files.resetActiveEditorReadonlyInSession'
                                );
                                readOnlyFiles.delete(document.uri.fsPath);
                            } catch (error) {
                                console.error('[GITIGNORE-GUARD] Error toggling read-only:', error);
                            }
                        }
                    }
                }
            }
        } else {
            statusBarManager.hideForFile(document.uri.fsPath);
        }

        codeLensProvider.refresh();
    };

    vscode.window.onDidChangeActiveTextEditor(
        async (editor) => {
            if (
                editor &&
                editor.document.uri.scheme === 'file' &&
                !editor.document.uri.fsPath.includes('settings.json')
            ) {
                // Track last editor before settings (currently unused)
            }

            if (!isUpdatingFromConfigChange) {
                await updateDecorations(editor);
                statusBarManager.updateStatusBar();
            }
        },
        null,
        context.subscriptions
    );

    vscode.workspace.onDidOpenTextDocument(
        async (document) => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document === document) {
                await updateDecorations(editor);
            }
        },
        null,
        context.subscriptions
    );

    vscode.workspace.onDidCloseTextDocument(
        async (document) => {
            const filePath = document.uri.fsPath;

            if (temporarilyEditableFiles.has(filePath)) {
                temporarilyEditableFiles.delete(filePath);

                readOnlyFiles.delete(filePath);
            }
        },
        null,
        context.subscriptions
    );

    vscode.workspace.onDidChangeConfiguration(
        async (e) => {
            if (e.affectsConfiguration('gitignoreGuard')) {
                config.reload();

                gitChecker.updateConfiguration(config);
                codeLensProvider.updateConfiguration(config);
                statusBarManager.updateConfiguration(config);

                const documentsToProcess: vscode.TextDocument[] = [];

                if (e.affectsConfiguration('gitignoreGuard.readOnlyWhitelist')) {
                    const openDocuments = vscode.workspace.textDocuments.filter(
                        (doc) => doc.uri.scheme === 'file' && !doc.isClosed
                    );

                    for (const doc of openDocuments) {
                        const isIgnored = await gitChecker.isFileIgnored(doc.uri.fsPath);
                        if (isIgnored) {
                            const whitelist = config.getReadOnlyWhitelist();
                            const relativePath = vscode.workspace.asRelativePath(doc.uri.fsPath);
                            const fileName = path.basename(doc.uri.fsPath);

                            const isWhitelisted = whitelist.some((pattern) => {
                                if (pattern.includes('*')) {
                                    const regex = new RegExp(
                                        '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
                                    );
                                    return regex.test(relativePath) || regex.test(fileName);
                                }
                                return relativePath === pattern || fileName === pattern;
                            });

                            if (!isWhitelisted) {
                                documentsToProcess.push(doc);
                            }
                        }
                    }
                } else {
                    const activeEditor = vscode.window.activeTextEditor;
                    if (activeEditor && activeEditor.document.uri.scheme === 'file') {
                        documentsToProcess.push(activeEditor.document);
                    }
                }

                isUpdatingFromConfigChange = true;

                let applyToAllRemaining = false;
                let applyToAllAction: 'keep-editable' | 'discard-readonly' | null = null;

                const documentsWithChanges = documentsToProcess.filter((doc) => doc.isDirty);

                for (let i = 0; i < documentsWithChanges.length; i++) {
                    const doc = documentsWithChanges[i];
                    const filePath = doc.uri.fsPath;

                    const editor = await vscode.window.showTextDocument(doc, {
                        preview: false,
                        preserveFocus: false
                    });

                    await new Promise((resolve) => setTimeout(resolve, 50));

                    await updateDecorations(editor, false);

                    if (
                        e.affectsConfiguration('gitignoreGuard.openAsReadOnly') ||
                        e.affectsConfiguration('gitignoreGuard.readOnlyWhitelist')
                    ) {
                        const isIgnored = await gitChecker.isFileIgnored(filePath);
                        if (isIgnored && config.getOpenAsReadOnly()) {
                            const whitelist = config.getReadOnlyWhitelist();
                            const relativePath = vscode.workspace.asRelativePath(filePath);
                            const fileName = path.basename(filePath);

                            const isWhitelisted = whitelist.some((pattern) => {
                                const languages = vscode.languages.match(
                                    { pattern },
                                    editor.document
                                );
                                if (languages > 0) {
                                    return true;
                                }

                                if (pattern.includes('*')) {
                                    const regex = new RegExp(
                                        '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
                                    );
                                    const matchesRelative = regex.test(relativePath);
                                    const matchesFilename = regex.test(fileName);
                                    return matchesRelative || matchesFilename;
                                }

                                return relativePath === pattern || fileName === pattern;
                            });

                            if (!isWhitelisted) {
                                let choice: string | undefined;

                                if (applyToAllRemaining && applyToAllAction) {
                                    choice =
                                        applyToAllAction === 'keep-editable'
                                            ? 'Keep Editable Until Closed'
                                            : 'Discard Changes & Make Read-Only';
                                } else {
                                    if (vscode.window.activeTextEditor !== editor) {
                                        await vscode.window.showTextDocument(
                                            editor.document,
                                            editor.viewColumn
                                        );
                                        await new Promise((resolve) => setTimeout(resolve, 100));
                                    }

                                    const remainingCount = documentsWithChanges.length - i - 1;

                                    if (remainingCount > 0) {
                                        choice = await vscode.window.showWarningMessage(
                                            `The file "${fileName}" has unsaved changes and will become read-only. What would you like to do? (${remainingCount} more file${remainingCount > 1 ? 's' : ''} to process)`,
                                            { modal: true },
                                            'Keep Editable Until Closed',
                                            'Keep All Remaining Editable',
                                            'Discard Changes & Make Read-Only',
                                            'Discard All & Make Read-Only'
                                        );
                                    } else {
                                        choice = await vscode.window.showWarningMessage(
                                            `The file "${fileName}" has unsaved changes and will become read-only. What would you like to do?`,
                                            { modal: true },
                                            'Keep Editable Until Closed',
                                            'Discard Changes & Make Read-Only'
                                        );
                                    }
                                }

                                if (
                                    choice === 'Keep Editable Until Closed' ||
                                    choice === 'Keep All Remaining Editable'
                                ) {
                                    temporarilyEditableFiles.add(filePath);

                                    if (readOnlyFiles.has(filePath)) {
                                        try {
                                            await vscode.commands.executeCommand(
                                                'workbench.action.files.resetActiveEditorReadonlyInSession'
                                            );
                                            readOnlyFiles.delete(filePath);
                                        } catch (error) {
                                            console.error(
                                                '[GITIGNORE-GUARD][CONFIG CHANGE] Error removing read-only:',
                                                error
                                            );
                                        }
                                    }

                                    statusBarManager.updateStatusBar();

                                    if (choice === 'Keep All Remaining Editable') {
                                        applyToAllRemaining = true;
                                        applyToAllAction = 'keep-editable';
                                    }

                                    continue;
                                } else if (
                                    choice === 'Discard Changes & Make Read-Only' ||
                                    choice === 'Discard All & Make Read-Only'
                                ) {
                                    if (vscode.window.activeTextEditor !== editor) {
                                        await vscode.window.showTextDocument(
                                            editor.document,
                                            editor.viewColumn
                                        );
                                    }

                                    await vscode.commands.executeCommand(
                                        'workbench.action.files.revert'
                                    );

                                    await vscode.commands.executeCommand(
                                        'workbench.action.files.setActiveEditorReadonlyInSession'
                                    );
                                    readOnlyFiles.add(filePath);

                                    if (choice === 'Discard All & Make Read-Only') {
                                        applyToAllRemaining = true;
                                        applyToAllAction = 'discard-readonly';
                                    }

                                    continue;
                                } else {
                                    continue;
                                }
                            } else {
                                if (readOnlyFiles.has(filePath)) {
                                    if (vscode.window.activeTextEditor !== editor) {
                                        await vscode.window.showTextDocument(
                                            editor.document,
                                            editor.viewColumn
                                        );

                                        await new Promise((resolve) => setTimeout(resolve, 100));
                                    }

                                    const activeEditor = vscode.window.activeTextEditor;

                                    if (
                                        activeEditor &&
                                        activeEditor.document.uri.fsPath === filePath
                                    ) {
                                        try {
                                            await vscode.commands.executeCommand(
                                                'workbench.action.files.resetActiveEditorReadonlyInSession'
                                            );
                                            readOnlyFiles.delete(filePath);
                                        } catch (error) {
                                            console.error(
                                                '[GITIGNORE-GUARD][CONFIG CHANGE] Error toggling read-only:',
                                                error
                                            );
                                            setTimeout(async () => {
                                                try {
                                                    await vscode.commands.executeCommand(
                                                        'workbench.action.files.resetActiveEditorReadonlyInSession'
                                                    );
                                                    readOnlyFiles.delete(filePath);
                                                } catch (retryError) {
                                                    console.error(
                                                        '[GITIGNORE-GUARD][CONFIG CHANGE] Retry also failed:',
                                                        retryError
                                                    );
                                                }
                                            }, 500);
                                        }
                                    } else {
                                        console.warn(
                                            '[GITIGNORE-GUARD][CONFIG CHANGE] Could not make editor active, skipping toggle'
                                        );
                                    }
                                }
                            }
                        } else if (!config.getOpenAsReadOnly() && isIgnored) {
                            if (readOnlyFiles.has(filePath)) {
                                if (vscode.window.activeTextEditor !== editor) {
                                    await vscode.window.showTextDocument(
                                        editor.document,
                                        editor.viewColumn
                                    );
                                    await new Promise((resolve) => setTimeout(resolve, 100));
                                }

                                const activeEditor = vscode.window.activeTextEditor;
                                if (activeEditor && activeEditor.document.uri.fsPath === filePath) {
                                    try {
                                        await vscode.commands.executeCommand(
                                            'workbench.action.files.resetActiveEditorReadonlyInSession'
                                        );
                                        readOnlyFiles.delete(filePath);
                                    } catch (error) {
                                        console.error(
                                            '[GITIGNORE-GUARD][CONFIG CHANGE] Error toggling read-only:',
                                            error
                                        );
                                    }
                                } else {
                                    console.warn(
                                        '[GITIGNORE-GUARD][CONFIG CHANGE] Could not make editor active, skipping toggle'
                                    );
                                }
                            }
                        }
                    }
                }

                setTimeout(() => {
                    isUpdatingFromConfigChange = false;
                }, 500);

                statusBarManager.updateStatusBar();
            }
        },
        null,
        context.subscriptions
    );

    const watcher = vscode.workspace.createFileSystemWatcher('**/.gitignore');
    let updateTimeout: NodeJS.Timeout | undefined;

    const updateAllVisibleEditors = async (): Promise<void> => {
        gitChecker.clearCache();
        const updatePromises = vscode.window.visibleTextEditors.map((editor) =>
            updateDecorations(editor)
        );
        await Promise.all(updatePromises);
        statusBarManager.updateStatusBar();
    };

    const debouncedUpdate = (): void => {
        if (updateTimeout) {
            clearTimeout(updateTimeout);
        }
        updateTimeout = setTimeout(() => {
            updateAllVisibleEditors();
        }, 100);
    };

    watcher.onDidChange(debouncedUpdate);
    watcher.onDidCreate(debouncedUpdate);
    watcher.onDidDelete(debouncedUpdate);
    context.subscriptions.push(watcher);

    if (vscode.window.activeTextEditor) {
        if (vscode.window.activeTextEditor.document.uri.scheme === 'file') {
            // Track last editor (currently unused)
        }
        await updateDecorations(vscode.window.activeTextEditor);
    }

    const checkCommand = vscode.commands.registerCommand(
        'gitignoreGuard.checkCurrentFile',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showInformationMessage('No active editor');
                return;
            }

            const filePath = editor.document.uri.fsPath;
            const isIgnored = await gitChecker.isFileIgnored(filePath);
            vscode.window.showInformationMessage(
                `File "${path.basename(filePath)}" is ${isIgnored ? 'IGNORED' : 'NOT ignored'} by .gitignore`
            );
        }
    );
    context.subscriptions.push(checkCommand);

    const infoCommand = vscode.commands.registerCommand(
        'gitignoreGuard.showIgnoredFileInfo',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            const filePath = editor.document.uri.fsPath;
            const fileName = path.basename(filePath);

            const pattern = await gitChecker.getIgnorePattern(filePath);

            let message = `The file "${fileName}" is ignored by .gitignore and won't be tracked by Git.`;
            if (pattern) {
                message += `\n\nMatching pattern: ${pattern}`;
            }

            const selection = await vscode.window.showInformationMessage(
                message,
                'View .gitignore',
                'OK'
            );

            if (selection === 'View .gitignore') {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (workspaceFolder) {
                    const gitignorePath = vscode.Uri.joinPath(workspaceFolder.uri, '.gitignore');
                    try {
                        const doc = await vscode.workspace.openTextDocument(gitignorePath);
                        await vscode.window.showTextDocument(doc);
                    } catch (error) {
                        vscode.window.showErrorMessage('Could not open .gitignore file');
                    }
                }
            }
        }
    );
    context.subscriptions.push(infoCommand);

    const toggleCommand = vscode.commands.registerCommand(
        'gitignoreGuard.toggleExtension',
        async () => {
            const currentValue = config.isEnabled();
            await vscode.workspace
                .getConfiguration('gitignoreGuard')
                .update('enabled', !currentValue, true);
            vscode.window.showInformationMessage(
                `Gitignore Guard ${!currentValue ? 'enabled' : 'disabled'}`
            );
        }
    );
    context.subscriptions.push(toggleCommand);

    let disableTimer: NodeJS.Timeout | undefined;
    let countdownInterval: NodeJS.Timeout | undefined;
    let remainingSeconds = 0;

    const temporaryDisableCommand = vscode.commands.registerCommand(
        'gitignoreGuard.disableTemporarily',
        async () => {
            if (disableTimer) {
                clearTimeout(disableTimer);
                if (countdownInterval) {
                    clearInterval(countdownInterval);
                }
            }

            await vscode.workspace
                .getConfiguration('gitignoreGuard')
                .update('enabled', false, true);

            remainingSeconds = 300;

            const updateCountdown = (): void => {
                if (remainingSeconds > 0) {
                    const minutes = Math.floor(remainingSeconds / 60);
                    const seconds = remainingSeconds % 60;
                    statusBarManager.showTemporaryDisableCountdown(minutes, seconds);
                    remainingSeconds--;
                } else {
                    if (countdownInterval) {
                        clearInterval(countdownInterval);
                    }
                }
            };

            updateCountdown();
            countdownInterval = setInterval(updateCountdown, 1000);

            disableTimer = setTimeout(async () => {
                await vscode.workspace
                    .getConfiguration('gitignoreGuard')
                    .update('enabled', true, true);
                vscode.window.showInformationMessage('Gitignore Guard re-enabled');
                if (countdownInterval) {
                    clearInterval(countdownInterval);
                }
                statusBarManager.updateStatusBar();
            }, 300000);

            vscode.window.showInformationMessage('Gitignore Guard disabled for 5 minutes');
        }
    );
    context.subscriptions.push(temporaryDisableCommand);

    const toggleReadOnlyCommand = vscode.commands.registerCommand(
        'gitignoreGuard.toggleReadOnly',
        async () => {
            const currentValue = config.getOpenAsReadOnly();
            await vscode.workspace
                .getConfiguration('gitignoreGuard')
                .update('openAsReadOnly', !currentValue, true);
            vscode.window.showInformationMessage(
                `Read-only mode ${!currentValue ? 'enabled' : 'disabled'}`
            );
        }
    );
    context.subscriptions.push(toggleReadOnlyCommand);

    const addToWhitelistCommand = vscode.commands.registerCommand(
        'gitignoreGuard.addCurrentFileToWhitelist',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active file');
                return;
            }

            const filePath = editor.document.uri.fsPath;
            const relativePath = vscode.workspace.asRelativePath(filePath);

            const isIgnored = await gitChecker.isFileIgnored(filePath);
            if (!isIgnored) {
                vscode.window.showInformationMessage('This file is not ignored by Git');
                return;
            }

            const currentWhitelist = config.getReadOnlyWhitelist();

            if (currentWhitelist.includes(relativePath)) {
                vscode.window.showInformationMessage('File is already in the whitelist');
                return;
            }

            const newWhitelist = [...currentWhitelist, relativePath];
            await vscode.workspace
                .getConfiguration('gitignoreGuard')
                .update('readOnlyWhitelist', newWhitelist, true);

            vscode.window.showInformationMessage(`Added "${relativePath}" to whitelist`);
        }
    );
    context.subscriptions.push(addToWhitelistCommand);
}

async function checkWorkspaceStatus(
    context: vscode.ExtensionContext,
    config: Config,
    gitChecker: GitChecker | GitCheckerVSCode
): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return;
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const isGitRepo = await gitChecker.isGitRepository(workspacePath);
    const hasGitignore = await gitChecker.hasGitignoreFile(workspacePath);

    if (isGitRepo && hasGitignore) {
        return;
    }

    if (config.hasShownNoGitMessage()) {
        return;
    }

    if (!isGitRepo && !hasGitignore) {
        // No git repo and no .gitignore - extension won't work
        vscode.window.showInformationMessage(
            'Gitignore Guard: No .gitignore file found. The extension monitors files ignored by .gitignore.'
        );
        config.setHasShownNoGitMessage(true);
        return;
    }

    if (!isGitRepo && hasGitignore) {
        // No git repo but .gitignore exists - extension will work automatically
        vscode.window.showInformationMessage(
            'Gitignore Guard: Using .gitignore file directly (no Git repository detected).'
        );
        config.setHasShownNoGitMessage(true);

        // Update status bar to indicate gitignore-only mode
        statusBarManager.setGitignoreOnlyMode(true);
    }
}

export function deactivate(): void {
    if (statusBarManager) {
        statusBarManager.dispose();
    }
}
