#!/usr/bin/env python3
"""Arma los personajes 3D de BioVoley Lab a partir de recursos de MakeHuman (CC0).

Uso: python personaje.py <carpeta_recursos> <salida>

<carpeta_recursos> contiene:
  d/3dobjs/base.obj, d/rigs/default.mhskel, d/rigs/default_weights.mhw, d/targets/*.target
  a/clothes, a/hair, a/eyes, a/eyebrows, a/skins  (paquete de sistema de MakeHuman)

Genera <salida>/personaje.json + personaje.bin (mallas con piel y esqueleto) y las texturas.
Cuerpo adulto de forma atlética; siempre vestido: camiseta, short, rodilleras y zapatillas.
"""
import json
import pathlib
import re
import struct
import sys

import numpy as np
from PIL import Image

SRC = pathlib.Path(sys.argv[1])
OUT = pathlib.Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
UNIDAD = 0.1  # MakeHuman trabaja en decímetros

# huesos que se conservan; todos los demás ceden su peso al antepasado conservado más cercano
HUESOS = ['root', 'spine04', 'spine02', 'neck01', 'head',
          'clavicle.L', 'upperarm01.L', 'lowerarm01.L', 'wrist.L',
          'clavicle.R', 'upperarm01.R', 'lowerarm01.R', 'wrist.R',
          'upperleg01.L', 'lowerleg01.L', 'foot.L',
          'upperleg01.R', 'lowerleg01.R', 'foot.R']
IDX = {b: i for i, b in enumerate(HUESOS)}


def leer_obj(ruta):
    v, vt, caras, grupo, grupos = [], [], [], None, []
    for linea in open(ruta, errors='ignore'):
        p = linea.split()
        if not p:
            continue
        if p[0] == 'v':
            v.append([float(x) for x in p[1:4]])
        elif p[0] == 'vt':
            vt.append([float(x) for x in p[1:3]])
        elif p[0] in ('g', 'o'):
            grupo = p[1] if len(p) > 1 else ''
        elif p[0] == 'f':
            cara = []
            for t in p[1:]:
                s = t.split('/')
                cara.append((int(s[0]) - 1, int(s[1]) - 1 if len(s) > 1 and s[1] else -1))
            caras.append(cara)
            grupos.append(grupo)
    return np.array(v, float), np.array(vt, float) if vt else np.zeros((0, 2)), caras, grupos


def cuerpo(mezcla):
    """Aplica las formas (targets) sobre la malla base."""
    v, vt, caras, grupos = leer_obj(SRC / 'd/3dobjs/base.obj')
    for nombre, peso in mezcla.items():
        for linea in open(SRC / f'd/targets/{nombre}.target'):
            if linea.startswith('#') or not linea.strip():
                continue
            i, dx, dy, dz = linea.split()
            v[int(i)] += peso * np.array([float(dx), float(dy), float(dz)])
    return v, vt, caras, grupos


skel = json.load(open(SRC / 'd/rigs/default.mhskel'))
pesos_src = json.load(open(SRC / 'd/rigs/default_weights.mhw'))['weights']


def conservado(b):
    while b not in IDX:
        b = skel['bones'][b]['parent']
        if b is None:
            return 'root'
    return b


def pesos_base(n):
    """Por vértice de la malla base: diccionario hueso conservado → peso."""
    w = [{} for _ in range(n)]
    for b, lista in pesos_src.items():
        k = IDX[conservado(b)]
        for vi, p in lista:
            if vi < n:
                w[vi][k] = w[vi].get(k, 0) + p
    return w


def top4(d):
    if not d:
        return [IDX['root'], 0, 0, 0], [255, 0, 0, 0]
    it = sorted(((k, p) for k, p in d.items() if p > 1e-4), key=lambda kv: -kv[1])[:4]
    if not it:
        return [IDX['root'], 0, 0, 0], [255, 0, 0, 0]
    s = sum(p for _, p in it)
    idx = [k for k, _ in it] + [0] * (4 - len(it))
    pes = [int(round(p / s * 255)) for _, p in it] + [0] * (4 - len(it))
    pes[0] += 255 - sum(pes)
    return idx, pes


