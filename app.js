const sourceData = typeof window !== "undefined" ? window.PRICING_CONTROL_TOWER_DATA : null;

const signalLabels = {
  act: "Actuar",
  hold: "Mantener",
  opportunity: "Oportunidad"
};

const priorityLabels = {
  high: "Alta",
  medium: "Media",
  low: "Baja"
};

const state = {
  projectFilter: "all",
  signalFilter: "all",
  selectedId: null,
  projection: null
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const byId = (id) => document.getElementById(id);
const sum = (rows, key) => rows.reduce((total, row) => total + Number(row[key] || 0), 0);

const formatInteger = (value) => new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 }).format(value);
const formatDecimal = (value, digits = 1) => new Intl.NumberFormat("es-PE", {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits
}).format(value);
const formatMoney = (value) => new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  maximumFractionDigits: 0
}).format(value).replace("PEN", "S/");
const formatCompactMoney = (value) => `S/ ${(value / 1000000).toFixed(1)} M`;
const formatPercent = (value, digits = 1) => `${value >= 0 ? "+" : ""}${(value * 100).toFixed(digits)}%`;

function projectMetrics(project) {
  const priceM2 = Math.round(project.priceM2Usd * project.exchangeRate);
  const soldPriceM2 = Math.round(project.soldPriceM2Usd * project.exchangeRate);
  const pricePremiumPct = project.priceM2Usd / Math.max(project.soldPriceM2Usd, 1) - 1;
  const netSales30d = project.minutasMay;
  const monthsStock = project.availableUnits / Math.max(netSales30d, 0.25);
  const availableShare = project.availableUnits / Math.max(project.totalUnits, 1);
  const targetSales30d = project.availableUnits / 12;
  const parkingBalance = project.parkingAvailable - project.parkingRequired;
  return {
    ...project,
    priceM2,
    soldPriceM2,
    pricePremiumPct,
    marketGapPct: pricePremiumPct,
    netSales30d,
    monthsStock,
    availableShare,
    targetSales30d,
    parkingBalance
  };
}

function pressureScore(project) {
  const metrics = project.monthsStock == null ? projectMetrics(project) : project;
  return Math.round(
    60 * clamp(metrics.monthsStock / 36, 0, 1) +
    25 * clamp(Math.max(metrics.pricePremiumPct, 0) / 0.25, 0, 1) +
    15 * clamp(metrics.availableShare / 0.7, 0, 1)
  );
}

function classifyProject(project) {
  const metrics = projectMetrics(project);
  const pressure = pressureScore(metrics);
  let signal = "hold";
  if (metrics.monthsStock >= 18 || metrics.pricePremiumPct >= 0.15) signal = "act";
  if (metrics.monthsStock <= 6 && metrics.pricePremiumPct <= 0.08) signal = "opportunity";

  const priority = signal === "act" ? "high" : pressure >= 38 ? "medium" : "low";
  const recommendation = signal === "act"
    ? "Revisar mix y probar un ajuste acotado"
    : signal === "opportunity"
      ? "Evitar descuento general y proteger valor"
      : "Mantener lista y vigilar ritmo comercial";
  const reason = signal === "act"
    ? `${formatDecimal(metrics.monthsStock)} meses de stock al ritmo de mayo y una prima de ${formatPercent(metrics.pricePremiumPct)} frente al m² vendido elevan la prioridad. La prima puede reflejar mix, por lo que debe validarse por tipología.`
    : signal === "opportunity"
      ? `El stock equivale a ${formatDecimal(metrics.monthsStock)} meses al ritmo observado y la diferencia frente al m² vendido es ${formatPercent(metrics.pricePremiumPct)}; no hay evidencia para un descuento general.`
      : `El proyecto combina ${formatDecimal(metrics.monthsStock)} meses de stock con una prima de ${formatPercent(metrics.pricePremiumPct)}. Conviene sostener lista y revisar el desempeño por unidad antes de intervenir.`;

  return { ...metrics, pressure, signal, priority, recommendation, reason };
}

