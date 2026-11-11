"""Arma datos/sin-licitar.json para el tablero a partir de organismos/*.parquet (de bajar.py).

Uso: TRABAJO=<carpeta de bajar.py> uv run --project <tordo> python armar_sin_licitar.py <salida.json>

Cada orden cae en una forma de compra. La descarga cambió de forma con los años, así que se
leen tres marcas: el tipo de orden (hasta 2013 el trato directo venía en el tipo: D1, G1, C1,
F3; desde diciembre de 2024, la «ficha de trato directo», TD), la marca `EsTratoDirecto` y la
causal (`ProcedenciaOC`). Sin licitar = trato directo + compra ágil. El convenio marco cuenta
como licitado: lo licita ChileCompra.
"""
import json, os, sys
from pathlib import Path
import polars as pl

TRABAJO = Path(os.environ.get('TRABAJO', '.')).resolve()
SALIDA = Path(sys.argv[1])
ANIOS = list(range(2007, 2026))
RECIENTES = (2023, 2025)   # el ranking de organismos y sectores: los tres últimos años
TOPE = 20_000_000_000      # el mismo de diciembre: sobre esto no se suma (bajar.py lo marca)

# El nombre corto de los organismos que salen en la lista (el archivo los trae en mayúsculas y cortados)
NOMBRES = {
    '6957': 'Cenabast', '6954': 'Fonasa', '7251': 'Universidad de Chile', '127018': 'Hospital de Puerto Montt',
    '7079': 'Subsecretaría de Salud Pública', '6924': 'Conaf', '6960': 'Registro Civil',
    '113812': 'Carabineros (logística)', '111875': 'Armada (abastecimiento)', '6936': 'Hospital Gustavo Fricke',
    '1090469': 'Instituto de Previsión Social', '7046': 'Hospital Hernán Henríquez Aravena',
    '7248': 'Obras Públicas (dirección general)', '7312': 'Hospital de La Serena', '111870': 'Ejército (apoyo a la fuerza)',
}

o = pl.concat([pl.read_parquet(TRABAJO / 'organismos' / f'{a}-{m}.parquet').with_columns(pl.lit(a).alias('anio'))
               for a in ANIOS for m in range(1, 13) if (TRABAJO / 'organismos' / f'{a}-{m}.parquet').exists()],
              how='diagonal_relaxed').filter(~pl.col('sobre_tope'))

tipo, causa = pl.col('CodigoAbreviadoTipoOC'), pl.col('ProcedenciaOC').fill_null('')
directo = tipo.is_in(['TD', 'D1', 'G1', 'C1', 'F3', 'MC', 'CT']) | ((pl.col('EsTratoDirecto') == 'Si') & ~pl.col('con_licitacion'))
convenio = tipo.is_in(['CM', 'TL', 'CB']) | (causa == 'Proveniente de convenio marco')
forma = (pl.when(convenio).then(pl.lit('convenio'))
         .when(tipo == 'AG').then(pl.lit('agil'))
         .when(directo & ((tipo == 'C1') | causa.str.contains('(?i)emergencia'))).then(pl.lit('emergencia'))
         .when(directo & ((tipo == 'D1') | causa.str.contains('(?i)un proveedor'))).then(pl.lit('unico'))
         .when(directo).then(pl.lit('directo'))
         .when(pl.col('con_licitacion') | causa.str.starts_with('Proveniente de licitación')).then(pl.lit('licitacion'))
         .when(causa.str.contains('(?i)para informar')).then(pl.lit('informar'))
         .otherwise(pl.lit('otra')))
o = o.with_columns(forma.alias('forma')).with_columns(pl.col('forma').is_in(['agil', 'emergencia', 'unico', 'directo']).alias('sin'))
FORMAS = ['emergencia', 'unico', 'directo', 'agil', 'convenio', 'licitacion', 'informar', 'otra']

por_anio = o.group_by('anio', 'forma').agg(pl.col('monto').sum(), pl.col('n').sum())
def serie(campo):
    return {f: [round(por_anio.filter((pl.col('anio') == a) & (pl.col('forma') == f))[campo].sum()) for a in ANIOS] for f in FORMAS}

rec = o.filter(pl.col('anio').is_between(*RECIENTES))
org = (rec.group_by('CodigoOrganismoPublico')
       .agg(pl.col('OrganismoPublico').first(), pl.col('sector').first(), pl.col('monto').sum().alias('total'),
            pl.col('monto').filter(pl.col('sin')).sum().alias('sin'))
       .filter(pl.col('total') > 0).sort('sin', descending=True))
sectores = (rec.group_by(pl.col('sector').fill_null('Sin sector')).agg(pl.col('monto').sum().alias('total'), pl.col('monto').filter(pl.col('sin')).sum().alias('sin'),
                                                pl.col('CodigoOrganismoPublico').n_unique().alias('organismos')).sort('total', descending=True))
acumulado = (org['sin'].cum_sum() / org['sin'].sum()).to_list()

SALIDA.write_text(json.dumps({
    'fuente': 'Descarga masiva de órdenes de compra de ChileCompra (transparenciachc.blob.core.windows.net/oc-da)',
    'limpieza': 'Sin órdenes canceladas; montos con coma decimal y en UF/UTM saneados como en Tordo; una fila por orden.',
    'tope': TOPE, 'anios': ANIOS, 'recientes': list(RECIENTES),
    'formas': {'emergencia': 'Trato directo por emergencia, urgencia o imprevisto', 'unico': 'Trato directo porque hay un solo proveedor',
               'directo': 'Trato directo por otras causales', 'agil': 'Compra ágil', 'convenio': 'Convenio marco',
               'licitacion': 'Licitación pública o privada', 'informar': 'Orden «para informar» (fuera de la ley de compras)', 'otra': 'Otras'},
    'monto': serie('monto'), 'ordenes': serie('n'),
    'sectores': [{'sector': r['sector'], 'total': round(r['total']), 'sin': round(r['sin']), 'organismos': r['organismos']} for r in sectores.to_dicts()],
    'mitad': {'organismos': next(k for k, c in enumerate(acumulado) if c >= 0.5) + 1, 'de': int((org['sin'] > 0).sum())},
    'organismos': [{'codigo': r['CodigoOrganismoPublico'], 'nombre': r['OrganismoPublico'], 'corto': NOMBRES.get(r['CodigoOrganismoPublico']),
                    'sector': r['sector'], 'total': round(r['total']), 'sin': round(r['sin'])} for r in org.to_dicts()],
}, ensure_ascii=False, separators=(',', ':')))
print(f'{SALIDA}: {org.height} organismos')
