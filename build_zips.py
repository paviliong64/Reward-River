import os
import zipfile

public_downloads = os.path.join(os.getcwd(), 'public', 'downloads')
os.makedirs(public_downloads, exist_ok=True)

# Remove old zips first
for f in os.listdir(public_downloads):
    if f.endswith('.zip'):
        os.remove(os.path.join(public_downloads, f))

def add_dir_to_zip(zip_file, source_dir, arcname=''):
    for root, dirs, files in os.walk(source_dir):
        # Skip node_modules, .git, dist, data, downloads, .aistudio, .playwright-cli
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', 'dist', 'data', 'downloads', '.aistudio', '__pycache__', '.playwright-cli']]
        for file in files:
            full_path = os.path.join(root, file)
            # Skip any existing zip or huge temp files
            if file.endswith('.zip') or file.endswith('.png') and 'image_' in file:
                continue
            rel_path = os.path.relpath(full_path, source_dir)
            target_arc = os.path.join(arcname, rel_path) if arcname else rel_path
            zip_file.write(full_path, target_arc)

def add_file_to_zip(zip_file, source_file, target_arc=None):
    if os.path.exists(source_file):
        arc = target_arc if target_arc else os.path.basename(source_file)
        zip_file.write(source_file, arc)

# 1. Full-Stack ZIP
fullstack_zip_path = os.path.join(public_downloads, 'reward-river-fullstack.zip')
with zipfile.ZipFile(fullstack_zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    add_dir_to_zip(zf, 'src', 'src')
    add_dir_to_zip(zf, 'server', 'server')
    add_dir_to_zip(zf, 'public', 'public')
    for f in ['server.ts', 'package.json', 'tsconfig.json', 'vite.config.ts', 'index.html', 'metadata.json', '.env.example', 'README.md', 'firebase-blueprint.json', 'firestore.rules']:
        add_file_to_zip(zf, f)

# 2. Frontend Only ZIP
frontend_zip_path = os.path.join(public_downloads, 'reward-river-frontend.zip')
with zipfile.ZipFile(frontend_zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    add_dir_to_zip(zf, 'src', 'src')
    add_dir_to_zip(zf, 'public', 'public')
    for f in ['package.json', 'tsconfig.json', 'vite.config.ts', 'index.html', 'metadata.json', '.env.example', 'README.md']:
        add_file_to_zip(zf, f)

# 3. Backend Only ZIP
backend_zip_path = os.path.join(public_downloads, 'reward-river-backend.zip')
with zipfile.ZipFile(backend_zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    add_dir_to_zip(zf, 'server', 'server')
    for f in ['server.ts', 'package.json', 'tsconfig.json', '.env.example', 'README.md', 'firebase-blueprint.json', 'firestore.rules']:
        add_file_to_zip(zf, f)

# 4. Admin Portal Package ZIP
admin_zip_path = os.path.join(public_downloads, 'reward-river-admin-portal.zip')
with zipfile.ZipFile(admin_zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    add_file_to_zip(zf, 'src/components/AdminView.tsx', 'AdminView.tsx')
    add_dir_to_zip(zf, 'server', 'server')
    for f in ['package.json', 'tsconfig.json', '.env.example', 'README.md']:
        add_file_to_zip(zf, f)

print("ZIP files re-built cleanly:")
print("- reward-river-fullstack.zip (", os.path.getsize(fullstack_zip_path), "bytes )")
print("- reward-river-frontend.zip (", os.path.getsize(frontend_zip_path), "bytes )")
print("- reward-river-backend.zip (", os.path.getsize(backend_zip_path), "bytes )")
print("- reward-river-admin-portal.zip (", os.path.getsize(admin_zip_path), "bytes )")
