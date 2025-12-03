import os
import re

# Define the base directory for the scan
BASE_DIR = 'src'

# Mapping of old paths to new paths
# The key is the regex pattern to match the import path
# The value is the replacement string
REPLACEMENTS = [
    # 1. Imports from outside src/ts/data (e.g. from src/lib, src/ts/process)
    # They need to point to src/ts/data/...
    # Pattern: from "src/ts/storage/..." -> "src/ts/data/storage/..."
    # Also handles relative paths like "../storage/..." if the file is in a sibling directory of storage
    
    # Absolute imports starting with src/ts/
    (r'src/ts/storage', 'src/ts/data/storage'),
    (r'src/ts/drive', 'src/ts/data/drive'),
    (r'src/ts/kei', 'src/ts/data/kei'),
    (r'src/ts/sync', 'src/ts/data/sync'),

    # Relative imports from files within src/ts (e.g. src/ts/util.ts)
    # "./storage/..." -> "./data/storage/..."
    (r'\./storage', './data/storage'),
    (r'\./drive', './data/drive'),
    (r'\./kei', './data/kei'),
    (r'\./sync', './data/sync'),

    # Relative imports from files deeper in src/ts (e.g. src/ts/process/...)
    # "../storage/..." -> "../data/storage/..."
    (r'\.\./storage', '../data/storage'),
    (r'\.\./drive', '../data/drive'),
    (r'\.\./kei', '../data/kei'),
    (r'\.\./sync', '../data/sync'),
    
    # Relative imports going two levels up (e.g. src/ts/process/request/...)
    # "../../storage/..." -> "../../data/storage/..."
    (r'\.\./\.\./storage', '../../data/storage'),
    (r'\.\./\.\./drive', '../../data/drive'),
    (r'\.\./\.\./kei', '../../data/kei'),
    (r'\.\./\.\./sync', '../../data/sync'),

    # Relative imports going three levels up (e.g. src/lib/SideBars/LoreBook/LoreBookData.svelte)
    # "../../../ts/storage" -> "../../../ts/data/storage"
    (r'\.\./\.\./\.\./ts/storage', '../../../ts/data/storage'),
    (r'\.\./\.\./\.\./ts/drive', '../../../ts/data/drive'),
    (r'\.\./\.\./\.\./ts/kei', '../../../ts/data/kei'),
    (r'\.\./\.\./\.\./ts/sync', '../../../ts/data/sync'),
]

# Files within src/ts/data DO NOT need their relative imports to each other changed
# if they were already relative. 
# E.g. inside src/ts/data/kei/backup.ts, "import ... from '../storage/database'"
# is still valid because both kei and storage moved to src/ts/data.
# ../storage resolves to src/ts/data/storage.

# However, we need to be careful about files INSIDE the moved directories
# importing things from OUTSIDE that haven't moved.
# Example: src/ts/storage/database.svelte.ts importing "../util"
# Before: src/ts/storage/../util -> src/ts/util
# After: src/ts/data/storage/../util -> src/ts/data/util (WRONG!)
# Should be: "../../util"

# We need a specific pass for files that have MOVED.

MOVED_DIRS = [
    os.path.join('src', 'ts', 'data', 'storage'),
    os.path.join('src', 'ts', 'data', 'drive'),
    os.path.join('src', 'ts', 'data', 'kei'),
    os.path.join('src', 'ts', 'data', 'sync'),
]

def update_imports_in_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError:
        return # Skip binary files

    new_content = content
    
    # Determine if the current file is one of the moved files
    is_moved_file = any(os.path.abspath(file_path).startswith(os.path.abspath(d)) for d in MOVED_DIRS)

    if is_moved_file:
        # Fix imports pointing OUT of the moved directories
        # Logic: If an import starts with "../" and DOES NOT refer to one of the other moved dirs (storage, drive, kei, sync),
        # it likely needs an extra "../".
        
        def fix_moved_file_import(match):
            quote = match.group(1)
            path = match.group(2)
            
            # If it's an absolute import (src/...), leave it alone (or apply the general renaming rules later)
            if path.startswith('src/'):
                return f'from {quote}{path}{quote}'
                
            # If it's a relative import
            if path.startswith('../'):
                # Check if it points to a sibling that also moved
                parts = path.split('/')
                if len(parts) > 1:
                    first_dir = parts[1] # "../storage" -> "storage"
                    if first_dir in ['storage', 'drive', 'kei', 'sync']:
                        return f'from {quote}{path}{quote}' # It's fine, they are neighbors now
                
                # If not pointing to a neighbor, it needs to go up one more level
                return f'from {quote}../{path}{quote}'
            
            return match.group(0)

        # Regex to find imports
        # Look for: from "..." or from '...' or import "..."
        # We simplify to looking for the path string
        
        # Update: simpler approach.
        # If file is in src/ts/data/storage/xyz.ts
        # Old import: "../util" (meant src/ts/util)
        # New location: src/ts/data/storage/xyz.ts
        # "../util" resolves to src/ts/data/util -> WRONG.
        # Needs to be "../../util"
        
        # So for moved files, replace "../" with "../../" UNLESS it is followed by storage/drive/kei/sync
        
        lines = new_content.split('\n')
        fixed_lines = []
        for line in lines:
            # Simple heuristic: look for import/export statements
            if ('import ' in line or 'export ' in line) and ('from' in line or 'import(' in line):
                # Check for "../"
                if '../' in line:
                     # Use regex to identify the path part
                    def replace_relative(m):
                        path = m.group(2)
                        quote = m.group(1)
                        
                        if path.startswith('../'):
                            # check next segment
                            parts = path.split('/')
                            if len(parts) > 1 and parts[1] in ['storage', 'drive', 'kei', 'sync']:
                                return f'{quote}{path}{quote}' # Don't change
                            else:
                                return f'{quote}../{path}{quote}' # Add ../
                        return f'{quote}{path}{quote}'

                    # Replace inside quotes
                    line = re.sub(r'("|\')(\.\./[^"\']*)("|\')', replace_relative, line)
            fixed_lines.append(line)
        new_content = '\n'.join(fixed_lines)

    # Apply general path renaming for ALL files (including the ones we just fixed relative paths for)
    # This handles everyone ELSE pointing TO the moved files.
    
    for old, new in REPLACEMENTS:
        # We need to be careful not to double replace or replace substrings incorrectly.
        # We match exact path prefixes in quotes.
        
        # Regex to match: "old/..." or 'old/...' or "old" or 'old'
        # We escape the old path pattern
        
        # pattern: (["']){safe_old}(/|["'])
        # replace: \1{new}\2
        
        # We need to handle the dot specially in regex
        safe_old = old.replace('.', '\\.')
        
        pattern = f'("|\'){safe_old}(/|"|\')'
        
        def replacement(m):
            # m.group(1) is quote
            # m.group(2) is the character after the match (slash or quote)
            suffix = m.group(2)
            if suffix == '"' or suffix == "'" :
                return f'{m.group(1)}{new}{suffix}'
            else:
                return f'{m.group(1)}{new}/'
        
        new_content = re.sub(pattern, replacement, new_content)

    if new_content != content:
        print(f"Updating {file_path}")
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

def process_directory(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.ts') or file.endswith('.svelte') or file.endswith('.js'):
                file_path = os.path.join(root, file)
                update_imports_in_file(file_path)

process_directory('src')
