# Maintainer Guide

This document contains information specific to maintaining and publishing the VS Code Gitignore Guard extension. If you're looking to contribute to the project, please see [CONTRIBUTING.md](CONTRIBUTING.md).

## Table of Contents

- [Repository Setup](#repository-setup)
- [Publishing](#publishing)
    - [Managing README Images](#managing-readme-images)
    - [Creating a New Release](#creating-a-new-release)
    - [Manual Publishing to VS Code Marketplace](#manual-publishing-to-vs-code-marketplace)
- [CI/CD Configuration](#cicd-configuration)
    - [Setting up Automated Publishing](#setting-up-automated-publishing)
    - [Release Workflow](#release-workflow)
- [Dependency Management](#dependency-management)
    - [ESLint Version Strategy](#eslint-version-strategy)
    - [Dependabot Configuration](#dependabot-configuration)

## Repository Setup

### Required Secrets

For automated publishing, you'll need to set up the following GitHub repository secrets:

1. `VSCE_PAT`: Personal Access Token from https://marketplace.visualstudio.com/manage
    - Required for publishing to VS Code Marketplace
    - Generate with "Marketplace" → "Manage publishers & extensions" scope

### Branch Protection

Consider enabling branch protection for `main`:

- Require pull request reviews
- Require status checks (CI workflow)
- Require branches to be up to date

## Publishing

### Managing README Images

When VS Code extensions are packaged with `vsce`, relative image paths don't work in the extension viewer. Use the provided script to handle this.

#### Using the Image Conversion Script

```bash
# Convert to GitHub URLs (before publishing)
./update-readme-images.sh --remote

# Convert back to relative paths (for local development)
./update-readme-images.sh --local

# Preview changes without applying
./update-readme-images.sh --remote --dry-run

# Use a different branch
./update-readme-images.sh --remote --branch=master
```

#### Publishing Workflow with Images

1. During development, use relative paths:

    ```markdown
    ![Screenshot](images/screenshot.png)
    ```

2. Before publishing, convert to absolute URLs:

    ```bash
    ./update-readme-images.sh --remote
    npx vsce package
    ```

3. To continue development, convert back:
    ```bash
    ./update-readme-images.sh --local
    ```

### Creating a New Release

To create a new release with GitHub Actions:

1. **Update version in package.json**

    ```bash
    # Edit package.json and update the version field
    # Example: "version": "1.2.0" → "version": "1.2.1"
    ```

2. **Update CHANGELOG.md** with release notes

3. **Commit version bump**

    ```bash
    git add package.json CHANGELOG.md
    git commit -m "chore: bump version to 1.2.1"
    git push origin main
    ```

4. **Create and push version tag**

    ```bash
    git tag v1.2.1
    git push origin v1.2.1
    ```

5. **GitHub Actions will automatically**:
    - Build the extension
    - Run quality checks (lint, format, compile)
    - Create a GitHub release
    - Attach the VSIX file to the release

### Manual Publishing to VS Code Marketplace

If automated publishing isn't set up or you prefer manual control:

#### From GitHub Release

1. Download the VSIX file from the GitHub release
2. Install vsce: `npm install -g @vscode/vsce`
3. Publish: `vsce publish -p YOUR_PERSONAL_ACCESS_TOKEN`

#### From Source

1. Ensure version is updated in package.json
2. Convert images: `./update-readme-images.sh --remote`
3. Package: `vsce package`
4. Test .vsix locally
5. Publish: `vsce publish`
6. Convert images back: `./update-readme-images.sh --local`

### Pre-release Checklist

- [ ] Version bumped in package.json following SemVer
- [ ] CHANGELOG.md updated with release notes
- [ ] README.md reviewed for accuracy
- [ ] All CI checks pass (`npm run lint`, `npm run format:check`)
- [ ] Manual testing completed
- [ ] Icon file (128x128 PNG) present
- [ ] Convert README images to absolute URLs: `./update-readme-images.sh --remote`

## CI/CD Configuration

### Setting up Automated Publishing

To enable automatic marketplace publishing:

1. **Generate a Personal Access Token**
    - Visit https://marketplace.visualstudio.com/manage
    - Create token with "Marketplace" scope
    - Copy the token (you won't see it again)

2. **Add to Repository Secrets**
    - Go to Settings → Secrets → Actions
    - Create new secret named `VSCE_PAT`
    - Paste your token

3. **Enable Release Workflow**
    - The workflow triggers on version tags
    - Example: `git tag v1.0.0 && git push --tags`

### Release Workflow

The release workflow (`release.yml`):

- Triggers on tags matching `v*`
- Builds on Ubuntu (most efficient)
- Creates GitHub release with VSIX artifact
- Optionally publishes to marketplace if `VSCE_PAT` is set

## Dependency Management

### ESLint Version Strategy

This project intentionally uses ESLint v8 with traditional configuration (`.eslintrc.json`).

**Current versions:**

- `eslint`: ^8.28.0
- `@typescript-eslint/parser`: ^5.45.0
- `@typescript-eslint/eslint-plugin`: ^5.45.0

**Why the project stays on v8:**

- ESLint v9 requires complete config rewrite to flat format
- Many VS Code extensions still use v8 successfully
- Current setup is stable and well-tested
- Migration offers no immediate benefits

**When to consider upgrading:**

- When TypeScript ESLint fully supports v9
- When most VS Code extensions have migrated
- When there's a compelling feature in v9

### Dependabot Configuration

The `.github/dependabot.yml` file is configured to:

- Check weekly for updates
- Limit to 3 open PRs
- Ignore ESLint v9 major updates

To modify Dependabot behavior:

```yaml
version: 2
updates:
    - package-ecosystem: 'npm'
      directory: '/'
      schedule:
          interval: 'monthly' # Change frequency
      open-pull-requests-limit: 3
      ignore:
          - dependency-name: 'eslint'
            versions: ['9.x'] # Ignore v9
```

## Monitoring

### Extension Metrics

Monitor your extension's performance:

- VS Code Marketplace statistics
- GitHub issues and discussions
- User reviews and ratings

### Common Issues to Watch

1. **Performance**: Large .gitignore files
2. **Compatibility**: New VS Code versions
3. **Git Integration**: Different Git configurations

## Emergency Procedures

### Rolling Back a Release

If a release has critical issues:

1. **Unpublish from Marketplace** (if severe)

    ```bash
    vsce unpublish bulletinmybeard.gitignore-guard [version]
    ```

2. **Create Fix**
    - Branch from last known good tag
    - Apply minimal fix
    - Test thoroughly

3. **Release Patch**
    - Bump patch version
    - Follow normal release process
    - Communicate with users via GitHub

### Security Issues

For security vulnerabilities:

1. Do not publicly disclose details
2. Fix in private branch
3. Release patch immediately
4. Then disclose with fix available

## Notes

- Always test manually before releasing
- Keep CHANGELOG.md updated for users
- Monitor GitHub issues after releases
- Consider beta releases for major changes
