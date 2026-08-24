# Data Science Systems · Pricing Control Tower

Primer sistema demostrativo de Data Science + Business Intelligence para gobernar pricing inmobiliario desde una sola interfaz:

`dato → métrica → señal → decisión → resultado observado`

## Qué contiene la v0.1

- Portfolio de 9 proyectos con stock, valor disponible, precio/m², absorción, conversión y meses de stock.
- Scatter de precio/m² vs. meses de stock; el tamaño representa valor de inventario.
- Comparación de absorción neta 30d frente al objetivo comercial.
- Cola de decisiones ordenada por una regla V0 de presión auditable.
- Simulador de ajuste de precio con elasticidad editable.
- Adopción de hipótesis, registro del resultado observado, persistencia local y descarga CSV.
- Eventos de uso guardados en `localStorage` para instrumentar el flujo antes de añadir analítica remota.
- Contratos JSON Schema, catálogo de métricas y modelo operativo DS/BI.

## Estado de los datos

Los nombres de proyecto son reales; **todas las cifras incluidas son demostrativas**. La aplicación no debe usarse todavía para ejecutar cambios comerciales.

La integración productiva prevista usa un snapshot por proyecto:

`snapshot_date + project_id`

El contrato completo está en [`schemas/pricing_snapshot.schema.json`](schemas/pricing_snapshot.schema.json). Una vista candidata en `bd_replica_crm` sería `analytics.v_pricing_project_snapshot`.

## Regla V0

El `pressure_score` combina:

- 45% meses de stock.
- 25% días promedio en stock.
- 20% brecha positiva de precio/m² frente al benchmark.
- 10% caídas de los últimos 30 días.

No es un modelo de machine learning. Su función es crear un baseline interpretable contra el cual evaluar un challenger.

## Arquitectura

- `index.html`: superficie ejecutiva y ciclo de experimento.
- `styles.css`: sistema visual responsive y accesible.
- `data.js`: snapshot demostrativo reemplazable.
- `app.js`: métricas, reglas, SVG, filtros, simulación, eventos y evidencia local.
- `schemas/`: contratos de entrada y resultado observado.
- `docs/metric-catalog.md`: definiciones de negocio.
- `docs/operating-model.md`: responsabilidades y promoción de modelos.

## Ejecutar localmente

No existen dependencias de ejecución. Sirve la carpeta con cualquier servidor estático:

```bash
python -m http.server 4173
```

Luego abre `http://localhost:4173`.

## Vercel

Importa el repositorio como `Framework Preset: Other`. No necesita Build Command, Output Directory ni variables de entorno para la demo.

## Siguiente gate

La v0.1 termina cuando el frontend, la regla y el registro de outcomes funcionan. La siguiente fase empieza solo al disponer de:

1. snapshots históricos de precio e inventario;
2. definiciones conciliadas de venta/separación/caída;
3. una vista Gold validada contra CRM;
4. partición temporal para comparar baseline y challenger;
5. aprobación comercial y guardrails de margen.