function enrichProjects(projects) {
  return projects.map(classifyProject);
}

function calculateProjection(project, priceAdjustmentPct, elasticity) {
  const enriched = project.monthsStock == null ? classifyProject(project) : project;
  const priceRatio = 1 + priceAdjustmentPct / 100;
  const demandMultiplier = Math.pow(priceRatio, elasticity);
  const projectedAbsorption = Math.max(enriched.netSales30d * demandMultiplier, 0.1);
  const projectedMonthsStock = enriched.availableUnits / projectedAbsorption;
  const proposedPriceM2 = Math.round(enriched.priceM2 * priceRatio / 10) * 10;
  const projectedSalesValue = projectedAbsorption * enriched.averageAvailablePricePen * priceRatio;
  return {
    projectId: enriched.id,
    projectName: enriched.name,
    calculatedAt: new Date().toISOString(),
    priceAdjustmentPct,
    elasticity,
    currentPriceM2: enriched.priceM2,
    proposedPriceM2,
    baseAbsorption: enriched.netSales30d,
    projectedAbsorption,
    baseMonthsStock: enriched.monthsStock,
    projectedMonthsStock,
    projectedSalesValue,
    demandMultiplier,
    sourceMode: "historical_real"
  };
}

function getProjects() {
  if (!sourceData || !Array.isArray(sourceData.projects)) return [];
  return enrichProjects(sourceData.projects);
}

function getFilteredProjects(projects) {
  return projects.filter((project) => {
    const matchesProject = state.projectFilter === "all" || project.id === state.projectFilter;
    const matchesSignal = state.signalFilter === "all" || project.signal === state.signalFilter;
    return matchesProject && matchesSignal;
  });
}

