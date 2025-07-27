#!/bin/bash

# Script to convert between local and remote image paths in README.md
# Usage: ./update-readme-images.sh [--remote|--local] [--dry-run] [--branch=master]

set -e

# Default values
MODE=""
DRY_RUN=false
BRANCH="master"
BACKUP=true

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --remote)
            MODE="remote"
            shift
            ;;
        --local)
            MODE="local"
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --branch=*)
            BRANCH="${1#*=}"
            shift
            ;;
        --no-backup)
            BACKUP=false
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--remote|--local] [--dry-run] [--branch=master] [--no-backup]"
            echo ""
            echo "Options:"
            echo "  --remote     Convert relative paths to GitHub raw URLs"
            echo "  --local      Convert GitHub URLs back to relative paths"
            echo "  --dry-run    Preview changes without applying them"
            echo "  --branch=    Specify branch name (default: master)"
            echo "  --no-backup  Don't create backup file"
            echo ""
            echo "Examples:"
            echo "  $0 --remote                  # Convert to GitHub URLs"
            echo "  $0 --local                   # Convert to relative paths"
            echo "  $0 --remote --dry-run        # Preview remote conversion"
            echo "  $0 --remote --branch=master  # Use master branch"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Check if mode is specified
if [ -z "$MODE" ]; then
    echo "Error: Please specify --remote or --local"
    echo "Use --help for usage information"
    exit 1
fi

# Check if README.md exists
if [ ! -f "README.md" ]; then
    echo "Error: README.md not found in current directory"
    exit 1
fi

# Check if package.json exists and extract repository URL
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found in current directory"
    exit 1
fi

# Extract repository URL from package.json
REPO_URL=$(grep -o '"url":[[:space:]]*"[^"]*"' package.json | head -1 | cut -d'"' -f4)

if [ -z "$REPO_URL" ]; then
    echo "Error: No repository URL found in package.json"
    echo "Please add a repository field to package.json:"
    echo '  "repository": {'
    echo '    "type": "git",'
    echo '    "url": "https://github.com/bulletinmybeard/vscode-gitignore-guard"'
    echo '  }'
    exit 1
fi

# Extract GitHub username and repo name from URL
# Handle both https://github.com/user/repo and git@github.com:user/repo.git formats
if [[ $REPO_URL =~ github\.com[:/]([^/]+)/([^/.]+)(\.git)?$ ]]; then
    GITHUB_USER="${BASH_REMATCH[1]}"
    GITHUB_REPO="${BASH_REMATCH[2]}"
else
    echo "Error: Could not parse GitHub repository from URL: $REPO_URL"
    exit 1
fi

echo "Repository: $GITHUB_USER/$GITHUB_REPO"
echo "Branch: $BRANCH"
echo "Mode: Converting to $MODE paths"
echo ""

# Create backup if requested
if [ "$BACKUP" = true ] && [ "$DRY_RUN" = false ]; then
    cp README.md README.md.bak
    echo "Backup created: README.md.bak"
fi

# Prepare the base URL for remote mode
BASE_URL="https://raw.githubusercontent.com/$GITHUB_USER/$GITHUB_REPO/$BRANCH"

# Create temporary file for processing
TMP_FILE=$(mktemp)
cp README.md "$TMP_FILE"

# Counter for changes
CHANGES=0

# Function to process the file
process_file() {
    local input_file=$1
    local output_file=$2
    
    if [ "$MODE" = "remote" ]; then
        # Convert relative paths to absolute GitHub URLs
        # Pattern 1: ![alt](images/...)
        perl -pe "s|!\[([^\]]*)\]\((?:\./)?images/([^)]+)\)|![\1]($BASE_URL/images/\2)|g" "$input_file" > "$output_file.1"
        
        # Pattern 2: Handle already partially absolute URLs that might have wrong branch
        perl -pe "s|!\[([^\]]*)\]\(https://raw\.githubusercontent\.com/[^/]+/[^/]+/[^/]+/images/([^)]+)\)|![\1]($BASE_URL/images/\2)|g" "$output_file.1" > "$output_file.2"
        
        # Pattern 3: HTML img tags with relative paths
        perl -pe "s|<img[^>]+src=\"(?:\./)?images/([^\"]+)\"|<img src=\"$BASE_URL/images/\1\"|g" "$output_file.2" > "$output_file"
        
        rm -f "$output_file.1" "$output_file.2"
    else
        # Convert absolute GitHub URLs back to relative paths
        # Pattern 1: ![alt](https://raw.githubusercontent.com/.../images/...)
        perl -pe "s|!\[([^\]]*)\]\(https://raw\.githubusercontent\.com/[^/]+/[^/]+/[^/]+/images/([^)]+)\)|![\1](images/\2)|g" "$input_file" > "$output_file.1"
        
        # Pattern 2: HTML img tags with absolute URLs
        perl -pe "s|<img[^>]+src=\"https://raw\.githubusercontent\.com/[^/]+/[^/]+/[^/]+/images/([^\"]+)\"|<img src=\"images/\1\"|g" "$output_file.1" > "$output_file"
        
        rm -f "$output_file.1"
    fi
}

# Process the file
process_file "$TMP_FILE" "$TMP_FILE.processed"

# Count changes
if [ "$MODE" = "remote" ]; then
    # Count conversions to remote
    CHANGES=$(grep -E "!\[.*\]\((https://raw\.githubusercontent\.com|images/)" "$TMP_FILE.processed" | grep -c "raw.githubusercontent.com" || true)
else
    # Count conversions to local
    CHANGES=$(grep -E "!\[.*\]\(images/" "$TMP_FILE.processed" | grep -c "images/" || true)
fi

# Show diff if dry run or if there are changes
if [ "$DRY_RUN" = true ] || [ $CHANGES -gt 0 ]; then
    echo "Changes to be made:"
    echo "==================="
    diff -u README.md "$TMP_FILE.processed" || true
    echo ""
    echo "Total image references that will be updated: $CHANGES"
fi

# Apply changes if not dry run
if [ "$DRY_RUN" = false ]; then
    if [ $CHANGES -gt 0 ]; then
        mv "$TMP_FILE.processed" README.md
        echo ""
        echo "✓ README.md updated successfully!"
        echo "  $CHANGES image references converted to $MODE paths"
        
        if [ "$MODE" = "remote" ]; then
            echo ""
            echo "Note: Your repository must be public for the images to display correctly."
            echo "If testing locally, use '--local' to convert back to relative paths."
        fi
    else
        echo ""
        echo "No changes needed - images are already in $MODE format"
    fi
else
    echo ""
    echo "This was a dry run. No files were modified."
    echo "Run without --dry-run to apply changes."
fi

# Cleanup
rm -f "$TMP_FILE" "$TMP_FILE.processed"