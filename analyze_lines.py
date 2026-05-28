import os

def count_lines(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return sum(1 for _ in f)
    except Exception:
        return 0

def analyze():
    project_dir = r"d:\booking engine\ai-based-booking-engine-for-hotels-"
    ignore_dirs = {'node_modules', '.git', 'venv', '__pycache__', 'dist', 'build', '.next'}
    
    large_files = []
    
    for root, dirs, files in os.walk(project_dir):
        dirs[:] = [d for d in dirs if d not in ignore_dirs]
        for file in files:
            filepath = os.path.join(root, file)
            # Skip non-source files (e.g. images) based on extension if needed, but count_lines handles utf-8 exception
            lines = count_lines(filepath)
            if lines > 400:
                rel_path = os.path.relpath(filepath, project_dir)
                large_files.append((rel_path, lines))
                
    large_files.sort(key=lambda x: x[1], reverse=True)
    
    print(f"Total files with >400 lines: {len(large_files)}")
    print("-" * 50)
    for f, l in large_files:
        print(f"{l} lines - {f}")

if __name__ == '__main__':
    analyze()