function svgFrame(id, title, description, width, height, body) {
  return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${id}-title ${id}-desc" focusable="false">
    <title id="${id}-title">${title}</title>
    <desc id="${id}-desc">${description}</desc>
    ${body}
  </svg>`;
}

function scaleLinear(domainMin, domainMax, rangeMin, rangeMax) {
  if (domainMin === domainMax) return () => (rangeMin + rangeMax) / 2;
  return (value) => rangeMin + ((value - domainMin) / (domainMax - domainMin)) * (rangeMax - rangeMin);
}

function renderKpis(projects) {
  const units = sum(projects, "availableUnits");
  const value = sum(projects, "availableValue");
  const absorption = sum(projects, "netSales30d");
  const months = units / Math.max(absorption, 0.1);
  byId("kpiUnits").textContent = formatInteger(units);
  byId("kpiUnitsContext").textContent = `${projects.length} proyecto${projects.length === 1 ? "" : "s"} · abril 2026`;
  byId("kpiValue").textContent = formatCompactMoney(value);
  byId("kpiAbsorption").textContent = formatDecimal(absorption, 0);
  byId("kpiAbsorptionContext").textContent = "minutas · mayo 2026";
  byId("kpiMonths").textContent = formatDecimal(months);
}

function renderScatter(projects) {
  const target = byId("scatterChart");
  const width = 720;
  const height = 410;
  const left = 70;
  const right = 28;
  const top = 30;
  const bottom = 58;
  if (!projects.length) {
    target.innerHTML = svgFrame("portfolio-scatter", "Sin resultados", "No hay proyectos para los filtros seleccionados.", width, height, "");
    return;
  }

  const maxMonths = Math.max(...projects.map((project) => project.monthsStock));
  const xMax = Math.max(24, Math.ceil(maxMonths / 6) * 6);
  const minPrice = Math.min(...projects.map((project) => project.priceM2));
  const maxPrice = Math.max(...projects.map((project) => project.priceM2));
  const yMin = Math.max(0, Math.floor((minPrice - 500) / 500) * 500);
  const yMax = Math.ceil((maxPrice + 500) / 500) * 500;
  const minValue = Math.min(...projects.map((project) => project.availableValue));
  const maxValue = Math.max(...projects.map((project) => project.availableValue));
  const xScale = scaleLinear(0, xMax, left, width - right);
  const yScale = scaleLinear(yMin, yMax, height - bottom, top);
  const valueScale = scaleLinear(minValue, maxValue, 7, 19);
  const xTicks = Array.from({ length: Math.floor(xMax / 6) + 1 }, (_, index) => index * 6);
  const yStep = Math.max(500, Math.ceil((yMax - yMin) / 5 / 500) * 500);
  const yTicks = [];
  for (let tick = yMin; tick <= yMax; tick += yStep) yTicks.push(tick);

  const grid = `${xTicks.map((tick) => `
      <line class="chart-gridline" x1="${xScale(tick)}" x2="${xScale(tick)}" y1="${top}" y2="${height - bottom}" />
      <text class="chart-tick" x="${xScale(tick)}" y="${height - 34}" text-anchor="middle">${tick}</text>`).join("")}
    ${yTicks.map((tick) => `
      <line class="chart-gridline" x1="${left}" x2="${width - right}" y1="${yScale(tick)}" y2="${yScale(tick)}" />
      <text class="chart-tick" x="${left - 10}" y="${yScale(tick) + 4}" text-anchor="end">${formatInteger(tick)}</text>`).join("")}
    <line class="chart-axis" x1="${left}" x2="${width - right}" y1="${height - bottom}" y2="${height - bottom}" />
    <line class="chart-axis" x1="${left}" x2="${left}" y1="${top}" y2="${height - bottom}" />
    <text class="chart-label" x="${(left + width - right) / 2}" y="${height - 8}" text-anchor="middle">Meses de stock al ritmo de mayo</text>
    <text class="chart-label" x="16" y="${(top + height - bottom) / 2}" text-anchor="middle" transform="rotate(-90 16 ${(top + height - bottom) / 2})">Precio disponible / m² (S/)</text>`;

  const threshold = 18 <= xMax ? `
    <line class="chart-threshold" x1="${xScale(18)}" x2="${xScale(18)}" y1="${top}" y2="${height - bottom}" />
    <text class="chart-quadrant-label" x="${xScale(18) + 8}" y="${top + 14}">RITMO LENTO</text>` : "";

  const marks = projects.map((project) => {
    const x = xScale(project.monthsStock);
    const y = yScale(project.priceM2);
    const radius = valueScale(project.availableValue);
    const labelAnchor = x + radius + 72 > width ? "end" : "start";
    const labelX = labelAnchor === "end" ? x - radius - 5 : x + radius + 5;
    return `
      <circle class="scatter-dot scatter-${project.signal}" data-project-id="${project.id}" cx="${x}" cy="${y}" r="${radius}">
        <title>${project.name} · ${formatDecimal(project.monthsStock)} meses · ${formatMoney(project.priceM2)} / m² · ${formatCompactMoney(project.availableValue)} estimados</title>
      </circle>
      <text class="scatter-label" x="${labelX}" y="${y + 3}" text-anchor="${labelAnchor}">${project.name}</text>`;
  }).join("");

  target.innerHTML = svgFrame(
    "portfolio-scatter",
    "Precio disponible por metro cuadrado frente a meses de stock",
    `${projects.length} proyectos históricos. El tamaño representa valor estimado del stock disponible.`,
    width,
    height,
    `${grid}${threshold}${marks}`
  );
}

function renderAbsorption(projects) {
  const target = byId("absorptionChart");
  const ordered = [...projects].sort((a, b) => b.netSales30d - a.netSales30d);
  const width = 610;
  const rowHeight = 36;
  const top = 38;
  const bottom = 42;
  const left = 132;
  const right = 48;
  const height = Math.max(250, top + bottom + ordered.length * rowHeight);
  const maxValue = Math.max(4, ...ordered.flatMap((project) => [project.netSales30d, project.targetSales30d])) * 1.08;
  const xScale = scaleLinear(0, maxValue, left, width - right);
  const tickStep = Math.max(1, Math.ceil(maxValue / 5));
  const ticks = [];
  for (let tick = 0; tick <= maxValue; tick += tickStep) ticks.push(tick);
  const grid = ticks.map((tick) => `
    <line class="chart-gridline" x1="${xScale(tick)}" x2="${xScale(tick)}" y1="${top - 14}" y2="${height - bottom + 5}" />
    <text class="chart-tick" x="${xScale(tick)}" y="${height - 16}" text-anchor="middle">${tick}</text>`).join("");
  const bars = ordered.map((project, index) => {
    const y = top + index * rowHeight;
    const actualWidth = xScale(project.netSales30d) - left;
    const targetX = xScale(project.targetSales30d);
    return `
      <text class="bar-label" x="${left - 9}" y="${y + 14}" text-anchor="end">${project.name}</text>
      <rect class="bar-track" x="${left}" y="${y}" width="${width - right - left}" height="18" />
      <rect class="bar-fill-${project.signal}" x="${left}" y="${y}" width="${actualWidth}" height="18">
        <title>${project.name}: ${formatDecimal(project.netSales30d, 0)} minutas en mayo; ritmo requerido a 12 meses ${formatDecimal(project.targetSales30d)}</title>
      </rect>
      <line class="bar-target" x1="${targetX}" x2="${targetX}" y1="${y - 3}" y2="${y + 21}" />
      <text class="bar-value" x="${Math.min(xScale(project.netSales30d) + 7, width - 25)}" y="${y + 14}">${formatDecimal(project.netSales30d, 0)}</text>`;
  }).join("");
  const axes = `<line class="chart-axis" x1="${left}" x2="${width - right}" y1="${height - bottom + 5}" y2="${height - bottom + 5}" />
    <text class="chart-label" x="${(left + width - right) / 2}" y="${height - 2}" text-anchor="middle">Minutas de mayo de 2026</text>`;
  target.innerHTML = svgFrame(
    "absorption-bars",
    "Minutas de mayo frente al ritmo necesario para agotar stock en doce meses",
    ordered.length ? `${ordered.length} proyectos ordenados por minutas de mayo.` : "No hay proyectos para los filtros seleccionados.",
    width,
    height,
    `${grid}${bars}${axes}`
  );
}

function signalMarkup(project) {
  return `<span class="portfolio-signal"><i class="legend-${project.signal}"></i>${signalLabels[project.signal]}</span>`;
}

function renderDecisionQueue(projects) {
  const ordered = [...projects].sort((a, b) => b.pressure - a.pressure).slice(0, 5);
  byId("decisionRows").innerHTML = ordered.map((project) => `
    <tr class="${project.id === state.selectedId ? "row-selected" : ""}">
      <td><span class="priority priority-${project.priority}">${priorityLabels[project.priority]}</span></td>
      <td><strong>${project.name}</strong></td>
      <td class="num">${project.pressure}/100</td>
      <td class="num">${formatDecimal(project.monthsStock)}</td>
      <td class="num">${formatPercent(project.pricePremiumPct)}</td>
      <td>${project.recommendation}</td>
      <td><button class="row-button" type="button" data-select-project="${project.id}">Ver</button></td>
    </tr>`).join("");
}

function renderPortfolioTable(projects) {
  const ordered = [...projects].sort((a, b) => b.pressure - a.pressure);
  byId("portfolioRows").innerHTML = ordered.map((project) => `
    <tr class="${project.id === state.selectedId ? "row-selected" : ""}">
      <td><button class="row-button" type="button" data-select-project="${project.id}">${project.name}</button></td>
      <td>${project.phase}</td>
      <td class="num">${formatInteger(project.availableUnits)}</td>
      <td class="num">${formatMoney(project.priceM2)}</td>
      <td class="num">${formatInteger(project.netSales30d)}</td>
      <td class="num">${formatDecimal(project.monthsStock)}</td>
      <td class="num">${formatPercent(project.pricePremiumPct)}</td>
      <td>${signalMarkup(project)}</td>
    </tr>`).join("");
  byId("visibleProjectCount").textContent = projects.length;
}

function renderSelectedProject(projects) {
  let project = projects.find((item) => item.id === state.selectedId);
  if (!project) {
    project = [...projects].sort((a, b) => b.pressure - a.pressure)[0] || getProjects()[0];
    if (!project) return;
    state.selectedId = project.id;
  }
  byId("selectedName").textContent = project.name;
  byId("selectedSignal").textContent = signalLabels[project.signal];
  byId("selectedSignal").className = `signal-pill signal-${project.signal}`;
  byId("selectedReason").textContent = project.reason;
  byId("selectedStock").textContent = `${formatInteger(project.availableUnits)} unidades`;
  byId("selectedValue").textContent = formatCompactMoney(project.availableValue);
  byId("selectedM2").textContent = `${formatMoney(project.priceM2)} / m²`;
  byId("selectedMinutas").textContent = `${formatInteger(project.netSales30d)} en mayo`;
  byId("experimentProject").value = project.id;
  trackEvent("project_selected", { projectId: project.id, signal: project.signal });
}

function renderDashboard(projects) {
  const filtered = getFilteredProjects(projects);
  renderKpis(filtered);
  renderScatter(filtered);
  renderAbsorption(filtered);
  renderDecisionQueue(filtered);
  renderPortfolioTable(filtered);
  renderSelectedProject(filtered);
}

function renderProjection(projects) {
  const project = projects.find((item) => item.id === byId("experimentProject").value) || projects[0];
  if (!project) return;
  state.selectedId = project.id;
  const adjustment = Number(byId("priceAdjustment").value);
  const elasticity = Number(byId("elasticity").value);
  const projection = calculateProjection(project, adjustment, elasticity);
  state.projection = projection;
  byId("priceAdjustmentValue").textContent = `${adjustment > 0 ? "+" : ""}${adjustment.toFixed(1)}%`;
  byId("elasticityValue").textContent = elasticity.toFixed(1);
  byId("projectionBadge").textContent = adjustment < 0 ? "TEST REDUCCIÓN" : adjustment > 0 ? "TEST PRIMA" : "MANTENER";
  byId("projectionBadge").className = `signal-pill ${adjustment < 0 ? "signal-act" : adjustment > 0 ? "signal-opportunity" : ""}`;
  byId("projectionTitle").textContent = adjustment < 0 ? "Reducir con límite" : adjustment > 0 ? "Capturar una prima" : "Mantener y observar";
  byId("projectionReason").textContent = `${project.name} parte de ${formatDecimal(project.monthsStock)} meses de stock. Con ε=${elasticity.toFixed(1)}, el ajuste simulado cambia el índice de demanda en ${((projection.demandMultiplier - 1) * 100).toFixed(1)}%.`;
  byId("currentPriceM2").textContent = formatMoney(project.priceM2);
  byId("proposedPriceM2").textContent = formatMoney(projection.proposedPriceM2);
  byId("baseMinutas").textContent = formatDecimal(projection.baseAbsorption, 0);
  byId("projectedMinutas").textContent = formatDecimal(projection.projectedAbsorption);
  byId("projectedSales").textContent = formatCompactMoney(projection.projectedSalesValue);
  byId("projectedMonths").textContent = formatDecimal(projection.projectedMonthsStock);
  byId("actualMinutas").value = project.minutasMay;
  byId("actualSalesValue").value = project.salesValueMayPen;
  byId("actualStockEnd").value = project.availableUnits;
  byId("actualPriceM2").value = projection.proposedPriceM2;
}

function safeLocalArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function trackEvent(name, properties = {}) {
  if (typeof localStorage === "undefined") return;
  const events = safeLocalArray("pricingControlTowerEvents");
  events.push({ name, properties, timestamp: new Date().toISOString() });
  localStorage.setItem("pricingControlTowerEvents", JSON.stringify(events.slice(-300)));
}

function getEvidence() {
  return safeLocalArray("pricingControlTowerEvidence");
}

function updateEvidenceMeter() {
  const count = getEvidence().length;
  byId("evidenceCount").textContent = `${Math.min(count, 5)}/5`;
  byId("evidenceProgress").style.width = `${Math.min(count / 5, 1) * 100}%`;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((value) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function setupControls(projects) {
  const options = projects.map((project) => `<option value="${project.id}">${project.name}</option>`).join("");
  byId("projectFilter").insertAdjacentHTML("beforeend", options);
  byId("experimentProject").innerHTML = options;
  state.selectedId = [...projects].sort((a, b) => b.pressure - a.pressure)[0]?.id || projects[0]?.id;
  byId("experimentProject").value = state.selectedId;

  byId("projectFilter").addEventListener("change", (event) => {
    state.projectFilter = event.target.value;
    if (state.projectFilter !== "all") state.selectedId = state.projectFilter;
    renderDashboard(projects);
    renderProjection(projects);
    trackEvent("portfolio_filter_changed", { project: state.projectFilter, signal: state.signalFilter });
  });
  byId("signalFilter").addEventListener("change", (event) => {
    state.signalFilter = event.target.value;
    renderDashboard(projects);
    renderProjection(projects);
    trackEvent("portfolio_filter_changed", { project: state.projectFilter, signal: state.signalFilter });
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-select-project]");
    const chartPoint = event.target.closest("[data-project-id]");
    const projectId = button?.dataset.selectProject || chartPoint?.dataset.projectId;
    if (!projectId) return;
    state.selectedId = projectId;
    byId("experimentProject").value = projectId;
    renderDashboard(projects);
    renderProjection(projects);
  });
  byId("experimentProject").addEventListener("change", (event) => {
    state.selectedId = event.target.value;
    renderSelectedProject(projects);
    renderProjection(projects);
  });
  byId("priceAdjustment").addEventListener("input", () => renderProjection(projects));
  byId("elasticity").addEventListener("input", () => renderProjection(projects));
  byId("simulationForm").addEventListener("submit", (event) => {
    event.preventDefault();
    renderProjection(projects);
    trackEvent("pricing_hypothesis_simulated", {
      projectId: state.projection.projectId,
      priceAdjustmentPct: state.projection.priceAdjustmentPct,
      elasticity: state.projection.elasticity
    });
  });
  byId("adoptHypothesis").addEventListener("click", () => {
    if (!state.projection) renderProjection(projects);
    const hypothesis = { ...state.projection, adoptedAt: new Date().toISOString(), status: "active" };
    localStorage.setItem("pricingControlTowerActiveHypothesis", JSON.stringify(hypothesis));
    byId("adoptHypothesis").textContent = "Hipótesis activa · esperando resultado";
    trackEvent("pricing_hypothesis_adopted", { projectId: hypothesis.projectId, proposedPriceM2: hypothesis.proposedPriceM2 });
    byId("outcomeTitle").scrollIntoView({ behavior: "smooth", block: "center" });
  });

  byId("outcomeForm").addEventListener("submit", (event) => {
    event.preventDefault();
    let active = null;
    try { active = JSON.parse(localStorage.getItem("pricingControlTowerActiveHypothesis") || "null"); } catch { active = null; }
    const projection = active || state.projection;
    if (!projection) return;
    const actual = {
      minutas: Number(byId("actualMinutas").value),
      salesValuePen: Number(byId("actualSalesValue").value),
      stockEnd: Number(byId("actualStockEnd").value),
      priceM2: Number(byId("actualPriceM2").value)
    };
    const absorptionError = actual.minutas - projection.projectedAbsorption;
    const salesValueError = actual.salesValuePen - projection.projectedSalesValue;
    const stockReduction = Math.max(projection.baseMonthsStock * projection.baseAbsorption - actual.stockEnd, 0);
    const evidence = {
      hypothesis: projection,
      actual,
      absorptionError,
      salesValueError,
      stockReduction,
      recordedAt: new Date().toISOString()
    };
    const rows = getEvidence();
    rows.push(evidence);
    localStorage.setItem("pricingControlTowerEvidence", JSON.stringify(rows));
    byId("outcomeResult").hidden = false;
    byId("outcomeHeadline").textContent = `${projection.projectName}: ${formatDecimal(actual.minutas, 0)} minutas observadas`;
    byId("outcomeDetail").textContent = `La proyección fue ${formatDecimal(projection.projectedAbsorption)} minutas; el error es ${absorptionError >= 0 ? "+" : ""}${absorptionError.toFixed(1)}. El valor vendido quedó ${salesValueError >= 0 ? "+" : "−"}${formatMoney(Math.abs(salesValueError))} frente a la simulación. El registro mejora la auditoría, pero no prueba causalidad sin un contrafactual comparable.`;
    updateEvidenceMeter();
    trackEvent("pricing_outcome_recorded", { projectId: projection.projectId, absorptionError, salesValueError });
  });

  byId("exportPortfolio").addEventListener("click", () => {
    const filtered = getFilteredProjects(projects);
    downloadCsv("pricing_control_tower_historico_2026_05.csv", [
      ["snapshot_date", "activity_month", "project_id", "project_name", "phase", "total_units", "available_units", "estimated_available_value_pen", "available_price_m2_usd", "available_price_m2_pen", "sold_price_m2_usd", "price_premium_pct", "separations_may", "minutas_may", "sales_value_may_pen", "months_stock_at_may_run_rate", "parking_available", "parking_required", "pressure_score", "signal"],
      ...filtered.map((project) => [sourceData.meta.snapshotDate, sourceData.meta.activityMonth, project.id, project.name, project.phase, project.totalUnits, project.availableUnits, project.availableValue, project.priceM2Usd, project.priceM2, project.soldPriceM2Usd, project.pricePremiumPct, project.separationsMay, project.minutasMay, project.salesValueMayPen, project.monthsStock, project.parkingAvailable, project.parkingRequired, project.pressure, project.signal])
    ]);
    trackEvent("portfolio_snapshot_exported", { projects: filtered.length });
  });
  byId("exportEvidence").addEventListener("click", () => {
    downloadCsv("pricing_control_tower_evidence.csv", [
      ["recorded_at", "project_id", "project_name", "price_adjustment_pct", "elasticity_assumption", "projected_minutas", "actual_minutas", "minutas_error", "projected_sales_value_pen", "actual_sales_value_pen", "sales_value_error_pen", "proposed_price_m2", "actual_price_m2", "stock_end"],
      ...getEvidence().map((item) => [item.recordedAt, item.hypothesis.projectId, item.hypothesis.projectName, item.hypothesis.priceAdjustmentPct, item.hypothesis.elasticity, item.hypothesis.projectedAbsorption, item.actual.minutas, item.absorptionError, item.hypothesis.projectedSalesValue, item.actual.salesValuePen, item.salesValueError, item.hypothesis.proposedPriceM2, item.actual.priceM2, item.actual.stockEnd])
    ]);
    trackEvent("pricing_evidence_exported", { rows: getEvidence().length });
  });
  byId("logoutButton").addEventListener("click", () => trackEvent("session_logout_clicked"));
}

function init() {
  const projects = getProjects();
  if (!projects.length) return;
  byId("dataDisclaimer").textContent = sourceData.meta.disclaimer;
  byId("snapshotLabel").textContent = "Precios abr 2026 · actividad may 2026";
  setupControls(projects);
  renderDashboard(projects);
  renderProjection(projects);
  updateEvidenceMeter();
  trackEvent("dashboard_opened", { mode: sourceData.meta.mode, projects: projects.length });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
}

if (typeof module !== "undefined") {
  module.exports = { projectMetrics, pressureScore, classifyProject, enrichProjects, calculateProjection };
}
