# Catálogo de métricas · corte histórico 2026

Grano publicado: `snapshot_date + project_id`.

| Métrica | Fórmula o fuente | Unidad | Uso |
|---|---|---:|---|
| Stock disponible | Conteo reportado como disponible | unidades | Inventario comercial expuesto |
| Valor estimado de stock | `stock_disponible × precio_promedio_disponible` | PEN | Aproximación del capital expuesto |
| Precio disponible/m² | Promedio reportado para stock disponible × tipo de cambio | PEN/m² | Arquitectura de precios |
| Prima vs. vendido | `precio_m2_disponible / precio_m2_vendido - 1` | % | Diagnóstico de mix y posición de precio |
| Separaciones mayo | Conteo del reporte mensual | unidades | Demanda comercial del mes |
| Minutas mayo | Conteo del reporte mensual | unidades | Velocidad observada del mes |
| Valor vendido mayo | Suma de minutas activas reportadas | PEN | Producción comercial |
| Meses de stock | `stock_disponible / minutas_mayo` | meses | Cobertura al ritmo observado |
| Ritmo requerido 12m | `stock_disponible / 12` | unidades/mes | Comparador calculado, no meta aprobada |
| Balance de estacionamientos | `cocheras_disponibles - cocheras_requeridas` | unidades | Riesgo de déficit o excedente |
| Pressure score V1 | 60% meses + 25% prima + 15% participación disponible | 0–100 | Orden de revisión |

## Periodos

- Stock y precios: abril de 2026.
- Separaciones, minutas y valor vendido: mayo de 2026.
- Fuente: `Reporte Comercial - Mayo 2026.pdf`.

## Reglas de calidad

- Un solo registro por proyecto en el snapshot publicado.
- Stock, valores y conteos no negativos.
- `available_units <= total_units`.
- Los totales agregados del dashboard deben reconciliar con el archivo fuente.
- No se publican filas de clientes, asesores ni unidades individuales.

## Límites de interpretación

- Minutas de mayo pueden provenir de separaciones de meses anteriores; no son una tasa de conversión de cohorte.
- La prima del m² puede reflejar diferencias de tipología, piso o área.
- El valor de stock es estimado con un promedio, no la suma exacta por unidad.
- No existe todavía historia suficiente de cambios de precio para estimar elasticidad causal.
