# Catálogo mínimo de métricas

Grano objetivo: `snapshot_date + project_id`.

| Métrica | Fórmula | Unidad | Uso de decisión |
|---|---|---:|---|
| Stock disponible | `COUNT(unidad disponible)` | unidades | Tamaño del inventario expuesto |
| Valor de stock | `SUM(precio_lista de disponibles)` | PEN | Capital comercial expuesto |
| Precio lista/m² | `SUM(precio_lista) / SUM(area_total_m2)` | PEN/m² | Posición y arquitectura de precios |
| Absorción neta 30d | `ventas_30d - caidas_30d` o definición conciliada | unidades/30d | Velocidad de salida |
| Meses de stock | `stock_disponible / MAX(absorcion_neta_30d, piso)` | meses | Riesgo de inventario lento |
| Conversión | `separaciones_30d / leads_30d` | % | Calidad de demanda y ejecución |
| Brecha vs. benchmark | `precio_m2 / benchmark_m2 - 1` | % | Posición competitiva |
| Días promedio en stock | `AVG(snapshot_date - fecha_entrada_stock)` | días | Antigüedad del inventario |
| Pressure score V0 | combinación normalizada de cuatro señales | 0–100 | Orden de revisión, no decisión automática |

## Reglas de calidad

- `project_id` y `snapshot_date` no pueden ser nulos.
- Un solo registro por `snapshot_date + project_id`.
- Valores monetarios, áreas, stock y conteos no negativos.
- `conversion_pct` entre 0 y 100.
- Los estados comerciales deben pasar por un catálogo normalizado.
- Un snapshot con fuente real debe incluir `source_updated_at` y `quality_status`.

## Semántica pendiente de conciliación

- Si absorción usa separaciones, ventas o ambas.
- Tratamiento de anulaciones dentro de la ventana.
- Precio lista vigente versus precio al momento de separar o vender.
- Unidad de benchmark: proyecto, microzona, tipología o grupo comparable.

