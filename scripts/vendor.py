#!/usr/bin/env python3
"""Verify pinned assets, or restore them from integrity-checked upstream packages."""
import argparse
import base64
import hashlib
import io
import json
from pathlib import Path
import tarfile
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = json.loads((ROOT / 'vendor/manifest.json').read_text())


def digest(data):
    return hashlib.sha256(data).hexdigest()


def verify():
    assets = dict(MANIFEST['assets'])
    assets['styles-base.css'] = MANIFEST['base_style']['sha256']
    for name, expected in assets.items():
        actual = digest((ROOT / name).read_bytes())
        if actual != expected:
            raise SystemExit('Integrity mismatch: ' + name)
    print(f'Verified {len(assets)} pinned assets')


def restore():
    for package in MANIFEST['packages'].values():
        with urlopen(package['url'], timeout=30) as response:
            data = response.read()
        algorithm, expected = package['integrity'].split('-', 1)
        actual = base64.b64encode(hashlib.new(algorithm, data).digest()).decode()
        if actual != expected:
            raise SystemExit('Package integrity mismatch: ' + package['url'])
        with tarfile.open(fileobj=io.BytesIO(data)) as archive:
            for name in package['files']:
                source = name['source'] if isinstance(name, dict) else name
                output = name['target'] if isinstance(name, dict) else 'vendor/' + Path(name).name
                artifact = archive.extractfile('package/' + source).read()
                if digest(artifact) != MANIFEST['assets'][output]:
                    raise SystemExit('Artifact integrity mismatch: ' + output)
                (ROOT / output).parent.mkdir(parents=True, exist_ok=True)
                (ROOT / output).write_bytes(artifact)
    with urlopen(MANIFEST['base_style']['url'], timeout=30) as response:
        data = response.read()
    if digest(data) != MANIFEST['base_style']['sha256']:
        raise SystemExit('Base stylesheet integrity mismatch')
    (ROOT / 'styles-base.css').write_bytes(data)
    verify()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--restore', action='store_true', help='Download pinned packages using TLS and verify before replacing assets')
    args = parser.parse_args()
    restore() if args.restore else verify()
