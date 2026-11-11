"""Arma datos/quien-vende.json para el tablero a partir de proveedores/, rubros/, ruts/ y organismos/ (de bajar.py).

Uso: TRABAJO=<carpeta de bajar.py> uv run --project <tordo> python armar_quien_vende.py <salida.json>

Un proveedor es su RUT: el que más se repite entre sus meses (algunos códigos traen además RUT mal
escritos, y tomar el menor fundía empresas distintas). Es persona natural si ese RUT está bajo
50.000.000 o no hay ninguno legible, la regla de Tordo. De las personas sólo se publican cuentas.
Los nombres que salen en la página son únicamente los de NOMBRES, revisados a mano: si el ranking
trae un RUT que no está ahí, el script se detiene en vez de publicar un nombre sin mirar.
"""
import json, os, re, sys
from pathlib import Path
import polars as pl

TRABAJO = Path(os.environ.get('TRABAJO', '.')).resolve()
SALIDA = Path(sys.argv[1])
ANIOS = list(range(2007, 2026))
RECIENTES = (2023, 2025)
UMBRAL_PERSONA = 50_000_000
MIN_ORGANISMO = 1e9     # en el gráfico de organismos, sólo los que compraron más de $1.000 millones en el periodo
TOP = 12

# RUT → nombre corto y a qué se dedica. Sólo empresas: revisado a mano.
NOMBRES = {
    82999400: ('Roche', 'Medicamentos'), 96556930: ('Sodexo', 'Vales de alimentación'),
    99520000: ('Copec', 'Combustible'), 99507130: ('Nephrocare', 'Diálisis'),
    96781350: ('Edenred', 'Vales de alimentación'), 93745000: ('Johnson & Johnson', 'Insumos médicos'),
    83002400: ('Novartis', 'Medicamentos'), 77237150: ('Medtronic', 'Insumos médicos'),
    96981250: ('Pfizer', 'Medicamentos'), 59043540: ('MSD', 'Medicamentos'),
    92580000: ('Entel', 'Telecomunicaciones'), 96945670: ('Novofarma', 'Medicamentos'),
    81698900: ('Universidad Católica', 'Salud y educación'), 85025700: ('GSK', 'Medicamentos'),
    96756540: ('B. Braun', 'Insumos médicos'), 92999000: ('Arquimed', 'Equipos médicos'),
}

def leer(tabla, desde=ANIOS[0]):
    fs = [(f, int(f.name[:4])) for f in (TRABAJO / tabla).glob('*.parquet') if int(f.name[:4]) >= desde]
    return pl.concat([pl.read_parquet(f).with_columns(pl.lit(a).alias('anio')) for f, a in fs], how='diagonal_relaxed')

# El RUT de cada código: el de más meses
ruts = leer('ruts')
moda = (ruts.group_by('CodigoProveedor', 'rut').agg(pl.len().alias('meses')).sort(['meses', 'rut'], descending=True)
        .group_by('CodigoProveedor').agg(pl.col('rut').drop_nulls().first().alias('rut')))
con_rut = lambda df: (df.join(moda, on='CodigoProveedor', how='left', coalesce=True)
                      .with_columns(pl.coalesce(pl.col('rut').cast(pl.Utf8), pl.lit('c') + pl.col('CodigoProveedor')).alias('id'),
                                    (pl.col('rut').is_null() | (pl.col('rut') < UMBRAL_PERSONA)).alias('persona')))

pr = con_rut(leer('proveedores').filter(~pl.col('sobre_tope') & pl.col('CodigoProveedor').is_not_null()))
anual = pr.group_by('anio', 'id').agg(pl.col('monto').sum(), pl.col('persona').first(), pl.col('rut').first())
por_anio = anual.group_by('anio').agg(
    pl.len().alias('proveedores'), pl.col('persona').sum().alias('personas'), pl.col('monto').sum().alias('monto'),
    pl.col('monto').filter(pl.col('persona')).sum().alias('monto_personas'),
    pl.col('monto').sort(descending=True).head(10).sum().alias('monto_top10')).sort('anio')

# Los que más le han vendido en los 19 años, con su serie anual
total = anual.group_by('id').agg(pl.col('monto').sum(), pl.col('persona').first(), pl.col('rut').first()).sort('monto', descending=True)
top = total.filter(~pl.col('persona')).head(TOP)
faltan = [r for r in top['rut'].to_list() if r not in NOMBRES]
if faltan:
    sys.exit(f'RUT sin nombre revisado en NOMBRES: {faltan}. Revisa a mano antes de publicar.')
