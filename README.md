# Data Science Systems · Pricing Control Tower

Sistema histórico de Data Science + Business Intelligence para gobernar pricing inmobiliario desde una sola interfaz:

`dato → métrica → señal → decisión → resultado observado`

## Qué contiene la v0.2

- Nueve proyectos reales: Tizón y Bueno, Edificio Urbanzen, Fénix, Alicanto, Capadocia, Modena, Sialia, Matera y Torre Nápoles.
- Stock y precios de abril de 2026; separaciones, minutas y valor vendido de mayo de 2026.
- Scatter de precio disponible/m² frente a meses de stock; el tamaño representa valor estimado del inventario.
- Comparación de minutas de mayo frente al ritmo calculado para agotar stock en doce meses.
- Cola de decisiones ordenada por una regla V1 auditable.
- Simulador de precio con elasticidad explícitamente asumida.
- Adopción de hipótesis, registro de resultados, persistencia local y descarga CSV.
- Acceso web mediante contraseña y cookie `HttpOnly` de ocho horas.

## Fuente y privacidad

La fuente es el **Reporte Comercial · Mayo 2026**. Solo se publican métricas agregadas por proyecto. Se excluyen clientes, asesores, documentos, teléfonos, correos y operaciones identificables.

El valor de stock mostrado es una estimación:

`stock disponible × precio promedio de las unidades disponibles`

La contraseña y el secreto de sesión no están almacenados en GitHub: viven únicamente como variables sensibles de Vercel. El acceso restringe la aplicación desplegada; los agregados versionados permanecen visibles en el repositorio público por decisión del propietario.

## Regla V1

El `pressure_score` combina:

- 60% meses de stock al ritmo de minutas de mayo.
- 25% prima positiva del m² disponible frente al m² vendido.
- 15% proporción del proyecto que sigue disponible.

La regla prioriza revisión. No demuestra que el precio cause la velocidad observada; la diferencia de m² también puede reflejar tipología, piso y mix.

## Arquitectura

- `index.html`: superficie ejecutiva y ciclo de experimento.
- `styles.css`: sistema visual responsive.
- `data.js`: snapshot histórico agregado.
- `app.js`: métricas, regla, SVG, filtros, simulación, eventos y evidencia local.
- `api/login.js`: verificación de contraseña.
- `api/gateway.js`: entrega de la aplicación solo con sesión válida.
- `api/logout.js`: cierre de sesión.
- `schemas/`: contratos del snapshot y del resultado observado.
- `docs/`: catálogo y modelo operativo.

## Vercel

Importa el repositorio con `Framework Preset: Other`. `vercel.json` enruta la interfaz y sus activos a través del gateway autenticado. Configura dos variables sensibles en Preview y Production:

- `APP_PASSWORD`: contraseña de acceso.
- `SESSION_SECRET`: secreto aleatorio largo para firmar la cookie.

## Limitaciones honestas

- El periodo es histórico y estático.
- Minutas y separaciones mensuales no forman una cohorte de conversión.
- La elasticidad del laboratorio es un supuesto, no una estimación.
- Regresión causal, XGBoost y precio óptimo requieren historia de cambios de precio por unidad y validación temporal.
- El siguiente gate productivo es conectar una vista Gold validada de `bd_replica_crm`.
