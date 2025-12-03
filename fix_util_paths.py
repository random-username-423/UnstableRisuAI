import os

FILE_PATH = os.path.join('src', 'ts', 'utils', 'util.ts')

REPLACEMENTS = [
    ('from "./data', 'from "../data'),
    ('from "./stores', 'from "../stores'),
    ('from "./character', 'from "../character'),
]

def main():
    if not os.path.exists(FILE_PATH):
        print(f"File not found: {FILE_PATH}")
        return

    with open(FILE_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    for old, new in REPLACEMENTS:
        new_content = new_content.replace(old, new)
        
    if new_content != content:
        with open(FILE_PATH, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {FILE_PATH}")
    else:
        print("No changes needed")

if __name__ == '__main__':
    main()
