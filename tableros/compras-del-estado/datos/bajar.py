"""El gasto de cada mes en órdenes de compra, 2007–2025, desde la descarga masiva de ChileCompra.

Usa la limpieza de Tordo (etl/analytics/data_loader): sin canceladas, números con coma
decimal, montos en UF/UTM imposibles saneados, una fila por orden. Por mes guarda, para no
volver a bajar 20 GB:
    resultados/<mes>.json     el total y los grupos por sector, trato directo y tipo de orden
    organismos/<mes>.parquet  monto y órdenes por organismo y forma de compra
    proveedores/<mes>.parquet monto y órdenes por organismo y proveedor
    rubros/<mes>.parquet      monto por rubro y proveedor, repartido por línea
    ruts/<mes>.parquet        código y RUT de cada proveedor, para tapar a las personas naturales
Lo que pasa del tope no se suma: queda marcado con `sobre_tope`. Estos archivos tienen nombres
de proveedores, también de personas: se quedan en TRABAJO y no se publican tal cual.
Reanudable: salta los meses que ya tienen resultado. Con meses como argumento («2025-10»), sólo esos.
Uso, con el repo de Tordo (github.com/cris-middleton/tordo) al lado:
    TORDO=../tordo uv run --project $TORDO python bajar.py
"""
import io, json, logging, os, sys, time, zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import urllib.request

TORDO = Path(os.environ.get('TORDO', '../tordo')).resolve()
sys.path.insert(0, str(TORDO / 'etl'))
import polars as pl
from analytics.data_loader import con_vacios, sin_canceladas, con_numeros, con_monto_saneado, con_monto_por_linea, orden_por_fila
from analytics.personas import numero_rut

AQUI = Path(os.environ.get('TRABAJO', '.')).resolve()   # dónde quedan los ZIP y los resultados por mes
ZIPS, RES = AQUI / 'zip', AQUI / 'resultados'
TABLAS = ('organismos', 'proveedores', 'rubros', 'ruts')
for d in (ZIPS, RES, *(AQUI / t for t in TABLAS)):
    d.mkdir(parents=True, exist_ok=True)
LOCALES = TORDO / 'etl/data/raw/oc'
URL = 'https://transparenciachc.blob.core.windows.net/oc-da/{}.zip'
COLS = ['Codigo', 'Estado', 'FechaCreacion', 'MontoTotalOC', 'TipoMonedaOC', 'MontoTotalOC_PesosChilenos',
        'totalLineaNeto', 'monedaItem', 'OrganismoPublico', 'sector', 'EsTratoDirecto', 'CodigoAbreviadoTipoOC', 'Nombre',
        'CodigoOrganismoPublico', 'EsCompraAgil', 'ProcedenciaOC', 'DescripcionTipoOC', 'CodigoLicitacion', 'Codigo_ConvenioMarco',
        'CodigoProveedor', 'NombreProveedor', 'RutSucursal', 'RubroN1', 'RubroN2']
