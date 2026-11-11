# Datos del tablero «Compras del Estado»

Todo sale de la [descarga masiva de órdenes de compra de ChileCompra](https://transparenciachc.blob.core.windows.net/oc-da/2025-1.zip)
(un ZIP por mes, 2007–2025, ~20 GB) y se limpia igual que en [Tordo](https://github.com/cris-middleton/tordo):
sin órdenes canceladas, montos con coma decimal y en UF/UTM saneados, una fila por orden.

## Cómo se rehace

```sh
# 1. Bajar y resumir los 228 meses (~15 min; reanudable). Usa la limpieza de Tordo.
TORDO=../tordo TRABAJO=~/datos-chilecompra uv run --project $TORDO python bajar.py

# 2. Armar el JSON de cada vista
cd ~/datos-chilecompra && python3 <aquí>/armar.py 20000000000 <aquí>/diciembre.json
export TRABAJO=~/datos-chilecompra
uv run --project ../tordo python armar_dias.py dias.json
uv run --project ../tordo python armar_sin_licitar.py sin-licitar.json
uv run --project ../tordo python armar_quien_vende.py quien-vende.json
uv run --project ../tordo python armar_regiones.py regiones.json
uv run --project ../tordo python armar_rubros.py rubros.json
```

`bajar.py` deja en `TRABAJO`, por mes, el total y unas tablas chicas (por organismo, proveedor, rubro,
día y región). Esas tablas traen nombres de proveedores, también de personas naturales: se quedan
en tu disco. Los JSON publicados sólo tienen cuentas de personas y nombres de empresas revisados a mano.

## Qué hay en cada JSON

| Archivo | Vista | Qué trae |
|---|---|---|
| `diciembre.json` | ¿El Estado se gasta todo en diciembre? | Monto y órdenes de cada mes; las órdenes fuera del tope, una a una |
| `dias.json` | Diciembre, día a día | Cada día de diciembre contra un día hábil normal (medianas) |
| `sin-licitar.json` | ¿Cuánto se compra sin licitar? | Monto y órdenes por forma de compra y año; los 1.177 organismos |
| `quien-vende.json` | ¿Quién le vende al Estado? | Proveedores por año, los doce más grandes, organismos y mercados |
| `regiones.json` | ¿A quién le compra cada región? | Matriz región que compra × región que vende, y la serie por año |
| `rubros.json` | ¿En qué gasta el Estado? | La parte de cada rubro en 2010–2012 y 2023–2025, y algunas series |

## Decisiones que conviene saber

- **El tope de $20.000 millones.** Las órdenes más grandes no suman: son errores de tipeo (una de 2008
  dice $4.135 billones) o contratos de varios años firmados en un mes. Van listadas en `diciembre.json`.
- **Un proveedor es su RUT**, el que más se repite en sus órdenes: algunas traen RUT mal escritos, y
  tomar el menor fundía empresas distintas.
- **Persona natural** = RUT bajo 50.000.000 o sin RUT legible (la regla de Tordo).
- **«Sin licitar»** = trato directo + compra ágil. El trato directo venía en el tipo de orden hasta
  2013 (D1, G1, C1, F3), después en una marca con su causal, y desde diciembre de 2024 en la ficha de
  la ley 21.634. El convenio marco cuenta como licitado.
- **La región** viene escrita de decenas de formas y se reconoce por palabras clave. La del
  proveedor es la de su ficha, que en las empresas grandes suele ser la casa matriz. Antes de 2009
  venía vacía.
- **Septiembre de 2025** en el servidor de ChileCompra estuvo vacío un tiempo; octubre a diciembre de
  2025 salen de las copias que bajó Tordo.