def normales(pos, tris):
    n = np.zeros_like(pos)
    a, b, c = pos[tris[:, 0]], pos[tris[:, 1]], pos[tris[:, 2]]
    fn = np.cross(b - a, c - a)
    for k in range(3):
        np.add.at(n, tris[:, k], fn)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)


def malla(pos, uv, caras, w):
    """Une pares (vértice, uv) y triangula. pos en metros; w = pesos por vértice."""
    mapa, P, U, W, tris = {}, [], [], [], []
    def idx(vi, ti):
        k = (vi, ti)
        if k not in mapa:
            mapa[k] = len(P)
            P.append(pos[vi]); U.append(uv[ti] if ti >= 0 else [0, 0]); W.append(w[vi])
        return mapa[k]
    for cara in caras:
        ids = [idx(a, b) for a, b in cara]
        for i in range(1, len(ids) - 1):
            tris.append((ids[0], ids[i], ids[i + 1]))
    P, U, tris = np.array(P), np.array(U), np.array(tris, np.int32)
    return {'pos': P, 'uv': U, 'tris': tris, 'w': W, 'nor': normales(P, tris)}


def leer_mhclo(ruta):
    """Devuelve (ajuste por vértice, escalas, vértices del cuerpo a ocultar)."""
    ajuste, borrar, esc = [], set(), {}
    modo = None
    for linea in open(ruta, errors='ignore'):
        s = linea.split('#')[0].strip()
        if not s:
            continue
        p = s.split()
        if p[0] in ('x_scale', 'y_scale', 'z_scale'):
            esc[p[0][0]] = (int(p[1]), int(p[2]), float(p[3])); modo = None
        elif p[0] == 'verts':
            modo = 'verts'
        elif p[0] in ('delete_verts', 'delete'):
            modo = 'del'
        elif modo == 'verts' and p[0].isdigit():
            if len(p) == 1:
                ajuste.append(((int(p[0]), 0, 0), (1, 0, 0), (0, 0, 0)))
            elif len(p) >= 9:
                ajuste.append(((int(p[0]), int(p[1]), int(p[2])), tuple(float(x) for x in p[3:6]), tuple(float(x) for x in p[6:9])))
        elif modo == 'del':
            i = 0
            while i < len(p):
                if p[i] == '-':
                    borrar.update(range(int(p[i - 1]), int(p[i + 1]) + 1)); i += 2
                else:
                    if p[i].isdigit():
                        borrar.add(int(p[i]))
                    i += 1
    return ajuste, esc, borrar


def ajustar(carpeta, nombre, base, wbase):
    """Ajusta una prenda al cuerpo. Devuelve vértices (dm), uv, caras, grupos, pesos y ocultos."""
    ajuste, esc, borrar = leer_mhclo(SRC / carpeta / f'{nombre}.mhclo')
    v, vt, caras, grupos = leer_obj(SRC / carpeta / f'{nombre}.obj')
    s = np.array([abs(base[esc[e][0]][k] - base[esc[e][1]][k]) / esc[e][2] if e in esc else 1.0 for k, e in enumerate('xyz')])
    out = np.zeros((len(ajuste), 3))
    w = []
    for i, (ids, pes, off) in enumerate(ajuste):
        out[i] = sum(p * base[j] for j, p in zip(ids, pes)) + np.array(off) * s
        d = {}
        for j, p in zip(ids, pes):
            if p:
                for k, q in wbase[j].items():
                    d[k] = d.get(k, 0) + p * q
        w.append(d)
    return out, vt, caras, grupos, w, borrar


