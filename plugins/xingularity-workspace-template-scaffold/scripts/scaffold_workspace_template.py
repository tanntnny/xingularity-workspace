#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

IGNORED_STARTER_ENTRIES = {'node_modules', 'out', 'dist', '.DS_Store'}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Scaffold a new workspace app from the Xingularity workspace template package.'
    )
    parser.add_argument('target_dir', help='Directory to create or update with the starter app.')
    parser.add_argument(
        '--force',
        action='store_true',
        help='Allow scaffolding into an existing non-empty target directory.'
    )
    return parser.parse_args()


def copy_children(source_dir: Path, target_dir: Path) -> None:
    for child in source_dir.iterdir():
        if child.name in IGNORED_STARTER_ENTRIES or child.suffix == '.tsbuildinfo':
            continue
        destination = target_dir / child.name
        if child.is_dir():
            shutil.copytree(child, destination, dirs_exist_ok=True)
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(child, destination)


def rewrite_scaffold_files(target_dir: Path) -> None:
    package_json_path = target_dir / 'package.json'
    if not package_json_path.exists():
        raise FileNotFoundError(f'Missing starter package.json at {package_json_path}')

    payload = json.loads(package_json_path.read_text(encoding='utf-8'))
    dependencies = payload.setdefault('dependencies', {})
    dependencies['@xingularity/workspace-template'] = 'file:./packages/workspace-template'
    package_json_path.write_text(f'{json.dumps(payload, indent=2)}\n', encoding='utf-8')

    tsconfig_web_path = target_dir / 'tsconfig.web.json'
    if tsconfig_web_path.exists():
        tsconfig_payload = json.loads(tsconfig_web_path.read_text(encoding='utf-8'))
        compiler_options = tsconfig_payload.setdefault('compilerOptions', {})
        paths = compiler_options.setdefault('paths', {})
        paths['@xingularity/workspace-template'] = ['./packages/workspace-template/src/index.ts']
        tsconfig_payload['include'] = [
            'src/vite-env.d.ts',
            'src/**/*.ts',
            'src/**/*.tsx',
            'src/preload/*.d.ts',
            'packages/workspace-template/src/**/*',
        ]
        tsconfig_web_path.write_text(f'{json.dumps(tsconfig_payload, indent=2)}\n', encoding='utf-8')

    tailwind_config_path = target_dir / 'tailwind.config.cjs'
    if tailwind_config_path.exists():
        tailwind_source = tailwind_config_path.read_text(encoding='utf-8')
        tailwind_source = tailwind_source.replace(
            "../src/**/*.{ts,tsx}",
            "./packages/workspace-template/src/**/*.{ts,tsx}",
        )
        tailwind_config_path.write_text(tailwind_source, encoding='utf-8')

    electron_vite_config_path = target_dir / 'electron.vite.config.ts'
    if electron_vite_config_path.exists():
        electron_vite_source = electron_vite_config_path.read_text(encoding='utf-8')
        electron_vite_source = electron_vite_source.replace(
            "../styles/workspace.css",
            "./packages/workspace-template/styles/workspace.css",
        )
        electron_vite_source = electron_vite_source.replace(
            "../src/index.ts",
            "./packages/workspace-template/src/index.ts",
        )
        electron_vite_config_path.write_text(electron_vite_source, encoding='utf-8')


def main() -> None:
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[3]
    package_root = repo_root / 'packages' / 'workspace-template'
    starter_root = package_root / 'starter'
    target_dir = Path(args.target_dir).expanduser().resolve()

    if not package_root.exists():
        raise FileNotFoundError(f'Workspace template package not found: {package_root}')
    if not starter_root.exists():
        raise FileNotFoundError(f'Workspace starter not found: {starter_root}')

    target_dir.mkdir(parents=True, exist_ok=True)
    if any(target_dir.iterdir()) and not args.force:
        raise SystemExit(
            f'Target directory is not empty: {target_dir}\n'
            'Re-run with --force if overwriting is intentional.'
        )

    copy_children(starter_root, target_dir)

    package_destination = target_dir / 'packages' / 'workspace-template'
    package_destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(
        package_root,
        package_destination,
        dirs_exist_ok=True,
        ignore=shutil.ignore_patterns('starter', 'dist', 'node_modules', '*.tsbuildinfo')
    )

    rewrite_scaffold_files(target_dir)

    print(f'Scaffolded workspace starter at: {target_dir}')
    print('Next steps:')
    print('  npm install')
    print('  npm run dev')


if __name__ == '__main__':
    main()
