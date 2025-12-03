import os

# Target directories that were moved to src/ts/data
TARGETS = ['storage', 'drive', 'kei', 'sync']
DATA_DIR_ABS = os.path.abspath(os.path.join('src', 'ts', 'data'))

def should_update_relative_import(file_path, import_path):
    """
    Determines if a relative import needs to be updated.
    
    Args:
        file_path: Absolute path of the file containing the import
        import_path: The relative import string (e.g., "./storage/database.svelte")
        
    Returns:
        New import path if update is needed, otherwise None.
    """
    
    # Resolve the absolute path of the imported file
    file_dir = os.path.dirname(file_path)
    try:
        # We only care about the start of the path to check if it points to a target
        # import_path could be "../storage/database.svelte"
        
        if not import_path.startswith('.'):
            return None

        # Normalize the import path to see where it lands
        # We need to handle the fact that import path might not end with .ts
        # But we only care about the DIRECTORY it points to.
        
        # Construct a hypothetical absolute path for the import
        # We don't need the file to actually exist to check the path logic
        resolved_import = os.path.normpath(os.path.join(file_dir, import_path))
        
        # Check if the resolved import is INSIDE one of the TARGET dirs in src/ts/data
        # Since we already moved the folders, the files ACTUALLY reside in src/ts/data/storage/...
        # But the old import path (e.g. "../storage") might still be pointing to the OLD location logic
        # which is now invalid.
        
        # Let's look at the import string itself.
        # If it matches regex `(\.\.?\/)+storage(\/|$)`
        
        parts = import_path.split('/')
        
        # Find the segment that is one of the targets
        target_idx = -1
        for i, part in enumerate(parts):
            if part in TARGETS:
                target_idx = i
                break
        
        if target_idx == -1:
            return None # Not importing our targets
            
        # Verify this is actually referring to the top-level target folder, not some other folder named 'storage'
        # This is hard to be 100% sure without full resolution, but in this project context it's likely unique.
        
        # Logic:
        # 1. If file is OUTSIDE src/ts/data:
        #    Any reference to "../storage" or "./storage" MUST become "../data/storage" or "./data/storage"
        # 2. If file is INSIDE src/ts/data:
        #    References to "../storage" (sibling) are FINE.
        #    References to "../../storage" (parent's sibling) are FINE.
        
        is_file_in_data = file_path.startswith(DATA_DIR_ABS)
        
        if not is_file_in_data:
            # We need to inject 'data/' before the target
            # e.g. "../storage/..." -> "../data/storage/..."
            #      "./storage/..." -> "./data/storage/..."
            
            # Reconstruct the path
            new_parts = parts[:target_idx] + ['data'] + parts[target_idx:]
            return '/'.join(new_parts)
            
        else:
            # File is INSIDE src/ts/data.
            # e.g. src/ts/data/drive/sync.ts
            # importing "../storage/database"
            # This import is VALID because storage is a sibling of drive.
            
            # But wait, what if it was importing from src/ts/process?
            # src/ts/data/drive/sync.ts -> import "../../process/..." (Valid)
            
            # What if it was importing something that WAS moved, using an old relative path?
            # src/ts/drive/sync.ts (Old) importing "../storage/database"
            # src/ts/data/drive/sync.ts (New) importing "../storage/database"
            # Since both moved to data/, their relative relationship is PRESERVED.
            # So files inside data/ don't need relative import updates for siblings!
            
            return None

    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return None

def process_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        return

    new_content = content
    changed = False
    
    # 1. Fix Absolute Imports (Easy)
    # src/ts/storage -> src/ts/data/storage
    for target in TARGETS:
        old_abs = f'src/ts/{target}'
        new_abs = f'src/ts/data/{target}'
        if old_abs in new_content:
            new_content = new_content.replace(old_abs, new_abs)
            changed = True

    # 2. Fix Relative Imports (Harder)
    # We parse line by line to find imports
    lines = new_content.split('\n')
    new_lines = []
    
    for line in lines:
        if ('import ' in line or 'export ' in line) and ('from' in line or 'import(' in line):
            # Extract path inside quotes
            # Simple regex-like extraction
            import_path = None
            quote_char = None
            
            if '"' in line:
                parts = line.split('"')
                if len(parts) > 2:
                    # Handle case where multiple quotes exist? Usually import "path" is simple.
                    # Find the part that looks like a path
                    for i in range(1, len(parts), 2):
                        if parts[i].startswith('.') or parts[i].startswith('src/'):
                            import_path = parts[i]
                            quote_char = '"'
                            break
            
            if not import_path and "'" in line:
                parts = line.split("'")
                if len(parts) > 2:
                    for i in range(1, len(parts), 2):
                         if parts[i].startswith('.') or parts[i].startswith('src/'):
                            import_path = parts[i]
                            quote_char = "'"
                            break
                            
            if import_path:
                if import_path.startswith('.'):
                    # Check relative import
                    file_abs_path = os.path.abspath(file_path)
                    new_import = should_update_relative_import(file_abs_path, import_path)
                    if new_import:
                        # Replace only the path part in the line
                        # Be careful not to replace other things
                        line = line.replace(f'{quote_char}{import_path}{quote_char}', f'{quote_char}{new_import}{quote_char}')
                        changed = True
        
        new_lines.append(line)
    
    if changed:
        print(f"Fixed: {file_path}")
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(new_lines))

def main():
    for root, dirs, files in os.walk('src'):
        for file in files:
            if file.endswith('.ts') or file.endswith('.svelte') or file.endswith('.js'):
                process_file(os.path.join(root, file))

if __name__ == '__main__':
    main()