def subdividir(pos, uv, caras, w):
    """Una pasada de Catmull-Clark: la ropa de MakeHuman tiene pocos polígonos."""
    n = len(pos)
    Pn, Un, Wn = [p for p in pos], [u for u in uv], [dict(d) for d in w]
    def media_w(ids):
        d = {}
        for i in ids:
            for k, q in w[i].items():
                d[k] = d.get(k, 0) + q / len(ids)
        return d
    bordes, cf = {}, []
    for ci, cara in enumerate(caras):
        ids = [a for a, _ in cara]
        c = np.mean([pos[i] for i in ids], axis=0)
        cf.append(c)
        for k in range(len(ids)):
            a, b = sorted((ids[k], ids[(k + 1) % len(ids)]))
            bordes.setdefault((a, b), []).append(ci)
    emid = {}
    for (a, b), fs in bordes.items():
        if len(fs) == 2:
            q = (pos[a] + pos[b] + cf[fs[0]] + cf[fs[1]]) / 4
        else:
            q = (pos[a] + pos[b]) / 2
        emid[(a, b)] = len(Pn)
        Pn.append(q); Wn.append(media_w([a, b]))
    # vértices originales
    vec_f, vec_e, borde = {}, {}, {}
    for ci, cara in enumerate(caras):
        for a, _ in cara:
            vec_f.setdefault(a, []).append(cf[ci])
    for (a, b), fs in bordes.items():
        m = (pos[a] + pos[b]) / 2
        vec_e.setdefault(a, []).append(m); vec_e.setdefault(b, []).append(m)
        if len(fs) == 1:
            borde[a] = borde[b] = True
    for i, fs in vec_f.items():
        if i in borde:
            continue
        k = len(fs)
        Pn[i] = (np.mean(fs, axis=0) + 2 * np.mean(vec_e[i], axis=0) + (k - 3) * pos[i]) / k
    # uv: puntos medios por pares de coordenadas de textura
    umid, sale = {}, []
    def um(t1, t2):
        k = tuple(sorted((t1, t2)))
        if k not in umid:
            umid[k] = len(Un); Un.append((uv[t1] + uv[t2]) / 2)
        return umid[k]
    for ci, cara in enumerate(caras):
        ids = [a for a, _ in cara]; ts = [b for _, b in cara]
        centro = len(Pn); Pn.append(cf[ci]); Wn.append(media_w(ids))
        tc = len(Un); Un.append(np.mean([uv[t] for t in ts], axis=0))
        L = len(ids)
        for k in range(L):
            a, ta = ids[k], ts[k]
            b, tb = ids[(k + 1) % L], ts[(k + 1) % L]
            z, tz = ids[k - 1], ts[k - 1]
            sale.append([(a, ta), (emid[tuple(sorted((a, b)))], um(ta, tb)), (centro, tc), (emid[tuple(sorted((z, a)))], um(tz, ta))])
    return np.array(Pn), np.array(Un), sale, Wn


def a_binario(buf, m):
    """Añade la malla al binario y devuelve su descripción."""
    n = len(m['pos'])
    idx4 = np.zeros((n, 4), np.uint8); pes4 = np.zeros((n, 4), np.uint8)
    for i, d in enumerate(m['w']):
        a, b = top4(d)
        idx4[i] = a; pes4[i] = b
    tris = m['tris']
    assert n < 65536
    secciones = {
        'pos': m['pos'].astype('<f4').tobytes(),
        'nor': np.round(m['nor'] * 32767).astype('<i2').tobytes(),
        'uv': np.round(np.clip(m['uv'], 0, 1) * 65535).astype('<u2').tobytes(),
        'idx': idx4.tobytes(), 'pes': pes4.tobytes(),
        'tri': tris.astype('<u2').tobytes(),
    }
    d = {'n': n, 't': len(tris)}
    for k, b in secciones.items():
        while len(buf) % 4:
            buf.append(0)
        d[k] = len(buf)
        buf.extend(b)
    return d


def recorte_short(v, caras, grupos, y_cintura, y_corte):
    """Del pantalón deja solo hasta medio muslo, con el dobladillo parejo."""
    sale, usados = [], set()
    for cara in caras:
        ys = [v[a][1] for a, _ in cara]
        if max(ys) < y_corte:
            continue
        sale.append(cara)
        usados.update(a for a, _ in cara)
    v = v.copy()
    for a in usados:
        if v[a][1] < y_corte:
            v[a][1] = y_corte
    return v, sale


