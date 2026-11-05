"""Arma datos/diciembre.json para el tablero a partir de resultados/*.json (de bajar.py).

Uso: python3 armar.py <tope_en_pesos> <salida.json>
Las órdenes de más de <tope> no suman: se listan en el JSON, con su organismo y su nombre.
"""
import json, sys
from pathlib import Path

RES = Path('resultados')
TOPE = float(sys.argv[1])
SALIDA = Path(sys.argv[2])
ANIOS = list(range(2007, 2026))

monto = [[None] * 12 for _ in ANIOS]
ordenes = [[None] * 12 for _ in ANIOS]
fuera, sin_archivo = [], []
for i, a in enumerate(ANIOS):
    for m in range(12):
        r = json.loads((RES / f'{a}-{m + 1}.json').read_text())
        if 'error' in r:
            sin_archivo.append(f'{a}-{m + 1:02d}')
            continue
        quitar = [g for g in r['grandes'] if g['MontoTotalOC_PesosChilenos'] > TOPE]
        monto[i][m] = round(r['monto'] - sum(g['MontoTotalOC_PesosChilenos'] for g in quitar))
        ordenes[i][m] = r['ordenes']
        fuera += [{'mes': f'{a}-{m + 1:02d}', 'codigo': g['Codigo'], 'organismo': g.get('OrganismoPublico'), 'nombre': g.get('Nombre'),
                   'monto': round(g['MontoTotalOC_PesosChilenos'])} for g in quitar]

SALIDA.write_text(json.dumps({
    'fuente': 'Descarga masiva de órdenes de compra de ChileCompra (transparenciachc.blob.core.windows.net/oc-da)',
    'limpieza': 'Sin órdenes canceladas; montos con coma decimal y en UF/UTM saneados como en Tordo; una fila por orden.',
    'tope': TOPE,
    'anios': ANIOS, 'monto': monto, 'ordenes': ordenes,
    'sin_archivo': sin_archivo,
    'fuera_del_tope': sorted(fuera, key=lambda f: -f['monto']),
}, ensure_ascii=False, separators=(',', ':')))
print(f'{SALIDA}: {len(fuera)} órdenes sobre el tope, {len(sin_archivo)} meses sin archivo')
