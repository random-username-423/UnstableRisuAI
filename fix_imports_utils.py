import os

# Target FILES that were moved to src/ts/utils
# We need to match import paths that end with these names
TARGET_FILES = [
    'util', 'fetch', 'env', 'polyfill', 'loggen', 'alert', 
    'voice', 'tokenizer', 'update', 'parser.svelte', 'observer.svelte'
]

UTILS_DIR_ABS = os.path.abspath(os.path.join('src', 'ts', 'utils'))

def should_update_relative_import(file_path, import_path):
    # Resolve the absolute path of the imported file
    file_dir = os.path.dirname(file_path)
    try:
        if not import_path.startswith('.'):
            return None

        # import_path example: "./util" or "../util"
        parts = import_path.split('/')
        last_part = parts[-1]
        
        # Check if the imported file is one of our targets
        # The import might be "util" or "util.ts" (rare in imports)
        target_name = last_part
        if target_name.endswith('.ts'):
            target_name = target_name[:-3]
            
        if target_name not in TARGET_FILES:
            return None
            
        # Logic:
        # 1. If file is OUTSIDE src/ts/utils:
        #    References to "./util" or "../util" -> "./utils/util" or "../utils/util"
        # 2. If file is INSIDE src/ts/utils:
        #    References to "./util" or "../util" -> NO CHANGE (siblings)
        
        is_file_in_utils = file_path.startswith(UTILS_DIR_ABS)
        
        if not is_file_in_utils:
            # We need to inject 'utils/' before the target file name
            # BUT we have to be careful about the path structure.
            # e.g. import { x } from "./util" (in src/ts/main.ts)
            # -> import { x } from "./utils/util"
            
            # e.g. import { x } from "../util" (in src/ts/process/chat.ts)
            # -> import { x } from "../utils/util"
            
            # e.g. import { x } from "../../util" (in src/ts/process/request/api.ts)
            # -> import { x } from "../../utils/util"
            
            # Simply inserting 'utils' before the last part seems correct
            new_parts = parts[:-1] + ['utils'] + [parts[-1]]
            return '/'.join(new_parts)
            
        else:
            # File is INSIDE src/ts/utils.
            # Importing another util file (sibling).
            # e.g. import { x } from "./env"
            # No change needed.
            
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
    # src/ts/util -> src/ts/utils/util
    for target in TARGET_FILES:
        old_abs = f'src/ts/{target}'
        new_abs = f'src/ts/utils/{target}'
        
        # We need to match exact word boundary or quote to avoid partial matches
        # e.g. "src/ts/utility" should not match "src/ts/util"
        # But python replace is simple string replacement.
        
        # Simple hack: check for quotes
        if f'"{old_abs}"' in new_content:
            new_content = new_content.replace(f'"{old_abs}"', f'"{new_abs}"')
            changed = True
        if f"'{old_abs}'" in new_content:
            new_content = new_content.replace(f"'{old_abs}'", f"'{new_abs}'")
            changed = True
        if f'"{old_abs}/' in new_content: # for directories if any
            new_content = new_content.replace(f'"{old_abs}/', f'"{new_abs}/')
            changed = True
        if f"'{old_abs}/" in new_content:
            new_content = new_content.replace(f"'{old_abs}/", f"'{new_abs}/")
            changed = True

    # 2. Fix Relative Imports
    lines = new_content.split('\n')
    new_lines = []
    
    for line in lines:
        if ('import ' in line or 'export ' in line) and ('from' in line or 'import(' in line):
            import_path = None
            quote_char = None
            
            if '"' in line:
                parts = line.split('"')
                if len(parts) > 2:
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
                    file_abs_path = os.path.abspath(file_path)
                    new_import = should_update_relative_import(file_abs_path, import_path)
                    if new_import:
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