serie = {r['id']: [0] * len(ANIOS) for r in top.to_dicts()}
for r in anual.filter(pl.col('id').is_in(top['id'])).to_dicts():
    serie[r['id']][ANIOS.index(r['anio'])] = round(r['monto'])

# Organismos: cuánto se llevan sus cinco proveedores más grandes (los años recientes)
rec = pr.filter(pl.col('anio').is_between(*RECIENTES))
org = (rec.group_by('CodigoOrganismoPublico', 'id').agg(pl.col('monto').sum()).filter(pl.col('monto') > 0)
       .sort('monto', descending=True).group_by('CodigoOrganismoPublico')
       .agg(pl.col('monto').sum().alias('total'), pl.col('monto').head(5).sum().alias('top5'), pl.col('monto').first().alias('top1'), pl.len().alias('proveedores'))
       .filter(pl.col('total') > MIN_ORGANISMO))
info = (leer('organismos', RECIENTES[0]).sort('anio', descending=True).group_by('CodigoOrganismoPublico')
        .agg(pl.col('OrganismoPublico').first(), pl.col('sector').first()))
org = org.join(info, on='CodigoOrganismoPublico', how='left', coalesce=True).sort(['total', 'CodigoOrganismoPublico'], descending=True)

MENORES = {'de', 'del', 'la', 'las', 'los', 'y', 'e', 'el', 'en', 'para', 'por', 'a'}
SIGLAS = {'serviu', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiv', 'xv', 'xvi', 'ffaa', 'ss'}
def bonito(nombre):
    """«I MUNICIPALIDAD DE NUNOA» → «Municipalidad de Nunoa» (el archivo trae los nombres en mayúsculas y sin eñes)."""
    nombre = re.sub(r'^I\.?\s+(MUNICIPALIDAD)', r'\1', (nombre or '').strip(), flags=re.I)
    palabras = re.sub(r'\s+', ' ', nombre).lower().split(' ')
    return ' '.join(p.upper() if p in SIGLAS else p if (k and p in MENORES) else p[:1].upper() + p[1:] for k, p in enumerate(palabras))

# Mercados: qué parte se lleva el proveedor más grande de cada rubro (años recientes)
ru = con_rut(leer('rubros', RECIENTES[0]).filter(~pl.col('sobre_tope') & pl.col('RubroN2').is_not_null()))
mer = (ru.group_by('RubroN1', 'RubroN2', 'id').agg(pl.col('monto').sum(), pl.col('persona').first(), pl.col('rut').first())
       .filter(pl.col('monto') > 0).sort('monto', descending=True).group_by('RubroN1', 'RubroN2')
       .agg(pl.col('monto').sum().alias('total'), pl.col('monto').first().alias('top1'), pl.col('rut').first().alias('rut1'),
            pl.col('persona').first().alias('persona1'), pl.len().alias('proveedores'))
       .with_columns((pl.col('top1') / pl.col('total')).alias('parte')).sort(['total', 'RubroN2'], descending=True))

SALIDA.write_text(json.dumps({
    'fuente': 'Descarga masiva de órdenes de compra de ChileCompra (transparenciachc.blob.core.windows.net/oc-da)',
    'limpieza': 'Sin órdenes canceladas; montos con coma decimal y en UF/UTM saneados como en Tordo; una fila por orden. Sin las órdenes de más de $20.000 millones.',
    'personas': 'Un proveedor es persona natural si su RUT está bajo 50.000.000 o no tiene uno legible: de ellas sólo se publican cuentas.',
    'anios': ANIOS, 'recientes': list(RECIENTES),
    'por_anio': [{k: (round(v) if isinstance(v, float) else v) for k, v in r.items()} for r in por_anio.to_dicts()],
    'top': [{'nombre': NOMBRES[r['rut']][0], 'rubro': NOMBRES[r['rut']][1], 'total': round(r['monto']), 'serie': serie[r['id']]} for r in top.to_dicts()],
    'organismos': [{'nombre': bonito(r['OrganismoPublico']), 'sector': r['sector'], 'total': round(r['total']), 'top5': round(r['top5']),
                    'top1': round(r['top1']), 'proveedores': r['proveedores']} for r in org.to_dicts()],
    'mercados': [{'rubro': r['RubroN2'], 'grupo': r['RubroN1'], 'total': round(r['total']), 'parte': round(r['parte'], 4), 'proveedores': r['proveedores'],
                  'lider': NOMBRES[r['rut1']][0] if r['rut1'] in NOMBRES else None} for r in mer.to_dicts()],
}, ensure_ascii=False, separators=(',', ':')))
print(f'{SALIDA}: {org.height} organismos, {mer.height} mercados, top: {[NOMBRES[r][0] for r in top["rut"].to_list()]}')
