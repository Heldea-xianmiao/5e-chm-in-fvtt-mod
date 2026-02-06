import os
import re
import sys

# TARGET DIRECTORY
TARGET_DIR = 'chm'

# Regex to find charset declarations
CHARSET_RE = re.compile(r'charset\s*=\s*["\']?(gb2312|gbk)["\']?', re.IGNORECASE)

def convert_file(filepath):
    try:
        with open(filepath, 'rb') as f:
            raw_data = f.read()
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return

    # Try to determine if it needs conversion
    try:
        # Try decoding as GB18030 (handles GBK and GB2312)
        content_gbk = raw_data.decode('gb18030')
        
        # Check if it claims to be GBK/GB2312
        if CHARSET_RE.search(content_gbk):
            print(f"Converting: {filepath} (Detected GBK/GB2312)")
            
            # Replace charset declaration
            new_content = CHARSET_RE.sub('charset=UTF-8', content_gbk)
            
            # Fix broken meta tags if quotes are missing (common issue in this dataset)
            # Fix: charset=UTF-8> -> charset=UTF-8">
            new_content = re.sub(r'charset=UTF-8\s*>', 'charset=UTF-8">', new_content, flags=re.IGNORECASE)
            # Fix: charset=UTF-8 http -> charset=UTF-8" http
            new_content = re.sub(r'charset=UTF-8\s+http-equiv', 'charset=UTF-8" http-equiv', new_content, flags=re.IGNORECASE)
            
            # Write back as UTF-8
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            return
        
        # Check if it is already UTF-8 but has wrong meta or just ensure consistence
        try:
            content_utf8 = raw_data.decode('utf-8')
            # It's already valid UTF-8. 
            if CHARSET_RE.search(content_utf8):
                print(f"Fixing Meta: {filepath} (Is UTF-8 but claims GBK)")
                new_content = CHARSET_RE.sub('charset=UTF-8', content_utf8)
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
            return 
        except UnicodeDecodeError:
            # Failed UTF-8 but passed GB18030 -> It is GBK without charset tag
            print(f"Converting: {filepath} (Valid GB18030, invalid UTF-8)")
            new_content = content_gbk
            new_content = CHARSET_RE.sub('charset=UTF-8', new_content)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            return

    except UnicodeDecodeError:
        print(f"Skipping: {filepath} (Could not decode as GB18030)")
        return

def main():
    print(f"Scanning directory: {TARGET_DIR} ...")
    count = 0
    for root, dirs, files in os.walk(TARGET_DIR):
        for file in files:
            if file.lower().endswith(('.html', '.htm')):
                filepath = os.path.join(root, file)
                convert_file(filepath)
                count += 1
    print("Encoding fix complete.")

if __name__ == "__main__":
    main()
