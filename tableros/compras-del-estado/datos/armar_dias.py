"""Arma datos/dias.json para el tablero a partir de dias/*.parquet (de bajar.py).

Uso: TRABAJO=<carpeta de bajar.py> uv run --project <tordo> python armar_dias.py <salida.json>

Un día suelto depende de unas pocas órdenes gigantes, así que todo va con medianas: cada día hábil
se divide por la mediana de los días hábiles de su año (1,0 = un día hábil normal de ese año), y
para cada fecha de diciembre se toma la mediana de los años. Desde 2009: antes, la fecha de algunas
órdenes cae fuera de su mes.
"""
import json, os, sys
from pathlib import Path
import polars as pl

TRABAJO = Path(os.environ.get('TRABAJO', '.')).resolve()
SALIDA = Path(sys.argv[1])
DESDE, HASTA = 2009, 2025

d = (pl.concat([pl.read_parquet(f) for f in (TRABAJO / 'dias').glob('*.parquet')], how='diagonal_relaxed')
     .filter(~pl.col('sobre_tope')).with_columns(pl.col('dia').str.to_date(strict=False).alias('f'))
     .filter(pl.col('f').is_not_null() & pl.col('f').dt.year().is_between(DESDE, HASTA))
     .group_by('f').agg(pl.col('monto').sum(), pl.col('n').sum())
     .with_columns(pl.col('f').dt.year().alias('a'), pl.col('f').dt.month().alias('m'), pl.col('f').dt.day().alias('d'), pl.col('f').dt.weekday().alias('ds')))
habiles = d.filter(pl.col('ds') <= 5).with_columns(
    (pl.col('monto') / pl.col('monto').median().over('a')).alias('im'), (pl.col('n') / pl.col('n').median().over('a')).alias('io'))
dic = habiles.filter(pl.col('m') == 12).group_by('d').agg(pl.col('im').median(), pl.col('io').median(), pl.len().alias('anios')).sort('d')
semana = habiles.group_by('ds').agg(pl.col('im').median(), pl.col('io').median()).sort('ds')
finde = d.group_by(pl.col('ds') >= 6).agg(pl.col('monto').sum())
SALIDA.write_text(json.dumps({
    'fuente': 'Descarga masiva de órdenes de compra de ChileCompra (transparenciachc.blob.core.windows.net/oc-da)',
    'metodo': 'Días hábiles divididos por la mediana de los días hábiles de su año; mediana entre años. Sin las órdenes de más de $20.000 millones.',
    'desde': DESDE, 'hasta': HASTA,
    'diciembre': [{'dia': r['d'], 'monto': round(r['im'], 3), 'ordenes': round(r['io'], 3), 'anios': r['anios']} for r in dic.to_dicts()],
    'semana': [{'dia': r['ds'], 'monto': round(r['im'], 3), 'ordenes': round(r['io'], 3)} for r in semana.to_dicts()],
    'fin_de_semana': round(finde.filter(pl.col('ds'))['monto'].sum() / finde['monto'].sum(), 4),
}, ensure_ascii=False, separators=(',', ':')))
print(f'{SALIDA}: {dic.height} días de diciembre')
