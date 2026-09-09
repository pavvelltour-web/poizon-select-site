"""Local segmentation matte for existing F5 pixels; never alters normalized originals."""
from pathlib import Path
from datetime import datetime, timezone
import argparse
import hashlib
import json
import os
import sys
import time

ROOT = Path(__file__).resolve().parent
os.environ['U2NET_HOME'] = str(ROOT / 'model-cache')
os.environ['NUMBA_CACHE_DIR'] = str(ROOT / 'numba-cache')
os.environ['OMP_NUM_THREADS'] = '4'
sys.path.insert(0, str(ROOT / 'python-deps'))

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', default='isnet-general-use')
    parser.add_argument('--mask-rotation', type=int, default=0)
    parser.add_argument('--auto-mask-orientation', action='store_true')
    parser.add_argument('--slug', action='append', default=[])
    parser.add_argument('--all-held', action='store_true')
    args = parser.parse_args()
    from PIL import Image
    from rembg import new_session, remove
    import numpy as np
    slugs = list(args.slug)
    if args.all_held:
        rejection_files = sorted(set(ROOT.glob('rejections-batch-*.json')) | set(ROOT.glob('rejects-batch-*.json')))
        for file in rejection_files:
            data = json.loads(file.read_text(encoding='utf-8'))
            for row in data.get('products', data.get('frames', data.get('rejected', []))):
                if row.get('slug') and row['slug'] not in slugs:
                    slugs.append(row['slug'])
    if not slugs:
        slugs = ['li-ning-dlo-1-cushioning-slip-resistant-abrasion-resistant-rebound-gr-2adc6fb0', 'nike-cortez-leather-slip-resistant-abrasion-resistant-low-top-casual-7bc18186']
    rotations = {}
    batches = {}
    for file in ROOT.glob('batch-*-plan.json'):
        for product in json.loads(file.read_text(encoding='utf-8'))['products']:
            batches[product['slug']] = file.name
            for frame in product['frames']:
                if frame['position'] == 5:
                    rotations[product['slug']] = -frame.get('rotation_degrees_ccw', 0)
    (ROOT / 'rembg-refinement-queue.json').write_text(json.dumps({'model':args.model,'products':[{'slug':slug,'batch':batches.get(slug),'mask_inference_rotation_ccw':rotations.get(slug,args.mask_rotation) if args.auto_mask_orientation else args.mask_rotation,'output':str(ROOT/'rembg-refined'/slug/'5.webp')} for slug in slugs]},indent=2)+'\n',encoding='utf-8')
    session = new_session(args.model, providers=['CPUExecutionProvider'])
    model_hashes = {str(p.relative_to(ROOT)): sha(p) for p in (ROOT/'model-cache').rglob('*.onnx')}
    for slug in slugs:
        begin = time.monotonic()
        src = ROOT / 'normalized' / slug / '5.webp'
        if not src.is_file():
            print('MISSING', slug, flush=True)
            continue
        outdir = ROOT / 'rembg-refined' / slug
        outdir.mkdir(parents=True, exist_ok=True)
        out = outdir / '5.webp'
        with Image.open(src) as im:
            rgb = im.convert('RGB')
        mask_rotation = rotations.get(slug, args.mask_rotation) if args.auto_mask_orientation else args.mask_rotation
        mask_input = rgb.rotate(mask_rotation, expand=True) if mask_rotation else rgb
        matte = remove(mask_input, session=session, only_mask=True)
        if not isinstance(matte, Image.Image):
            raise TypeError('expected PIL mask')
        mask = matte.convert('L')
        if mask_rotation:
            mask = mask.rotate(-mask_rotation, expand=True)
        mask.save(outdir / '5.mask.png')
        background = Image.new('RGB', rgb.size, (242,243,243))
        final = Image.composite(rgb, background, mask)
        final.save(out, format='WEBP', lossless=True, method=6)
        alpha = np.asarray(mask)
        kept = alpha >= 250
        original = np.asarray(rgb)
        rendered = np.asarray(final)
        record = {'slug':slug, 'position':5, 'created_at':datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
                  'original_path':str(src), 'original_sha256':sha(src), 'output_path':str(out), 'output_sha256':sha(out),
                  'model':args.model, 'model_files':model_hashes, 'mask_inference_rotation_ccw':mask_rotation, 'mask_method':'rembg only_mask; native output probability alpha; same source RGB composited on RGB242243243; no shoe generation, resampling or source overwrite; mask-only inference orientation recorded separately',
                  'mask_path':str(outdir/'5.mask.png'), 'mask_sha256':sha(outdir/'5.mask.png'),
                  'dimensions':list(rgb.size), 'output_bytes':out.stat().st_size,
                  'dominant_subject_rgb_max_delta':int(np.max(np.abs(rendered.astype(int)-original.astype(int))[kept])) if np.any(kept) else None,
                  'visual_review_status':'pending','elapsed_seconds':round(time.monotonic()-begin,2)}
        (outdir/'5.provenance.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
        print(json.dumps({'slug':slug,'output_sha256':record['output_sha256'],'seconds':record['elapsed_seconds']}), flush=True)

if __name__ == '__main__':
    main()
