# Catálogo de métricas · corte histórico 2026

Grano publicado: `snapshot_date + project_id`.

| Métrica | Fórmula o fuente | Unidad | Uso |
|---|---|---:|---|
| Stock disponible | Conteo reportado como disponible | unidades | Inventario comercial expuesto |
| Valor estimado de stock | `stock_disponible × precio_promedio_disponible` | PEN | Aproximación del capital expuesto |
| Precio disponible/m² | Promedio reportado para stock disponible × tipo de cambio | PEN/m² | Arquitectura de precios |
| Prima vs. vendido | `precio_m2_disponible / precio_m2_vendido - 1` | % | Diagnóstico de mix y posición de precio |
| Vendidas acumuladas abril | Conteo reportado como vendido al corte | unidades | Avance histórico del proyecto |
| Avance vendido | `vendidas_acumuladas / unidades_totales` | % | Comparación de madurez comercial |
| Precio promedio vendido | Promedio reportado de unidades vendidas | PEN/unidad | Ticket histórico de referencia |
| Valor vendido histórico estimado | `vendidas_acumuladas × precio_promedio_vendido` | PEN | Orden de magnitud acumulado; no es suma transaccional |
| Separaciones mayo | Conteo del reporte mensual | unidades | Demanda comercial del mes |
| Minutas mayo | Conteo del reporte mensual | unidades | Velocidad observada del mes |
| Valor vendido mayo | Suma de minutas activas reportadas | PEN | Producción comercial |
| Ticket mayo | `valor_vendido_mayo / minutas_mayo` | PEN/minuta | Valor medio de la producción mensual |
| Mix de ventas mayo | `valor_vendido_proyecto / valor_vendido_portfolio` | % | Contribución del proyecto al mes |
| Tubería abierta mayo | Conteo y valor reportados como tubería | unidades y PEN | Visibilidad comercial de corto plazo |
| Cobertura de tubería | `valor_tubería / valor_vendido_mayo` | ratio | Escala relativa de oportunidades abiertas |
| Preventa considerada | Unidades reportadas en el bloque de preventa | unidades | Contexto adicional para proyectos aplicables |
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
- `sold_units_apr + for_sale_units_apr = total_units` en el corte agregado.
- El valor vendido de mayo debe reconciliar con S/ 16,122,261; la tubería reportada, con S/ 8,737,452.
- Los totales agregados del dashboard deben reconciliar con el archivo fuente.
- No se publican filas de clientes, asesores ni unidades individuales.

## Límites de interpretación

- Minutas de mayo pueden provenir de separaciones de meses anteriores; no son una tasa de conversión de cohorte.
- La prima del m² puede reflejar diferencias de tipología, piso o área.
- El valor de stock es estimado con un promedio, no la suma exacta por unidad.
- El valor vendido histórico también es estimado con un promedio y no debe tratarse como ingreso contable.
- Los valores de tubería por proyecto están redondeados; su suma visible difiere en S/ 1 del total reportado.
- “Preventa considerada” solo está disponible para Capadocia, Modena, Sialia, Matera y Torre Nápoles.
- No existe todavía historia suficiente de cambios de precio para estimar elasticidad causal.
