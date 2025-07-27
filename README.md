# Gitignore Guard

[![VS Code](https://img.shields.io/badge/VS%20Code-1.74%2B-blue)](https://code.visualstudio.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9%2B-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-16%2B-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](./LICENSE)
[![Extension Downloads](https://img.shields.io/visual-studio-marketplace/d/bulletinmybeard.gitignore-guard)](https://marketplace.visualstudio.com/items?itemName=bulletinmybeard.gitignore-guard)

---

See at a glance when you're editing files that Git ignores. Prevent accidental edits to files that won't be tracked!

![Gitignore Guard Overview](https://raw.githubusercontent.com/bulletinmybeard/vscode-gitignore-guard/main/images/settings-overview.png)

## Why Use This Extension?

Ever spent time editing a file only to realize Git was ignoring it? This extension helps prevent that frustration by clearly showing you which files are ignored.

**Perfect for anyone who:**

- Works with configuration files containing secrets
- Edits generated files by mistake
- Uses VS Code for projects with Git
- Wants to avoid wasting time on files that won't be tracked by Git

**Common scenarios this prevents:**

- Editing `.env` files that contain passwords (and shouldn't be shared)
- Modifying build output files that get regenerated anyway
- Changing log files that shouldn't be in version control
- Accidentally editing any file that's listed in `.gitignore`

---

## Quick Start

### Installation

1. Open VS Code
2. Press `Ctrl+Shift+X` (Windows/Linux) or `Cmd+Shift+X` (Mac) to open Extensions
3. Search for "Gitignore Guard"
4. Click Install - the extension activates automatically!

### How It Works

When you open any file that Git ignores, you'll see:

- A yellow warning message at the top of the file
- An indicator in the status bar at the bottom
- Optional: The file can be made read-only to prevent accidental edits

---

## Features

### 1. Visual Warning Message

A clear yellow warning appears at the top of ignored files. Click it to see which pattern in `.gitignore` matches your file or to open `.gitignore` for editing.

![CodeLens Warning](https://raw.githubusercontent.com/bulletinmybeard/vscode-gitignore-guard/main/images/codelens-warning.png)

The warning is interactive - click on it to:

- See which `.gitignore` pattern matches your file
- Open the `.gitignore` file directly
- Get more information about why the file is ignored

![CodeLens Interactive](https://raw.githubusercontent.com/bulletinmybeard/vscode-gitignore-guard/main/images/codelens-interactive.png)

### 2. Status Bar Indicator

Look at the bottom of VS Code - you'll see "⚠️ Ignored file" when editing ignored files. If multiple ignored files are open, it shows the count.

![Status Bar Indicator](https://raw.githubusercontent.com/bulletinmybeard/vscode-gitignore-guard/main/images/status-bar-indicator.png)

### 3. Read-Only Protection (Optional)

Want extra protection? Enable read-only mode to prevent accidental edits to ignored files. You can still whitelist specific files that need to remain editable.

When enabled, ignored files show a lock icon in their tab:

![Read-only tabs with lock icon](https://raw.githubusercontent.com/bulletinmybeard/vscode-gitignore-guard/main/images/readonly-tabs-locked.png)

The status bar shows when a file is read-only:

![Read-only status bar](https://raw.githubusercontent.com/bulletinmybeard/vscode-gitignore-guard/main/images/readonly-status-bar.png)

Trying to edit a read-only file shows this message:

![Read-only edit blocked](https://raw.githubusercontent.com/bulletinmybeard/vscode-gitignore-guard/main/images/readonly-edit-blocked.png)

Need to make a quick edit? Click "Click here" for temporary write access:

![Temporary write access](https://raw.githubusercontent.com/bulletinmybeard/vscode-gitignore-guard/main/images/readonly-temp-access.png)

Once you have temporary access, you can edit the file normally (notice "John Doe..." being typed). The file becomes read-only again when you close and reopen it.

---

## Customization

### Basic Settings

Access settings through `File → Preferences → Settings` (or `Code → Preferences → Settings` on Mac), then search for "gitignore guard".

![Extension Settings](https://raw.githubusercontent.com/bulletinmybeard/vscode-gitignore-guard/main/images/settings-panel.png)

**What you can customize:**

- **Enable/Disable** the entire extension
- **Change the warning message** - make it say whatever you want!
- **Turn off** individual features (warning message or status bar)
- **Enable read-only mode** to protect ignored files from edits

### Advanced Configuration

#### Read-Only Mode with Whitelist

If you enable read-only mode but need some ignored files to remain editable, use the whitelist:

```json
"gitignoreGuard.readOnlyWhitelist": [
    "*.example",              // Example files
    "**/README.md",           // README files in any folder
    ".vscode/settings.json",  // VS Code workspace settings
    "config.yaml",            // Configuration files
    "test-*.rb"               // Test files matching pattern
]
```

**Note:** The screenshot shows examples - you can add any patterns that match your workflow.

**Understanding Patterns:**

- `*.log` - All files ending with .log
- `test-*` - All files starting with "test-"
- `**/*.md` - All .md files in any folder
- `config/*.json` - JSON files directly in the config folder

#### Handling Multiple Files

When you remove a pattern from the whitelist that affects multiple open files with unsaved changes, you'll see options to:

- Handle each file individually
- Apply your choice to all remaining files at once

This saves time when dealing with many files at once.

---

## Common Questions

### What is .gitignore?

`.gitignore` is a special file in your project that tells Git which files to ignore. These ignored files won't be uploaded when you share your code on GitHub, GitLab, or other platforms.

**Why ignore files?** Some files contain:

- Passwords or API keys (like `.env` files)
- Large generated files (like `node_modules` or build outputs)
- Personal settings specific to your computer
- Temporary files that change frequently

### How do I stop ignoring a file?

1. Open your `.gitignore` file
2. Find the line that matches your file
3. Delete that line
4. Save the file - the warning will disappear immediately!

### The extension isn't working

Check these common issues:

1. **Do you have a `.gitignore` file?** The extension needs at least a `.gitignore` file to work
2. **Is the file actually ignored?** The file must match a pattern in `.gitignore`
3. **Is the extension enabled?** Check the status bar or extension settings

### Tips for Beginners

- **New to Git?** Git is a version control system that tracks changes to your files
- **Not sure what to ignore?** GitHub provides templates for common project types
- **Working with secrets?** Always add files containing passwords to `.gitignore`

---

## Technical Information

### Requirements

- Visual Studio Code version 1.74.0 or newer
- A `.gitignore` file in your project
- Git (optional) - the extension works with just `.gitignore` files, but Git provides better ignore detection

### Support & Contributing

Found a bug or have a suggestion? Please [open an issue](https://github.com/bulletinmybeard/vscode-gitignore-guard/issues) on GitHub.

**Developer?** Check out [CONTRIBUTING.md](CONTRIBUTING.md) for technical details and how to contribute.

### License

[MIT License](LICENSE) - feel free to use this extension however you'd like!