def rodilleras(base, caras_cuerpo, joints, ancho=0.068):
    """Banda alrededor de cada rodilla con bordes parejos; devuelve vértices ajustados y caras."""
    v, sale, usados = base.copy(), [], {}
    for cara in caras_cuerpo:
        ids = [a for a, _ in cara]
        for lado in 'LR':
            j = joints[f'lowerleg01.{lado}']
            ys = [base[a][1] for a in ids]
            if max(ys) >= j[1] - ancho and min(ys) <= j[1] + ancho and all(abs(base[a][0] - j[0]) < 0.12 for a in ids):
                sale.append(cara)
                for a in ids:
                    usados[a] = j[1]
                break
    for a, cy in usados.items():
        v[a][1] = min(cy + ancho, max(cy - ancho, v[a][1]))
    return v, sale


def construir(nombre, mezcla, pelo, buf, hem=0.60):
    base_dm, vt, caras, grupos = cuerpo(mezcla)
    n = len(base_dm)
    wb = pesos_base(n)
    # articulaciones (el grupo body define la altura mínima: planta del pie)
    cuerpo_ids = sorted({a for c, g in zip(caras, grupos) if g == 'body' for a, _ in c})
    y0 = base_dm[cuerpo_ids, 1].min()
    base = (base_dm - np.array([0, y0, 0])) * UNIDAD
    alto = base[cuerpo_ids, 1].max()

    def joint(nom):
        return base[skel['joints'][nom]].mean(axis=0)

    joints = {b: joint(skel['bones'][b]['head']) for b in HUESOS}
    colas = {b: joint(skel['bones'][b]['tail']) for b in HUESOS}
    padres = []
    for b in HUESOS:
        p = skel['bones'][b]['parent']
        padres.append(-1 if p is None else IDX[conservado(p)])

    mallas = {}
    y_hem = joints['upperleg01.L'][1] + (joints['lowerleg01.L'][1] - joints['upperleg01.L'][1]) * hem

    # camiseta + pantalón (se separan por altura de la cintura)
    base_dm_rel = base_dm
    v, vtc, cc, gc, wc, borrar_ropa = ajustar('a/clothes/male_casualsuit04', 'male_casualsuit04', base_dm_rel, wb)
    v = (v - np.array([0, y0, 0])) * UNIDAD
    y_cint = joints['spine04'][1] - 0.0
    uvc = vtc
    # en el atlas la camiseta ocupa la mitad superior y el pantalón la inferior
    camisa, pantalon = [], []
    for cara in cc:
        (camisa if np.mean([uvc[t][1] for _, t in cara]) > 0.56 else pantalon).append(cara)
    for clave, lista in (('camiseta', camisa), ('short', pantalon)):
        vs, us, cs, ws = subdividir(v, uvc, lista, wc)
        if clave == 'short':
            vs, cs = recorte_short(vs, cs, gc, y_cint, y_hem)
        m = malla(vs, us, cs, ws)
        m['pos'] = m['pos'] + m['nor'] * 0.0025
        mallas[clave] = m

    # zapatos con media
    vz, vtz, cz, gz, wz, borrar_z = ajustar('a/clothes/shoes05', 'shoes05', base_dm_rel, wb)
    vz = (vz - np.array([0, y0, 0])) * UNIDAD
    mallas['zapato'] = malla(vz, vtz, cz, wz)

    # piel: se ocultan solo las partes cubiertas (el short llega hasta el dobladillo)
    ocultos = set()
    for i in borrar_ropa:
        if i < n and base[i][1] > y_hem + 0.03:
            ocultos.add(i)
    ocultos |= {i for i in borrar_z if i < n}
    caras_body = [c for c, g in zip(caras, grupos) if g == 'body']
    caras_piel = [c for c in caras_body if not all(a in ocultos for a, _ in c)]
    mallas['piel'] = malla(base, vt, caras_piel, wb)

    # rodilleras
    jr = {f'lowerleg01.{l}': joints[f'lowerleg01.{l}'] for l in 'LR'}
    vr, cr = rodilleras(base, caras_body, jr)
    m = malla(vr, vt, cr, wb)
    m['pos'] = m['pos'] + m['nor'] * 0.008
    mallas['rodillera'] = m

    # pelo, ojos y cejas
    for clave, carp, nom in [('pelo', f'a/hair/{pelo}', pelo), ('ojos', 'a/eyes/low-poly', 'low-poly'), ('cejas', 'a/eyebrows/eyebrow001', 'eyebrow001')]:
        vp, vtp, cp, gp, wp, _ = ajustar(carp, nom, base_dm_rel, wb)
        vp = (vp - np.array([0, y0, 0])) * UNIDAD
        wh = [{IDX['head']: 1.0} for _ in range(len(vp))]
        mallas[clave] = malla(vp, vtp, cp, wh)

    meta = {'alto': float(alto), 'huesos': [
        {'n': b, 'p': padres[i], 'head': [round(float(x), 5) for x in joints[b]], 'tail': [round(float(x), 5) for x in colas[b]]}
        for i, b in enumerate(HUESOS)], 'mallas': {}}
    for k, m in mallas.items():
        meta['mallas'][k] = a_binario(buf, m)
    print(nombre, f"alto {alto:.3f} m,", ', '.join(f"{k}:{len(m['pos'])}v/{len(m['tris'])}t" for k, m in mallas.items()),
          '· total', sum(len(m['tris']) for m in mallas.values()), 'tris')
    return meta


