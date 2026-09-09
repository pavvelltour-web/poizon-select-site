#!/usr/bin/env python3
"""Hash-locked wrapper around the existing trainer builder; never publishes.

Without --write, validates inputs only. With --write, creates review candidates
and a provenance report. A passing pixel check is not visual approval.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

WORKSPACE = Path(__file__).resolve().parents[2]
DEFAULT_MEDIA_ROOT = WORKSPACE / '.codex-worktrees/catalog-media-20260908'
ALLOWED = {'source-candidate', 'official-source-candidate',
           'generated-source-candidate', 'reviewed-isolation-candidate'}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def frames_from(data: dict, selection: str) -> list[dict]:
    if 'frames' in data:
        return data['frames']
    products = data.get(selection, data.get('products'))
    if products is None:
        raise ValueError('manifest needs frames, products, or selected inventory list')
    return [dict(frame, slug=product['slug'], product_ref=product.get('product_ref'),
                 source_audit=product.get('source_audit'))
            for product in products for frame in product['frames']]


def background_check(path: Path, frame: dict) -> dict:
    """Read-only guard; background subtraction remains in existing cutout()."""
    with Image.open(path) as opened:
        image = ImageOps.exif_transpose(opened).convert('RGBA')
    if frame.get('crop_box'):
        if not frame.get('crop_review_evidence'):
            raise ValueError('crop requires existing complete-subject review evidence')
        image = image.crop(tuple(frame['crop_box']))
    values = np.asarray(image)
    alpha = values[:, :, 3]
    if np.count_nonzero(alpha < 255) >= max(1, image.width * image.height // 100):
        return {'kind': 'source-alpha', 'source_dimensions': list(image.size)}
    rgb = values[:, :, :3].astype(np.int16)
    border = np.concatenate((rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]))
    key = np.median(border, axis=0)
    tolerance = frame.get('background_tolerance', 8)
    if type(tolerance) is not int or not 0 <= tolerance <= 16:
        raise ValueError('background_tolerance outside reviewed neutral-studio range 0..16')
    max_deviation = int(np.max(np.abs(border - key)))
    if int(key.min()) < 225 or int(key.max() - key.min()) > 10:
        raise ValueError('non-neutral source backdrop requires manual QA')
    if max_deviation > max(8, tolerance):
        raise ValueError(f'nonuniform/clipped source border deviation {max_deviation}; manual QA required')
    return {'kind': 'border-connected-neutral', 'source_dimensions': list(image.size),
            'border_rgb': [int(v) for v in key], 'border_max_deviation': max_deviation,
            'background_tolerance': tolerance}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', required=True, type=Path)
    parser.add_argument('--media-root', type=Path, default=DEFAULT_MEDIA_ROOT)
    parser.add_argument('--selection', default='preferred_products')
    parser.add_argument('--slug', action='append', default=[])
    parser.add_argument('--output-dir', type=Path, default=Path(__file__).parent / 'normalized')
    parser.add_argument('--report', type=Path)
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    media_root = args.media_root.resolve()
    sys.path.insert(0, str(media_root / 'scripts'))
    import build_trainer_media as trainer

    output_root = args.output_dir.resolve()
    if output_root == media_root or output_root.is_relative_to(media_root / 'public'):
        raise ValueError('output must be candidate staging, never public assets')
    manifest = args.manifest.resolve()
    data = json.loads(manifest.read_text(encoding='utf-8-sig'))
    frames = frames_from(data, args.selection)
    if args.slug:
        missing = set(args.slug) - {f['slug'] for f in frames}
        if missing:
            raise ValueError(f'unknown requested slugs: {sorted(missing)}')
        frames = [f for f in frames if f['slug'] in args.slug]
    pairs = [(f['slug'], f['position']) for f in frames]
    if len(pairs) != len(set(pairs)):
        raise ValueError('duplicate slug/position')
    report_path = args.report or output_root.parent / 'normalization-report.json'
    report = {'schema_version': 1, 'generated_at': datetime.now(UTC).isoformat(),
              'status': 'review-candidates-created' if args.write else 'inputs-validated-dry-run',
              'manifest_path': str(manifest), 'manifest_sha256': sha256(manifest),
              'builder_path': str(media_root / 'scripts/build_trainer_media.py'),
              'builder_sha256': sha256(media_root / 'scripts/build_trainer_media.py'),
              'normalizer_sha256': sha256(Path(__file__)), 'frames': [], 'errors': [], 'skipped': [],
              'visual_approvals_created': 0, 'published': False}
    for frame in frames:
        slug, position = frame['slug'], frame['position']
        item = {'slug': slug, 'position': position, 'input': frame,
                'visual_review_status': 'pending', 'published': False}
        try:
            if not slug or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in slug):
                raise ValueError('unsafe slug')
            if type(position) is not int or position not in range(1, 6):
                raise ValueError('position must be 1..5')
            if frame.get('angle', trainer.ANGLES[position - 1]) != trainer.ANGLES[position - 1]:
                raise ValueError('angle does not match canonical position')
            if frame.get('source_completeness_hold') or frame.get('status', 'source-candidate') not in ALLOWED:
                report['skipped'].append(item)
                continue
            source = frame.get('source', frame)
            path_value = frame.get('source_path') or source.get('source_download_path')
            source_path = Path(path_value)
            if not source_path.is_absolute():
                source_path = media_root / source_path
            source_path = source_path.resolve()
            expected_hash = source['source_sha256']
            if sha256(source_path) != expected_hash:
                raise ValueError('source hash mismatch')
            if frame.get('mirror'):
                raise ValueError('mirroring prohibited')
            rotation = frame.get('rotation_degrees_ccw', 0)
            if type(rotation) is not int or rotation not in (-180, -90, 0, 90, 180, 270):
                raise ValueError('rotation must be an explicit reviewed quarter-turn')
            item.update(source_path=str(source_path), source_sha256=expected_hash,
                        source_verified=True, rotation_degrees_ccw=rotation,
                        pixel_checks_passed=None)
            if args.write:
                item['source_background_analysis'] = background_check(source_path, frame)
                subject = trainer.cutout(source_path, frame)
                output_path = output_root / slug / f'{position}.webp'
                if output_path.resolve() == source_path:
                    raise ValueError('source overwrite prohibited')
                rendered = trainer.render(trainer.fit_subject(subject, trainer.SPECS[position - 1]))
                trainer.save(rendered, output_path)
                checks = trainer.measure(output_path, position)
                item.update(output_path=str(output_path), output_sha256=checks['sha256'],
                            output_bytes=checks['bytes'], output_dimensions=checks['dimensions'],
                            pixel_checks_passed=checks['pixel_checks_passed'], pixel_checks=checks)
            report['frames'].append(item)
            print(f"{slug} F{position}: {'pixels-pass' if item['pixel_checks_passed'] else ('pixels-review' if args.write else 'input-verified')}", flush=True)
        except (ValueError, OSError, KeyError, TypeError) as error:
            report['errors'].append(dict(item, error=str(error), manual_qa_required=True))
            print(f'{slug} F{position}: REJECTED {error}', flush=True)
        if args.write:
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    report['completed_at'] = datetime.now(UTC).isoformat()
    report['processed_count'] = len(report['frames'])
    report['error_count'] = len(report['errors'])
    report['pixel_pass_count'] = sum(f['pixel_checks_passed'] is True for f in report['frames'])
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k not in ('frames', 'errors', 'skipped')}, indent=2))
    raise SystemExit(1 if report['errors'] else 0)


if __name__ == '__main__':
    main()
