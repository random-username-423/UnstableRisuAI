import os
import re

UTILS_DIR = os.path.join('src', 'ts', 'utils')

def process_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        return

    new_content = content
    
    # Regex to find imports
    # We want to change:
    # 1. "./XYZ" -> "../XYZ"  (Assuming XYZ is not in utils, which is mostly true as we moved utils together)
    #    BUT we must check if XYZ is one of the moved files.
    #    If importing "./util", and both are in utils, it should remain "./util".
    # 2. "../XYZ" -> "../../XYZ"
    
    # List of files that are NOW in utils (without extension)
    UTILS_FILES = [
        'util', 'fetch', 'env', 'polyfill', 'loggen', 'alert', 
        'voice', 'tokenizer', 'update', 'parser.svelte', 'observer.svelte'
    ]

    def replace_import(match):
        quote = match.group(1)
        path = match.group(2)
        
        # Case 1: Absolute imports (src/...) - No change needed usually, 
        # unless they pointed to 'src/ts/util.ts' which we already fixed in previous step.
        if path.startswith('src/'):
            return match.group(0)
            
        # Case 2: "../" prefix
        if path.startswith('../'):
            # "../lang" -> "../../lang"
            return f'from {quote}..{path}{quote}'
            
        # Case 3: "./" prefix
        if path.startswith('./'):
            # Check if it points to a sibling in utils
            # path is like "./util" or "./data/storage..." (wait, old path wouldn't have data/storage)
            
            # Clean path
            clean_path = path[2:] # remove ./
            first_part = clean_path.split('/')[0]
            
            # Remove extension if any for comparison
            if first_part.endswith('.ts') or first_part.endswith('.js') or first_part.endswith('.svelte'):
                name_check = first_part.rsplit('.', 1)[0]
            else:
                name_check = first_part

            if name_check in UTILS_FILES:
                # It's a sibling in utils, keep as ./
                return match.group(0)
            else:
                # It was a sibling in ts (e.g. stores.svelte), now it's in parent
                # "./stores.svelte" -> "../stores.svelte"
                return f'from {quote}.{path}{quote}'

        return match.group(0)

    # We need a robust regex
    # Matches: from "..." or from '...' 
    # Also: import "..." or import '...' (side-effect imports)
    
    # Strategy: Split lines, process import lines
    lines = new_content.split('\n')
    new_lines = []
    
    for line in lines:
        if ('import ' in line or 'export ' in line) and ('from' in line or 'import(' in line):
            # Regex to capture the path inside quotes
            # We use a lambda to process the path
            
            # Pattern: ("|')(.*?)("|')
            # We only want to touch lines that look like imports
            
            def replacer(m):
                q1 = m.group(1)
                p = m.group(2)
                q2 = m.group(3)
                
                if p.startswith('src/'): return f'{q1}{p}{q2}'
                
                # Logic for relative paths
                if p.startswith('../'):
                    return f'{q1}..{p}{q2}' # Add one level up
                
                if p.startswith('./'):
                    # Check sibling
                    clean = p[2:]
                    parts = clean.split('/')
                    first = parts[0]
                    name = first.split('.')[0] # simple check
                    
                    # Special case for svelte files which might have .svelte extension
                    if first.endswith('.svelte'):
                        name = first[:-7] # remove .svelte
                    
                    # Also handle files that were moved to utils
                    # If importing a file that is now in utils, keep ./
                    # BUT wait, did we update the import paths IN these files to point to utils?
                    # No, they were moved, so their content remained same.
                    # So "import ... from './util'" in "alert.ts" (both moved) matches.
                    
                    if name in UTILS_FILES:
                        return f'{q1}{p}{q2}' # Keep ./
                    else:
                        return f'{q1}.{p}{q2}' # Change ./ to ../
                        
                return f'{q1}{p}{q2}'

            # Apply replacement to strings in the line
            # Be careful not to replace non-path strings
            # We assume paths start with . or src/ inside import lines
            
            # This regex matches quoted strings that start with . or src/
            line = re.sub(r'("|")(\.\./[^"\\]*)("|\')', replacer, line)
            line = re.sub(r'("|")(src/[^"\\]*)("|\')', replacer, line)

        new_lines.append(line)

    new_content = '\n'.join(new_lines)

    if new_content != content:
        print(f"Fixed: {file_path}")
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

def main():
    if not os.path.exists(UTILS_DIR):
        print("Utils dir not found")
        return
        
    for file in os.listdir(UTILS_DIR):
        if file.endswith('.ts') or file.endswith('.svelte') or file.endswith('.js'):
            process_file(os.path.join(UTILS_DIR, file))

if __name__ == '__main__':
    main()
