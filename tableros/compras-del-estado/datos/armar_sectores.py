"""Arma datos/sectores.json para el tablero a partir de organismos/*.parquet (de bajar.py).

Uso: TRABAJO=<carpeta de bajar.py> uv run --project <tordo> python armar_sectores.py <salida.json>

La fiebre de diciembre por sector del Estado: el monto de diciembre dividido por el mes promedio
de su año y su sector (como en diciembre.json, pero por sector), promediado en tres tramos.
El sector es el que trae la descarga para cada organismo.
"""
import json, os, sys
from pathlib import Path
import polars as pl

TRABAJO = Path(os.environ.get('TRABAJO', '.')).resolve()
SALIDA = Path(sys.argv[1])
TRAMOS = {'todos': (2007, 2025), 'antes': (2007, 2011), 'ahora': (2021, 2025)}
NOMBRES = {'Legislativo y judicial': 'Legislativo y judicial', 'Obras Públicas': 'Obras Públicas', 'Gob. Central, Universidades': 'Gobierno central y universidades',
           'Salud': 'Salud', 'Municipalidades': 'Municipios', 'FFAA': 'Fuerzas Armadas y policías'}

fs = [(f, f.name[:-8]) for f in (TRABAJO / 'organismos').glob('*.parquet')]
o = pl.concat([pl.read_parquet(f).select('sector', 'sobre_tope', 'monto')
               .with_columns(pl.lit(int(p.split('-')[0])).alias('a'), pl.lit(int(p.split('-')[1])).alias('m')) for f, p in fs]).filter(~pl.col('sobre_tope'))
s = (o.filter(pl.col('sector').is_in(list(NOMBRES))).group_by('sector', 'a', 'm').agg(pl.col('monto').sum())
     .with_columns((pl.col('monto') / pl.col('monto').mean().over('sector', 'a')).alias('idx')))
dic = s.filter(pl.col('m') == 12)
fila = lambda sec, t: dic.filter((pl.col('sector') == sec) & pl.col('a').is_between(*TRAMOS[t]))['idx'].mean()
sectores = sorted(({'sector': NOMBRES[sec], **{t: round(fila(sec, t), 3) for t in TRAMOS},
                    'monto': round(o.filter(pl.col('sector') == sec)['monto'].sum())} for sec in NOMBRES), key=lambda x: -x['todos'])
SALIDA.write_text(json.dumps({
    'fuente': 'Descarga masiva de órdenes de compra de ChileCompra (transparenciachc.blob.core.windows.net/oc-da)',
    'metodo': 'Monto de diciembre dividido por el mes promedio de su año y su sector, promediado en cada tramo. Sin las órdenes de más de $20.000 millones.',
    'tramos': TRAMOS, 'sectores': sectores,
}, ensure_ascii=False, separators=(',', ':')))
print(SALIDA, [(x['sector'], x['todos'], x['antes'], x['ahora']) for x in sectores])
