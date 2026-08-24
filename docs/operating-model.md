# Modelo operativo DS/BI para pricing

## Business Intelligence

- Mantiene catálogo, grano y reconciliación de KPIs.
- Publica vistas ejecutivas y explica variaciones.
- Controla que una cifra del dashboard tenga una única definición.

## Analytics Engineering

- Construye snapshots históricos y marts Gold.
- Implementa tests de unicidad, completitud, estados y frescura.
- Expone contratos estables al frontend y al pipeline de features.

## Data Science

- Mantiene la regla V1 como baseline.
- Entrena challengers solo con historia de precio y outcomes comparables.
- Evalúa por partición temporal, proyecto y tipología.
- Documenta calibración, drift, importancia y límites causales.

## Pricing + Comercial

- Define el objetivo y los guardrails de margen.
- Aprueba o rechaza la hipótesis de precio.
- Registra ejecución real, excepciones y fecha efectiva.
- No atribuye impacto causal a un simple antes/después.

## Gate de promoción del challenger

Un modelo puede pasar de `challenger` a `candidate` cuando:

1. supera la regla V1 fuera de muestra;
2. mantiene error y calibración aceptables por proyecto;
3. no degrada margen ni segmentos protegidos;
4. puede explicar la acción propuesta;
5. tiene rollback y monitoreo de drift.

Pasa a `production` únicamente después de una prueba controlada o una estrategia causal defendible.
