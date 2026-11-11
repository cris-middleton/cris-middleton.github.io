"""Arma datos/rubros.json para el tablero a partir de rubros/*.parquet (de bajar.py).

Uso: TRABAJO=<carpeta de bajar.py> uv run --project <tordo> python armar_rubros.py <salida.json>

El monto de cada orden se reparte entre sus líneas (como en Tordo), así que una orden con ítems de
varios rubros cuenta en cada uno lo suyo. Se compara la parte de cada rubro en 2023–2025 con la de
2010–2012: así la inflación no pesa. El rubro es el del catálogo de ChileCompra (RubroN1), con
nombres cortos; los rubros chicos van juntos en «Otros».
"""
import json, os, sys
from pathlib import Path
import polars as pl

TRABAJO = Path(os.environ.get('TRABAJO', '.')).resolve()
SALIDA = Path(sys.argv[1])
ANIOS = list(range(2007, 2026))
ANTES, AHORA = (2010, 2012), (2023, 2025)
GRUPOS = 22   # los más grandes de AHORA; el resto, «Otros»

CORTOS = {
    'Servicios de construcción y mantenimiento': 'Construcción y mantención', 'Medicamentos y productos farmacéuticos': 'Medicamentos',
    'Equipamiento y suministros médicos': 'Equipos e insumos médicos', 'Salud, servicios sanitarios y alimentación': 'Servicios de salud',
    'Servicios profesionales, administrativos y consultorías de gestión empresarial': 'Servicios profesionales',
    'Servicios de limpieza industrial': 'Aseo y basura', 'Tecnologías de la información, telecomunicaciones y radiodifusión': 'Tecnología y telecom.',
    'Servicios de transporte, almacenaje y correo': 'Transporte y correo',
    'Servicios basados en ingeniería, ciencias sociales y tecnología de la información': 'Ingeniería y estudios',
    'Servicios de defensa nacional, orden público y seguridad': 'Seguridad', 'Equipamiento para laboratorios': 'Laboratorio',
    'Vehículos y equipamiento en general': 'Vehículos', 'Servicios agrícolas, pesqueros, forestales y relacionados con la fauna': 'Agrícola y forestal',
    'Organizaciones y consultorías políticas, demográficas, económicas, sociales y de administración pública': 'Consultorías públicas',
    'Artículos para estructuras, obras y construcciones': 'Materiales de construcción', 'Obras MINVU': 'Obras Minvu',
    'Servicios básicos y de información pública': 'Servicios básicos', 'Servicios financieros, pensiones y seguros': 'Seguros y finanzas',
    'Alimentos, bebidas y tabaco': 'Alimentos', 'Servicios de Viajes, alimentación, alojamiento y entretenimiento': 'Viajes y alimentación',
    'Productos químicos industriales': 'Químicos', 'Equipos y suministros de defensa, orden público, protección y seguridad': 'Equipos de seguridad',
    'Productos impresos y publicaciones': 'Impresos', 'Combustibles, lubricantes y anticorrosivos': 'Combustibles',
    'Equipos, accesorios y suministros de oficina': 'Oficina', 'Educación, formación, entrenamiento y capacitación': 'Educación',
    'Servicios editoriales, de diseño, publicidad, gráficos y artistas': 'Publicidad y diseño', 'Muebles y mobiliario': 'Muebles',
    None: 'Sin rubro',
}
SALUD = ['Medicamentos y productos farmacéuticos', 'Equipamiento y suministros médicos', 'Salud, servicios sanitarios y alimentación']

fs = [(f, int(f.name[:4])) for f in (TRABAJO / 'rubros').glob('*.parquet')]
ru = pl.concat([pl.read_parquet(f).select('RubroN1', 'RubroN2', 'sobre_tope', 'monto').with_columns(pl.lit(a).alias('anio')) for f, a in fs]).filter(~pl.col('sobre_tope'))
total_anio = ru.group_by('anio').agg(pl.col('monto').sum().alias('t'))
n1 = ru.group_by('anio', 'RubroN1').agg(pl.col('monto').sum()).join(total_anio, on='anio').with_columns((pl.col('monto') / pl.col('t')).alias('p'))

def parte(tramo):
    return n1.filter(pl.col('anio').is_between(*tramo)).group_by('RubroN1').agg(pl.col('monto').sum().alias('m'), pl.col('p').mean().alias('p'))
ahora, antes = parte(AHORA), parte(ANTES)
tabla = (ahora.join(antes.select('RubroN1', pl.col('p').alias('p_antes')), on='RubroN1', how='left', coalesce=True)
         .with_columns(pl.col('p_antes').fill_null(0)).sort(['m', 'RubroN1'], descending=True, nulls_last=True))
tabla = tabla.with_columns(pl.col('RubroN1').is_null().alias('_nulo')).sort(['m'], descending=True)
grandes, chicos = tabla.head(GRUPOS), tabla.slice(GRUPOS)

# Los rubros N2 más grandes de cada N1, para el globo
n2 = (ru.filter(pl.col('anio').is_between(*AHORA)).group_by('RubroN1', 'RubroN2').agg(pl.col('monto').sum())
      .sort('monto', descending=True).group_by('RubroN1').agg(pl.col('RubroN2').head(3), pl.col('monto').head(3), pl.col('monto').sum().alias('t')))
detalle = {r['RubroN1']: [[a, round(b / r['t'], 3)] for a, b in zip(r['RubroN2'], r['monto']) if a] for r in n2.to_dicts()}

def serie(filtro):
    x = ru.filter(filtro).group_by('anio').agg(pl.col('monto').sum()).join(total_anio, on='anio')
    d = {r['anio']: r['monto'] / r['t'] for r in x.to_dicts()}
    return [round(d.get(a, 0), 4) for a in ANIOS]

grupos = [{'nombre': CORTOS.get(r['RubroN1'], r['RubroN1']), 'catalogo': r['RubroN1'] or 'Sin rubro', 'monto': round(r['m']), 'parte': round(r['p'], 4),
           'antes': round(r['p_antes'], 4), 'salud': r['RubroN1'] in SALUD, 'detalle': detalle.get(r['RubroN1'], [])} for r in grandes.to_dicts()]
grupos.append({'nombre': 'Otros', 'catalogo': f'{chicos.height} rubros más chicos', 'monto': round(chicos['m'].sum()), 'parte': round(chicos['p'].sum(), 4),
               'antes': round(chicos['p_antes'].sum(), 4), 'salud': False, 'detalle': []})
SALIDA.write_text(json.dumps({
    'fuente': 'Descarga masiva de órdenes de compra de ChileCompra (transparenciachc.blob.core.windows.net/oc-da)',
    'metodo': 'Monto de cada orden repartido entre sus líneas; parte de cada rubro en el gasto de cada año. Sin las órdenes de más de $20.000 millones.',
    'anios': ANIOS, 'antes': list(ANTES), 'ahora': list(AHORA), 'grupos': grupos,
    'series': {'salud': serie(pl.col('RubroN1').is_in(SALUD)), 'basura': serie(pl.col('RubroN2') == 'Eliminación y tratamiento de desechos'),
               'impresos': serie(pl.col('RubroN1') == 'Productos impresos y publicaciones'), 'construccion': serie(pl.col('RubroN1') == 'Servicios de construcción y mantenimiento')},
}, ensure_ascii=False, separators=(',', ':')))
print(f'{SALIDA}: {len(grupos)} grupos; sin nombre corto: {[g["catalogo"] for g in grupos if g["nombre"] == g["catalogo"] and g["nombre"] != "Otros"]}')
