#!/usr/bin/env python3
"""Empaqueta BioVoley Lab en un solo archivo HTML que funciona sin servidor y sin internet.

Uso:  python3 empaquetar.py [salida.html]     (por defecto ../VioBolley.html)

Incluye estilos, fuentes, código, Three.js, MediaPipe, las personas 3D y los videos de
referencia. El .wasm, el modelo rápido y las mallas van comprimidos con gzip y en base64; la
app los descomprime cuando los necesita. El modelo "Preciso" no se incluye para no duplicar
el tamaño: ese usa internet.
"""
import base64
import gzip
import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent
SALIDA = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ.parent / 'VioBolley.html'
VENDOR = RAIZ / 'vendor'
MP = VENDOR / 'mediapipe'
PJ = VENDOR / 'personaje'
VIDEOS = RAIZ / 'videos'


def leer(ruta):
    return pathlib.Path(ruta).read_text(encoding='utf-8')


def seguro(js, nombre):
    """Evita que el texto del JavaScript cierre o altere la etiqueta <script> que lo contiene."""
    assert '<!--' not in js, f'{nombre} contiene <!--'
    return js.replace('</script', '<\\/script')


def comprimido(ruta):
    return base64.b64encode(gzip.compress(pathlib.Path(ruta).read_bytes(), 9, mtime=0)).decode()


def fuentes():
    css = leer(VENDOR / 'fuentes' / 'fuentes.css')
    def incrustar(m):
        datos = base64.b64encode((VENDOR / 'fuentes' / m.group(1)).read_bytes()).decode()
        return f'url(data:font/woff2;base64,{datos})'
    return re.sub(r'url\(([\w-]+\.woff2)\)', incrustar, css)


def vision():
    """Convierte el módulo ES de MediaPipe en un script clásico que publica window.MPVision."""
    js = leer(MP / 'vision_bundle.js')
    js = re.sub(r'//# sourceMappingURL=.*', '', js)
    exp = re.search(r'export\s*\{([^}]*)\}\s*;?', js)
    assert exp, 'no encontré el export de vision_bundle.js'
    nombre = re.search(r'([\w$]+) as PoseLandmarker\b', exp.group(1)).group(1)
    js = js[:exp.start()] + js[exp.end():]
    return "(function(){'use strict';\n" + js + f'\nwindow.MPVision={{PoseLandmarker:{nombre}}};\n}})();'


def bloque(id_, datos):
    return f'<script type="text/plain" id="{id_}">{datos}</script>'


def personajes():
    """Mallas y texturas de las personas 3D."""
    tipos = {'.jpg': 'image/jpeg', '.png': 'image/png'}
    sale = [bloque('emb-pj-json', leer(PJ / 'personaje.json')), bloque('emb-pj-bin', comprimido(PJ / 'personaje.bin'))]
    for f in sorted(PJ.iterdir()):
        if f.suffix in tipos and not f.name.startswith('aterrizaje'):
            datos = base64.b64encode(f.read_bytes()).decode()
            sale.append(bloque('emb-pj-' + re.sub(r'\W', '_', f.name), f'data:{tipos[f.suffix]};base64,{datos}'))
    return sale


def aterrizaje():
    """Cuadros de la persona y fondo de la vista Aterrizaje."""
    tipos = {'.jpg': 'image/jpeg', '.webp': 'image/webp'}
    sale = [bloque('emb-at-aterrizaje_json', leer(PJ / 'aterrizaje.json'))]
    for f in sorted(PJ.glob('aterrizaje_*')) + [PJ / 'portada.webp', PJ / 'balon.webp']:
        datos = base64.b64encode(f.read_bytes()).decode()
        sale.append(bloque('emb-at-' + re.sub(r'\W', '_', f.name), f'data:{tipos[f.suffix]};base64,{datos}'))
    return sale


def videos():
    """Videos de referencia para equipos sin aceleración gráfica."""
    listos = [f for f in sorted(VIDEOS.glob('*.mp4')) if b'moov' in f.read_bytes()[:65536]]  # los que siguen renderizándose no llevan índice
    print('videos incluidos:', ', '.join(f.stem for f in listos) or 'ninguno')
    return [bloque('emb-vid-' + f.stem, base64.b64encode(f.read_bytes()).decode()) for f in listos]


html = leer(RAIZ / 'index.html')

html = html.replace('<link rel="stylesheet" href="vendor/fuentes/fuentes.css">', '<style>\n' + fuentes() + '</style>')
html, n = re.subn(r'<link rel="stylesheet" href="css/estilos\.css[^"]*">', lambda m: '<style>\n' + leer(RAIZ / 'css' / 'estilos.css') + '</style>', html)
assert n == 1, 'no encontré la hoja de estilos'

def script_app(m):
    return '<script>\n' + seguro(leer(RAIZ / m.group(1)), m.group(1)) + '\n</script>'

html, n = re.subn(r'<script src="(js/[^"?]+\.js)(?:\?[^"]*)?"></script>', script_app, html)
assert n >= 16, f'solo encontré {n} scripts'

librerias = '\n'.join([
    '<script>\n' + seguro(leer(VENDOR / 'three.min.js'), 'three.min.js') + '\n</script>',
    '<script>\n' + seguro(vision(), 'vision_bundle.js') + '\n</script>',
    '<script>\n' + seguro(leer(MP / 'wasm' / 'vision_wasm_internal.js'), 'vision_wasm_internal.js') + '\n</script>',
    '<script>window.MPFactory=window.ModuleFactory;</script>',
    bloque('emb-mp-wasm', comprimido(MP / 'wasm' / 'vision_wasm_internal.wasm')),
    bloque('emb-mp-model', comprimido(MP / 'pose_landmarker_lite.task')),
    *personajes(),
    *aterrizaje(),
    *videos(),
])
marca = '<div id="toast" class="toast" role="status" aria-live="polite" hidden></div>'
assert marca in html
html = html.replace(marca, marca + '\n' + librerias)

SALIDA.write_text(html, encoding='utf-8')
print(f'{SALIDA}  ({SALIDA.stat().st_size / 1048576:.1f} MB)')