GRANDE = 1_000_000_000   # las órdenes sobre esto se guardan una a una, para auditar y elegir el corte
TOPE = 20_000_000_000    # sobre esto, error de tipeo o contrato de varios años (ver armar.py)
logging.basicConfig(filename=AQUI / 'bajar.log', level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger('fiebre')


def bajar(periodo):
    local = LOCALES / f'{periodo}.zip'
    if local.exists():
        return local, False
    destino = ZIPS / f'{periodo}.zip'
    for intento in range(4):
        try:
            urllib.request.urlretrieve(URL.format(periodo), destino)
            return destino, True
        except Exception as e:
            log.warning('%s: intento %d falló: %s', periodo, intento + 1, e)
            time.sleep(5 * (intento + 1))
    raise RuntimeError(f'{periodo}: no se pudo bajar')


def leer(zip_path):
    with zipfile.ZipFile(zip_path) as zf:
        csv = [f for f in zf.namelist() if f.lower().endswith('.csv')][0]
        crudo = zf.read(csv)
    for enc in ('latin-1', 'utf-8', 'cp1252'):
        texto = crudo.decode(enc).encode('utf-8')
        for sep in (';', ',', '\t'):
            cabeza = pl.read_csv(io.BytesIO(texto), separator=sep, n_rows=1, infer_schema_length=0, truncate_ragged_lines=True)
            if len(cabeza.columns) < 5:
                continue
            cols = [c for c in COLS if c in cabeza.columns]
            df = pl.read_csv(io.BytesIO(texto), separator=sep, columns=cols, infer_schema_length=0,
                             truncate_ragged_lines=True, ignore_errors=True)
            faltan = [c for c in COLS if c not in cabeza.columns]
            return df.with_columns([pl.lit(None, dtype=pl.Utf8).alias(c) for c in faltan]), faltan
    raise RuntimeError(f'{zip_path.name}: no se pudo leer el CSV')


def tablas(periodo, lineas, ordenes):
    """Las tablas por organismo, proveedor y rubro del mes (ver el encabezado)."""
    monto, tope = pl.col('MontoTotalOC_PesosChilenos'), pl.col('MontoTotalOC_PesosChilenos') > TOPE
    suma = [monto.sum().alias('monto'), pl.len().alias('n')]
    con = lambda c: ~(pl.col(c).cast(pl.Utf8).str.strip_chars().is_in(['NA', 'null', '']) | pl.col(c).is_null())   # vienen «NA» escritos
    ordenes = ordenes.with_columns(tope.fill_null(False).alias('sobre_tope'),
                                   con('CodigoLicitacion').alias('con_licitacion'), con('Codigo_ConvenioMarco').alias('con_convenio'))
    ordenes.group_by(['CodigoOrganismoPublico', 'OrganismoPublico', 'sector', 'EsTratoDirecto', 'EsCompraAgil', 'ProcedenciaOC',
                      'CodigoAbreviadoTipoOC', 'DescripcionTipoOC', 'con_licitacion', 'con_convenio', 'sobre_tope']).agg(suma) \
        .write_parquet(AQUI / 'organismos' / f'{periodo}.parquet')
    ordenes.group_by(['CodigoOrganismoPublico', 'CodigoProveedor', 'EsTratoDirecto', 'sobre_tope']).agg(
        *suma, pl.col('NombreProveedor').first()).write_parquet(AQUI / 'proveedores' / f'{periodo}.parquet')
    lineas = con_monto_por_linea(lineas).with_columns(tope.fill_null(False).alias('sobre_tope'))
    lineas.group_by(['RubroN1', 'RubroN2', 'CodigoProveedor', 'sobre_tope']).agg(
        pl.col('monto_linea_clp').sum().alias('monto'), pl.len().alias('lineas'), pl.col('Codigo').n_unique().alias('n')) \
        .write_parquet(AQUI / 'rubros' / f'{periodo}.parquet')
    lineas.select('CodigoProveedor', numero_rut('RutSucursal').alias('rut')).unique() \
        .write_parquet(AQUI / 'ruts' / f'{periodo}.parquet')


def procesar(periodo):
    salida = RES / f'{periodo}.json'
    if salida.exists():
        return periodo, 'ya estaba'
    t = time.time()
    zip_path, temporal = bajar(periodo)
    if zip_path.stat().st_size < 1_000_000:
        txt = zip_path.read_bytes()[:300]
        if temporal: zip_path.unlink()
        salida.write_text(json.dumps({'periodo': periodo, 'error': 'archivo vacío en ChileCompra', 'muestra': txt.decode('latin-1')}))
        return periodo, 'SIN ARCHIVO'
    df, faltan = leer(zip_path)
    lineas = len(df)
    df = con_vacios(df)
    canceladas_lineas = lineas - len(sin_canceladas(df))
    df = con_monto_saneado(con_numeros(sin_canceladas(df)))
    ordenes = orden_por_fila(df)
    monto = pl.col('MontoTotalOC_PesosChilenos')
    tablas(periodo, df, ordenes)
    grupos_cols = [c for c in ('sector', 'EsTratoDirecto', 'CodigoAbreviadoTipoOC') if c in ordenes.columns]
    grupos = ordenes.group_by(grupos_cols).agg(monto.sum().alias('monto'), pl.len().alias('n')).sort('monto', descending=True)
    fechas = ordenes.select(pl.col('FechaCreacion').cast(pl.Utf8).str.slice(0, 7).alias('m')).group_by('m').agg(pl.len().alias('n')).sort('n', descending=True).head(5)
    res = {
        'periodo': periodo, 'lineas': lineas, 'lineas_canceladas': canceladas_lineas, 'ordenes': len(ordenes),
        'monto': ordenes.select(monto.sum()).item(), 'sin_monto': ordenes.select(monto.is_null().sum()).item(),
        'columnas_faltantes': faltan, 'fechas': fechas.to_dicts(), 'grupos': grupos.to_dicts(),
        'grandes': ordenes.filter(monto > GRANDE).select([c for c in ('Codigo', 'OrganismoPublico', 'Nombre', 'sector', 'TipoMonedaOC', 'MontoTotalOC', 'MontoTotalOC_PesosChilenos', 'EsTratoDirecto', 'CodigoAbreviadoTipoOC') if c in ordenes.columns]).sort('MontoTotalOC_PesosChilenos', descending=True).to_dicts(),
    }
    salida.write_text(json.dumps(res, ensure_ascii=False))
    if temporal: zip_path.unlink()
    return periodo, f"{res['ordenes']:,} órdenes, ${res['monto'] / 1e9:,.0f} mil millones, {time.time() - t:.0f} s"


if __name__ == '__main__':
    periodos = sys.argv[1:] or [f'{a}-{m}' for a in range(2007, 2026) for m in range(1, 13)]
    errores = 0
    with ThreadPoolExecutor(max_workers=3) as ex:
        futuros = {ex.submit(procesar, p): p for p in periodos}
        for f in as_completed(futuros):
            try:
                p, msg = f.result(); log.info('%s: %s', p, msg)
            except Exception as e:
                errores += 1; log.exception('%s: %s', futuros[f], e)
    hechos = len(list(RES.glob('*.json')))
    log.info('LISTO: %d de %d meses con resultado, %d errores', hechos, len(periodos), errores)
    print(f'LISTO: {hechos} de {len(periodos)} meses, {errores} errores')
