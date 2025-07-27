# Contributing to VS Code Gitignore Guard

Thank you for your interest in contributing to the VS Code Gitignore Guard extension! I'm excited to have you here, and I value all types of contributions.

## You Don't Need to Be a Coder to Contribute!

There are many ways to help make this extension better:

- **Documentation**: Help improve the README, fix typos, or clarify confusing sections
- **Bug Reports**: Found something that doesn't work? Open an issue with details
- **Feature Requests**: Have an idea? I'd love to hear it
- **Testing**: Try the extension and report your experience
- **Translations**: Help make the extension accessible in more languages
- **Code**: Fix bugs, add features, or improve performance

Every contribution, no matter how small, makes a difference!

## For Developers

This document provides technical details and guidelines for code contributions. If you're new to VS Code extension development, don't worry - I'll guide you through the process.

## Table of Contents

- [Key Terms](#key-terms)
- [Development Setup](#development-setup)
- [Architecture Overview](#architecture-overview)
- [Code Structure](#code-structure)
- [Building and Testing](#building-and-testing)
- [Code Style](#code-style)
- [Submitting Changes](#submitting-changes)

## Key Terms

If you're new to VS Code extension development, here are some key terms used throughout this guide:

- **CodeLens**: A VS Code feature that displays clickable, actionable text above lines of code. In this extension, it shows the warning message above ignored files.

- **Extension Development Host**: A separate VS Code window that opens when you press F5 to test your extension. Changes you make to the extension code are reflected here.

- **Status Bar Item**: UI elements that appear in the bottom bar of VS Code. This extension shows "⚠️ Ignored file" there.

- **Git-ignored Files**: Files listed in `.gitignore` that Git won't track or commit. These are typically build outputs, secrets, or temporary files.

- **Whitelist**: In this extension, a list of file patterns that should remain editable even when they're git-ignored (e.g., `.env.local` for local development).

- **Workspace**: The folder or folders you have open in VS Code. The extension operates within the context of your workspace.

- **File System Watcher**: A VS Code API that monitors file changes. The extension uses it to detect when `.gitignore` files are modified.

## Development Setup

### Prerequisites

- Node.js (v16 or higher)
- npm (comes with Node.js)
- Git
- Visual Studio Code

### Getting Started

1. Clone the repository:

```bash
git clone https://github.com/bulletinmybeard/vscode-gitignore-guard.git
cd vscode-gitignore-guard
```

2. Install dependencies:

```bash
npm install
```

3. Open in VS Code:

```bash
code .
```

4. Press `F5` to run the extension in a new Extension Development Host window

## Architecture Overview

### How the Extension Works

At a high level, the Gitignore Guard extension follows this flow:

1. **Activation**: Extension starts when VS Code launches (via `onStartupFinished`)
2. **File Monitoring**: Watches for file opens and edits
3. **Git Check**: Determines if the file is ignored by Git
4. **Visual Feedback**: Shows warnings via CodeLens and status bar
5. **Protection** (optional): Makes ignored files read-only

### Conceptual Architecture

```
┌─────────────────────┐
│   VS Code Opens     │
│      a File         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐     ┌──────────────────┐
│  Extension Checks   │────▶│  Git Checker     │
│  if File is Ignored │     │  (uses git CLI)  │
└──────────┬──────────┘     └──────────────────┘
           │
           ▼
      Is Ignored?
           │
    ┌──────┴──────┐
    │ NO          │ YES
    │             │
    ▼             ▼
 No Action   ┌─────────────────┐
             │ Show Indicators │
             ├─────────────────┤
             │ • CodeLens      │
             │ • Status Bar    │
             │ • Read-only?    │
             └─────────────────┘
```

### Technical Details

The extension uses multiple VS Code APIs to provide non-intrusive indicators:

### Core Components

1. **CodeLens Provider** (`codeLensProvider.ts`)
    - Implements `vscode.CodeLensProvider`
    - Shows clickable message above ignored files
    - Non-intrusive, doesn't affect line numbers

2. **Status Bar Manager** (`statusBarManager.ts`)
    - Creates persistent status bar items
    - Shows count when multiple ignored files are open
    - Clickable for quick actions

3. **Git Checkers**
    - `GitCheckerVSCode`: Primary implementation using VS Code Git extension
    - `GitChecker`: Fallback using simple-git library
    - Both implement caching for performance

4. **Configuration Manager** (`config.ts`)
    - Manages all extension settings
    - Provides typed access to configuration values
    - Handles read-only mode and whitelist settings

### Technical Implementation

- **VS Code APIs Used**:
    - CodeLens API for above-line indicators
    - StatusBarItem for persistent indicators
    - FileSystemWatcher for .gitignore changes
    - Commands API for read-only state management
    - Languages API for glob pattern matching

- **Performance Optimizations**:
    - Caches git check results per file
    - Clears cache on .gitignore changes
    - Lazy initialization of git instances
    - Batch updates for multiple open files
    - Tracks read-only state to minimize API calls

## Code Structure

```bash
src/
├── codeLensProvider.ts    # CodeLens implementation
└── config.ts               # Configuration management
├── extension.ts           # Main entry point, activation logic, read-only handling
├── gitChecker.ts          # Fallback git implementation
├── gitCheckerVSCode.ts    # VS Code Git API integration
├── gitignoreParser.ts     # Parser implementation
├── statusBarManager.ts    # Status bar management
```

### Key Features Implementation:

- **Multi-file dialog handling**: See `onDidChangeConfiguration` in extension.ts
- **Modal dialogs**: Using `{ modal: true }` option in showWarningMessage
- **Apply to all logic**: Tracked with `applyToAllRemaining` and `applyToAllAction` variables

## Building and Testing

### Commands

```bash
# Compile TypeScript
npm run compile

# Watch mode (auto-compile)
npm run watch

# Run ESLint
npm run lint

# Fix ESLint issues
npm run lint:fix

# Format with Prettier
npm run format

# Check formatting
npm run format:check
```

### Manual Testing

1. Press `F5` in VS Code to launch Extension Development Host
2. Create a test Git repository with .gitignore
3. Add files to .gitignore
4. Open ignored files to see indicators
5. Test configuration changes
6. Verify .gitignore hot-reload works
7. Test read-only mode with whitelist patterns
8. Verify real-time configuration updates
9. Test multi-file dialog handling:
    - Open multiple ignored files matching a glob pattern
    - Make changes to all files
    - Remove the pattern from whitelist
    - Verify each file gets a dialog (or apply-to-all works correctly)

### Debugging

- Set breakpoints in TypeScript files
- Use Debug Console for output
- Check Extension Host logs for errors

### Read-Only Mode Implementation Notes

The read-only feature uses VS Code's session-based commands:

- `workbench.action.files.setActiveEditorReadonlyInSession` - Set file as read-only
- `workbench.action.files.resetActiveEditorReadonlyInSession` - Remove read-only state

**Important limitations:**

- Commands only work on the active editor
- Requires focusing the editor before changing state
- State is session-based (doesn't persist after restart)

**Multi-file handling:**

- When whitelist changes affect multiple files, dialogs are shown sequentially
- Modal dialogs prevent timeout issues
- "Apply to all" options reduce user friction
- Small delays ensure VS Code editor state is ready before operations

## Code Style

### ESLint Configuration

The project uses ESLint with TypeScript rules:

- camelCase for variables and functions
- PascalCase for types and classes
- Explicit return types required
- No `any` types (use specific types)
- No non-null assertions (use type guards)

### Prettier Configuration

- 4 spaces indentation
- Single quotes
- No trailing commas
- 100 character line width

## Submitting Changes

### Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Run linting and formatting: `npm run lint && npm run format`
5. Commit with descriptive message
6. Push to your fork
7. Open Pull Request with:
    - Clear description of changes
    - Screenshots if UI changes
    - Test instructions

### Commit Guidelines

- Use present tense ("Add feature" not "Added feature")
- Reference issues if applicable

## CI/CD

### GitHub Actions

The project uses GitHub Actions for continuous integration and deployment:

1. **CI Workflow** (`ci.yml`):
    - Runs on every push and pull request
    - Checks code quality (ESLint, Prettier)
    - Compiles TypeScript
    - Tests on multiple platforms (Ubuntu and Windows)
    - Tests on multiple Node versions (16, 18, 20)

2. **Release Workflow** (`release.yml`):
    - Triggered by version tags (e.g., `v1.0.0`)
    - Builds the extension package (.vsix)
    - Attaches the package to GitHub releases
    - Optionally publishes to VS Code Marketplace

3. **Dependabot**:
    - Weekly checks for dependency updates
    - Creates PRs for outdated packages
    - Configured to ignore ESLint v9 updates (see ESLint Version Strategy below)

### ESLint Version Strategy

This project currently uses ESLint v8 with the traditional configuration format (`.eslintrc.json`). I have intentionally postponed the migration to ESLint v9 due to its significant breaking changes and the new "flat config" system.

**Current versions:**

- `eslint`: ^8.28.0
- `@typescript-eslint/parser`: ^5.45.0
- `@typescript-eslint/eslint-plugin`: ^5.45.0

**Why the project stays on ESLint v8:**

- ESLint v9 requires a complete configuration rewrite to the new flat config format
- Many VS Code extensions still use v8 successfully
- The current setup is stable and working well
- Migration would require significant testing without immediate benefits

**Dependabot configuration:** The `.github/dependabot.yml` file is configured to ignore major version updates for ESLint and related packages until the project is ready to migrate.

### For Maintainers

If you're a maintainer of this project, please see [MAINTAINER.md](MAINTAINER.md) for information about:

- Publishing releases
- Managing repository secrets
- Configuring CI/CD
- Emergency procedures

## Additional Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [VS Code Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- [VS Code Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)

## Questions?

Feel free to open an issue for any questions about the codebase or development process.
