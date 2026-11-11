"""Arma datos/regiones.json para el tablero a partir de regiones/*.parquet (de bajar.py).

Uso: TRABAJO=<carpeta de bajar.py> uv run --project <tordo> python armar_regiones.py <salida.json>

La región viene escrita de decenas de formas («Octava Región», «13», «DECIMA RECION LOS LAGOS»):
se reconoce por palabras clave, y lo que no se reconoce queda como «sin región». La región del
proveedor es la de su dirección en Mercado Público, que en las empresas grandes suele ser la casa
matriz: una compra a una cadena nacional cuenta como compra a Santiago aunque la entregue una sucursal.
"""
import json, os, re, sys, unicodedata
from pathlib import Path
import polars as pl

TRABAJO = Path(os.environ.get('TRABAJO', '.')).resolve()
SALIDA = Path(sys.argv[1])
ANIOS = list(range(2007, 2026))
RECIENTES = (2023, 2025)

# De norte a sur. Ñuble (2018) llega a los datos como parte del Biobío.
REGIONES = ['Arica y Parinacota', 'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo', 'Valparaíso', 'Metropolitana',
            "O'Higgins", 'Maule', 'Ñuble', 'Biobío', 'Araucanía', 'Los Ríos', 'Los Lagos', 'Aysén', 'Magallanes']
CLAVES = [  # (patrón sobre el texto en minúsculas y sin tildes, región); el orden importa
    (r'decima segunda|duodecima', 'Magallanes'), (r'decima cuarta', 'Los Ríos'), (r'decima primera|undecima', 'Aysén'),   # antes que «segunda» y «cuarta»
    (r'arica|parinacota|^xv\b|^15$', 'Arica y Parinacota'), (r'tarapa|iquique|^i region|^1$', 'Tarapacá'),
    (r'antofagasta|segunda|^ii region|^2$', 'Antofagasta'), (r'atacama|tercera|^iii\b|^3$', 'Atacama'),
    (r'coquimbo|cuarta|^iv\b|^4$', 'Coquimbo'), (r'valpara|^v region|^5$', 'Valparaíso'),
    (r'metropolitana|santiago|^13$|^rm\b', 'Metropolitana'), (r'higgins|libertador|^vi\b|^6$', "O'Higgins"),
    (r'maule|^vii\b|^7$', 'Maule'), (r'nuble|^16$', 'Ñuble'),
    (r'bio.?bio|octava|^viii\b|^8$|concepcion|los angeles|talcahuano', 'Biobío'),
    (r'araucan|novena|^ix\b|^9$', 'Araucanía'), (r'los rios|decima cuarta|^xiv\b|^14$|valdivia', 'Los Ríos'),
    (r'los lagos|decima reg|decima rec|^x\b|^10$|puerto montt|osorno', 'Los Lagos'),
    (r'aysen|aisen|ibanez|^xi\b|^11$', 'Aysén'), (r'magallanes|decima segunda|^xii\b|^12$|punta arenas', 'Magallanes'),
    (r'extranjero', 'Extranjero'),
]
def region(texto):
    if texto is None:
        return None
    t = unicodedata.normalize('NFD', texto).encode('ascii', 'ignore').decode().lower().strip()
    for patron, nombre in CLAVES:
        if re.search(patron, t):
            return nombre
    return None

fs = [(f, int(f.name[:4])) for f in (TRABAJO / 'regiones').glob('*.parquet')]
r = pl.concat([pl.read_parquet(f).with_columns(pl.lit(a).alias('anio')) for f, a in fs], how='diagonal_relaxed').filter(~pl.col('sobre_tope'))
textos = pl.concat([r['RegionUnidadCompra'], r['RegionProveedor']]).unique().drop_nulls().to_list()
mapa = pl.DataFrame({'texto': textos, 'region': [region(t) for t in textos]}, schema={'texto': pl.Utf8, 'region': pl.Utf8})
r = (r.join(mapa.rename({'texto': 'RegionUnidadCompra', 'region': 'compra'}), on='RegionUnidadCompra', how='left', coalesce=True)
      .join(mapa.rename({'texto': 'RegionProveedor', 'region': 'vende'}), on='RegionProveedor', how='left', coalesce=True))

def matriz(df):
    """compra × vende, en pesos; las columnas son las regiones más «Extranjero» y «Sin región»."""
    g = df.group_by('compra', 'vende').agg(pl.col('monto').sum())
    cols = REGIONES + ['Extranjero', None]
    out = {c: [0] * len(cols) for c in REGIONES}
    for x in g.to_dicts():
        if x['compra'] in out:
            out[x['compra']][cols.index(x['vende'] if x['vende'] in cols else None)] += round(x['monto'])
    return [out[c] for c in REGIONES]

# Por año: cuánto de lo que compra cada región se queda en ella, va a la Metropolitana o a otra región
anual = r.filter(pl.col('compra').is_in(REGIONES)).with_columns(
    pl.when(pl.col('vende') == pl.col('compra')).then(pl.lit('local')).when(pl.col('vende') == 'Metropolitana').then(pl.lit('rm'))
    .when(pl.col('vende').is_in(REGIONES)).then(pl.lit('otra')).otherwise(pl.lit('sin')).alias('destino'))
por_anio = anual.group_by('anio', 'compra', 'destino').agg(pl.col('monto').sum())
serie = {c: {d: [0] * len(ANIOS) for d in ('local', 'rm', 'otra', 'sin')} for c in REGIONES}
for x in por_anio.to_dicts():
    serie[x['compra']][x['destino']][ANIOS.index(x['anio'])] = round(x['monto'])

sin_texto = r.filter(pl.col('compra').is_null())['monto'].sum() / r['monto'].sum()
SALIDA.write_text(json.dumps({
    'fuente': 'Descarga masiva de órdenes de compra de ChileCompra (transparenciachc.blob.core.windows.net/oc-da)',
    'limpieza': 'Sin órdenes canceladas; montos con coma decimal y en UF/UTM saneados como en Tordo; una fila por orden. Sin las órdenes de más de $20.000 millones.',
    'nota': 'La región del proveedor es la de su dirección en Mercado Público (en las empresas grandes, la casa matriz).',
    'anios': ANIOS, 'recientes': list(RECIENTES), 'regiones': REGIONES, 'columnas': REGIONES + ['Extranjero', 'Sin región'],
    'matriz': matriz(r.filter(pl.col('anio').is_between(*RECIENTES))), 'serie': serie,
    'comprador_sin_region': round(sin_texto, 4),
}, ensure_ascii=False, separators=(',', ':')))
print(f'{SALIDA}: comprador sin región {sin_texto:.2%}; textos sin reconocer: {sum(1 for t in textos if region(t) is None)} de {len(textos)}')
