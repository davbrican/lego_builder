"""Collect a reviewed subset and its complete dependency closure from complete.zip.

Usage: python scripts/collect-ldraw.py /path/to/complete.zip
The ZIP is downloaded explicitly from https://library.ldraw.org/updates?latest=.
No network requests are made by this script or by the production Docker build.
"""
from pathlib import Path
import hashlib
import json
import re
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SELECTION = {
    'Ladrillos': '3005 3004 3622 3010 3009 3008 6111 6112 2465 3003 3002 3001 2456 3007 3006 2357 6213 3245c 2453b 3754 3755a 30144 30145 30136',
    'Placas': '3024 3023b 3623 3710 3666 3460 4477 60479 3022 3021 3020 3795 3034 3832 2445 4282 3031 3032 3035 3036 3958 3030 3033 3029 41539 11212 2420 33909',
    'Baldosas': '3070b 3069b 63864 2431 6636 4162 3068b 26603 87079 69729 10202 14719 2412b',
    'Pendientes': '3040b 3039 3038 3037 3298 3297 30363 4286 3747b 3660b 3665a 3041 3044b 3045 3046 3048b 3675 3684a 3678b 85984 54200 60481a',
    'Curvas': '11477 15068 50950 93273 88930 93606 6091 37352 67810 42022',
    'Redondas': '3062b 3941 6141 4032a 98138 4150 14769 43898 3960 18674 60474 11213 3942c 4589 30367c 92947 85080 48092',
    'Arcos': '3659 3307 16577 6182 6060 13965 92950',
    'Ventanas y vallas': '60592 60593 60594 60596 3853 3633 3185 30055',
    'Technic': '6541 3700 3701 3894 3702 3895 32000 32064a',
    'Ruedas': '3482 4624 55982 56902 3641 2815 50951',
}
# Only actual filenames are used: fail closed for missing numeric references.
for key in SELECTION:
    SELECTION[key] = [n for n in SELECTION[key].split() if re.fullmatch(r'\d+[a-z]?', n)]

def main():
    archive = Path(sys.argv[1])
    with zipfile.ZipFile(archive) as z:
        names = {n.lower().removeprefix('ldraw/'): n for n in z.namelist()}
        sources, specs = {}, []

        def read(path):
            return z.read(names[path.lower()]).decode('utf-8-sig').replace('\r\n', '\n')

        def resolve(ref):
            ref = ref.replace('\\', '/').lower()
            for name in (ref, 'parts/' + ref, 'p/' + ref):
                if name in names:
                    return name
            raise ValueError(f'Missing dependency {ref}')

        def collect(path):
            if path in sources:
                return
            original = read(path)
            # Canonicalize all subfile references so the MPD needs no trial HTTP lookups.
            lines, dependencies = [], []
            for line in original.splitlines():
                tokens = line.split()
                if tokens and tokens[0] == '1':
                    dependency = resolve(' '.join(tokens[14:]))
                    line = ' '.join(tokens[:14]) + ' ' + dependency
                    dependencies.append(dependency)
                lines.append(line)
            sources[path] = '\n'.join(lines) + '\n'
            for dependency in dependencies:
                collect(dependency)

        seen = set()
        for category, refs in SELECTION.items():
            for ref in refs:
                path = 'parts/' + ref + '.dat'
                if path not in names:
                    raise ValueError(f'Unknown selected part: {ref}')
                description = read(path).splitlines()[0][2:].strip()
                if description.startswith('~Moved to '):
                    raise ValueError(f'Use canonical replacement: {ref}: {description}')
                if ref in seen:
                    continue
                seen.add(ref)
                collect(path)
                specs.append({'id': ref, 'category': category, 'description': description})

        public = ROOT / 'public/ldraw'
        public.mkdir(parents=True, exist_ok=True)
        for name in ['CAreadme.txt', 'CAlicense.txt', 'CAlicense4.txt']:
            (public / name).write_text(read(name), encoding='utf-8')
        bundle = {'source': 'https://library.ldraw.org/library/updates/complete.zip',
                  'archiveSha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
                  'release': '2026-08', 'parts': specs, 'files': sources}
        (ROOT / 'scripts/ldraw-sources.json').write_text(json.dumps(bundle, ensure_ascii=False, indent=2) + '\n')
        print(f'Collected {len(specs)} parts and {len(sources)} source files')

if __name__ == '__main__':
    main()
