# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.1-github] - 2025-01-28

### Fixed
- `CHANGELOG` owner file pattern

### Added
- Add GitHub PR and ISSUE templates

## [0.9.0] - 2025-01-26

Initial release of Gitignore Guard (pre-release) - a VS Code extension that helps you see at a glance when you're editing files that Git ignores.

### Core Features

- **Visual Warnings**: CodeLens indicator showing "⚠️ This file is ignored by .gitignore ⚠️" above ignored files
- **Status Bar Indicator**: Shows "⚠️ Ignored file" with count when editing ignored files
- **Interactive CodeLens**: Click the warning to view .gitignore or learn which pattern matches your file
- **Read-Only Protection** (Optional): Open ignored files as read-only to prevent accidental edits
    - Files show lock icon in tab when read-only
    - Temporary write access available via prompt
    - Session-based (doesn't persist after VS Code restart)
- **Whitelist Support**: Configure which ignored files should remain editable using glob patterns
    - Default includes `.env.example`, `*.example`, `**/README.md`, `.vscode/settings.json`
    - Real-time updates when whitelist changes
- **Works Without Git**: Automatically parses .gitignore files even without a Git repository
    - Status bar shows 📄 icon when running in gitignore-only mode

### Configuration Options

- `gitignoreGuard.enabled`: Enable/disable the extension
- `gitignoreGuard.codeLensMessage`: Customize the warning message
- `gitignoreGuard.showCodeLens`: Toggle CodeLens indicator
- `gitignoreGuard.showStatusBar`: Toggle status bar indicator
- `gitignoreGuard.openAsReadOnly`: Enable read-only protection for ignored files
- `gitignoreGuard.readOnlyWhitelist`: Glob patterns for files that should remain editable

### Technical Details

- Uses VS Code's CodeLens API for non-intrusive indicators
- Compatible with VS Code 1.74.0 and later
- Supports both VS Code Git API and fallback to git command line
- TypeScript implementation with full type safety
- Performance optimized with caching
- Real-time updates when .gitignore changes
- Multi-workspace support

### Note

This is a pre-release version (0.9.0) for testing and feedback. Version 1.0.0 will be the first stable release. Please report any issues on [GitHub](https://github.com/bulletinmybeard/vscode-gitignore-guard/issues).