raza = {'african': 0.34, 'asian': 0.33, 'caucasian': 0.33}


def mezcla(sexo):
    m = {f'universal-{sexo}-young-averagemuscle-averageweight': 0.6, f'universal-{sexo}-young-maxmuscle-averageweight': 0.4}
    m.update({f'{r}-{sexo}-young': p for r, p in raza.items()})
    return m


buf = bytearray()
datos = {'F': construir('F', mezcla('female'), 'ponytail01', buf), 'M': construir('M', mezcla('male'), 'short01', buf)}
(OUT / 'personaje.bin').write_bytes(bytes(buf))
(OUT / 'personaje.json').write_text(json.dumps(datos, separators=(',', ':')))
print('binario', len(buf) // 1024, 'KB')

# texturas
def textura(src, dst, lado, calidad=84, rgba=False):
    im = Image.open(SRC / src)
    im = im.convert('RGBA' if rgba else 'RGB').resize((lado, lado), Image.LANCZOS)
    if rgba:
        im.save(OUT / dst, 'PNG', optimize=True)
    else:
        im.save(OUT / dst, 'JPEG', quality=calidad, optimize=True, progressive=True)
    print(dst, (OUT / dst).stat().st_size // 1024, 'KB')


def primero(carpeta, *patrones):
    for p in patrones:
        for f in sorted((SRC / carpeta).glob(p)):
            return str(f.relative_to(SRC))
    raise FileNotFoundError(f'{carpeta} {patrones}')


for sexo, s in (('F', 'female'), ('M', 'male')):
    for tono, r in (('claro', 'caucasian'), ('medio', 'asian'), ('oscuro', 'african')):
        textura(primero(f'a/skins/young_{r}_{s}', '*diffuse*.png', '*.png'), f'piel_{sexo}_{tono}.jpg', 1024)
textura(primero('a/clothes/male_casualsuit04', '*_ao.png'), 'ropa_ao.jpg', 512, 80)
textura(primero('a/clothes/shoes05', '*diffuse*.png'), 'zapato.jpg', 768)
textura(primero('a/hair/ponytail01', '*diffuse*.png', '*.png'), 'pelo_F.png', 768, rgba=True)
textura(primero('a/hair/short01', '*diffuse*.png', '*.png'), 'pelo_M.png', 768, rgba=True)
textura(primero('a/eyes/materials', 'brown_eye.png', '*.png'), 'ojo.jpg', 256)
textura(primero('a/eyebrows/eyebrow001', '*.png'), 'ceja.png', 256, rgba=True)
