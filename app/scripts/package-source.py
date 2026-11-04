"""Package this source checkout without dependencies, secrets, caches or APKs."""
from pathlib import Path
import hashlib
import sys
import zipfile
root = Path(__file__).resolve().parent.parent
name = sys.argv[1] if len(sys.argv) > 1 else 'cue-system-source.zip'
if Path(name).name != name or not name.endswith('.zip'):
    raise ValueError('Supply a simple .zip filename')
output = root / 'artifacts' / name
output.parent.mkdir(exist_ok=True)
skip = {'node_modules', 'dist', '.npm-cache', 'artifacts', '.git', '.gradle', '.test-signing'}
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for path in sorted(root.rglob('*')):
        relative = path.relative_to(root)
        if not path.is_file() or path.is_symlink():
            continue
        if any(part in skip or part.startswith('.portability') for part in relative.parts):
            continue
        if path.name == 'local.properties' or path.suffix in {'.keystore', '.jks', '.apk', '.aab'}:
            continue
        if relative.parts[0] == 'android' and 'build' in relative.parts:
            continue
        archive.write(path, Path('cue-system') / relative)
print(output.name, output.stat().st_size, hashlib.sha256(output.read_bytes()).hexdigest())
