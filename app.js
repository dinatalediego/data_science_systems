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

function pressureScore(project) {
  const monthsStock = project.availableUnits / Math.max(project.netSales30d, 0.25);
  return Math.round(
    45 * clamp(monthsStock / 18, 0, 1) +
    25 * clamp(project.avgDaysStock / 180, 0, 1) +
    20 * clamp(Math.max(project.marketGapPct, 0) / 0.08, 0, 1) +
    10 * clamp(project.cancellations30d / 3, 0, 1)
  );
}

function classifyProject(project) {
  const monthsStock = project.availableUnits / Math.max(project.netSales30d, 0.25);
  const pressure = pressureScore(project);
  const beatsConversion = project.conversionPct >= project.targetConversionPct * 1.05;
  let signal = "hold";
  if (pressure >= 60) signal = "act";
  if (pressure <= 28 && monthsStock < 6 && beatsConversion) signal = "opportunity";

  const priority = signal === "act" ? "high" : pressure >= 38 ? "medium" : "low";
  const recommendation = signal === "act"
    ? "Probar ajuste acotado en el cluster lento"
    : signal === "opportunity"
      ? "Evaluar prima en unidades de mayor demanda"
      : "Mantener precio y mejorar evidencia";
  const reason = signal === "act"
    ? `${formatDecimal(monthsStock)} meses de stock, ${project.avgDaysStock} días promedio y una brecha de ${formatPercent(project.marketGapPct)} frente al benchmark elevan la presión.`
    : signal === "opportunity"
      ? `La conversión de ${formatDecimal(project.conversionPct)}% supera el objetivo y el stock equivale a ${formatDecimal(monthsStock)} meses; existe espacio para una prueba pequeña.`
      : `La presión es intermedia: mover precio hoy tiene menos valor que reforzar comparables, pauta o ejecución comercial.`;

  return { ...project, monthsStock, pressure, signal, priority, recommendation, reason };
}

function enrichProjects(projects) {
  return projects.map(classifyProject);
}

function calculateProjection(project, priceAdjustmentPct, elasticity) {
  const priceRatio = 1 + priceAdjustmentPct / 100;
  const demandMultiplier = Math.pow(priceRatio, elasticity);
  const projectedConversionPct = clamp(project.conversionPct * demandMultiplier, 0, 40);
  const projectedAbsorption = Math.max(project.netSales30d * demandMultiplier, 0.1);
  const projectedMonthsStock = project.availableUnits / projectedAbsorption;
  const proposedPriceM2 = Math.round(project.priceM2 * priceRatio / 10) * 10;
  return {
    projectId: project.id,
    projectName: project.name,
    calculatedAt: new Date().toISOString(),
    priceAdjustmentPct,
    elasticity,
    currentPriceM2: project.priceM2,
    proposedPriceM2,
    baseConversionPct: project.conversionPct,
    projectedConversionPct,
    baseAbsorption: project.netSales30d,
    projectedAbsorption,
    baseMonthsStock: project.monthsStock,
    projectedMonthsStock,
    demandMultiplier,
    sourceMode: "demo"
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
  return (value) => rangeMin + ((value - domainMin) / (domainMax - domainMin)) * (rangeMax - rangeMin);
}

function renderKpis(projects) {
  const units = sum(projects, "availableUnits");
  const value = sum(projects, "availableValue");
  const absorption = sum(projects, "netSales30d");
  const months = units / Math.max(absorption, 0.1);
  byId("kpiUnits").textContent = formatInteger(units);
  byId("kpiUnitsContext").textContent = `${projects.length} proyecto${projects.length === 1 ? "" : "s"} · unidades`;
  byId("kpiValue").textContent = formatCompactMoney(value);
  byId("kpiAbsorption").textContent = formatDecimal(absorption);
  byId("kpiAbsorptionContext").textContent = `${formatDecimal(absorption)} unidades / mes`;
  byId("kpiMonths").textContent = formatDecimal(months);
}

function renderScatter(projects) {
  const target = byId("scatterChart");
  const width = 720;
  const height = 410;
  const left = 66;
  const right = 24;
  const top = 30;
  const bottom = 58;
  const xScale = scaleLinear(0, 30, left, width - right);
  const yScale = scaleLinear(5200, 7400, height - bottom, top);
  const valueScale = scaleLinear(5000000, 23000000, 7, 18);
  const xTicks = [0, 6, 12, 18, 24, 30];
  const yTicks = [5400, 5800, 6200, 6600, 7000, 7400];

  const grid = `${xTicks.map((tick) => `
      <line class="chart-gridline" x1="${xScale(tick)}" x2="${xScale(tick)}" y1="${top}" y2="${height - bottom}" />
      <text class="chart-tick" x="${xScale(tick)}" y="${height - 34}" text-anchor="middle">${tick}</text>`).join("")}
    ${yTicks.map((tick) => `
      <line class="chart-gridline" x1="${left}" x2="${width - right}" y1="${yScale(tick)}" y2="${yScale(tick)}" />
      <text class="chart-tick" x="${left - 10}" y="${yScale(tick) + 4}" text-anchor="end">${formatInteger(tick)}</text>`).join("")}
    <line class="chart-axis" x1="${left}" x2="${width - right}" y1="${height - bottom}" y2="${height - bottom}" />
    <line class="chart-axis" x1="${left}" x2="${left}" y1="${top}" y2="${height - bottom}" />
    <text class="chart-label" x="${(left + width - right) / 2}" y="${height - 8}" text-anchor="middle">Meses de stock</text>
    <text class="chart-label" x="15" y="${(top + height - bottom) / 2}" text-anchor="middle" transform="rotate(-90 15 ${(top + height - bottom) / 2})">Precio lista / m² (S/)</text>`;

  const thresholds = `
    <line class="chart-threshold" x1="${xScale(12)}" x2="${xScale(12)}" y1="${top}" y2="${height - bottom}" />
    <line class="chart-threshold" x1="${left}" x2="${width - right}" y1="${yScale(6200)}" y2="${yScale(6200)}" />
    <text class="chart-quadrant-label" x="${xScale(12) + 8}" y="${top + 14}">ROTACIÓN LENTA</text>
    <text class="chart-quadrant-label" x="${left + 8}" y="${yScale(6200) - 8}">PRIMA DE PRECIO</text>`;

  const marks = projects.map((project) => {
    const x = xScale(clamp(project.monthsStock, 0, 30));
    const y = yScale(clamp(project.priceM2, 5200, 7400));
    const radius = valueScale(clamp(project.availableValue, 5000000, 23000000));
    const labelX = x + radius + 5;
    const labelAnchor = labelX > width - 70 ? "end" : "start";
    const adjustedLabelX = labelAnchor === "end" ? x - radius - 5 : labelX;
    return `
      <circle class="scatter-dot scatter-${project.signal}" data-project-id="${project.id}" cx="${x}" cy="${y}" r="${radius}" aria-label="${project.name}: ${formatDecimal(project.monthsStock)} meses de stock y ${formatMoney(project.priceM2)} por metro cuadrado">
        <title>${project.name} · ${formatDecimal(project.monthsStock)} meses · ${formatMoney(project.priceM2)} / m² · ${formatCompactMoney(project.availableValue)}</title>
      </circle>
      <text class="scatter-label" x="${adjustedLabelX}" y="${y + 3}" text-anchor="${labelAnchor}">${project.name}</text>`;
  }).join("");

  const description = projects.length
    ? `${projects.length} proyectos. Meses de stock en el eje horizontal, precio por metro cuadrado en el vertical y valor de inventario en el tamaño del punto.`
    : "No hay proyectos para los filtros seleccionados.";
  target.innerHTML = svgFrame("portfolio-scatter", "Precio por metro cuadrado frente a meses de stock", description, width, height, `${grid}${thresholds}${marks}`);
}

function renderAbsorption(projects) {
  const target = byId("absorptionChart");
  const ordered = [...projects].sort((a, b) => b.netSales30d - a.netSales30d);
  const width = 610;
  const rowHeight = 36;
  const top = 38;
  const bottom = 42;
  const left = 112;
  const right = 46;
  const height = Math.max(250, top + bottom + ordered.length * rowHeight);
  const maxValue = Math.max(4, ...ordered.flatMap((project) => [project.netSales30d, project.targetSales30d])) * 1.08;
  const xScale = scaleLinear(0, maxValue, left, width - right);
  const ticks = [0, 1, 2, 3, 4].filter((tick) => tick <= maxValue);
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
        <title>${project.name}: ${formatDecimal(project.netSales30d)} unidades por mes frente a objetivo ${formatDecimal(project.targetSales30d)}</title>
      </rect>
      <line class="bar-target" x1="${targetX}" x2="${targetX}" y1="${y - 3}" y2="${y + 21}" />
      <text class="bar-value" x="${Math.min(xScale(project.netSales30d) + 7, width - 25)}" y="${y + 14}">${formatDecimal(project.netSales30d)}</text>`;
  }).join("");
  const axes = `<line class="chart-axis" x1="${left}" x2="${width - right}" y1="${height - bottom + 5}" y2="${height - bottom + 5}" />
    <text class="chart-label" x="${(left + width - right) / 2}" y="${height - 2}" text-anchor="middle">Unidades netas / 30 días</text>`;
  target.innerHTML = svgFrame(
    "absorption-bars",
    "Absorción neta por proyecto frente al objetivo",
    ordered.length ? `${ordered.length} proyectos ordenados por absorción neta de los últimos 30 días.` : "No hay proyectos para los filtros seleccionados.",
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
      <td class="num">${formatPercent(project.marketGapPct)}</td>
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
      <td class="num">${formatDecimal(project.netSales30d)}</td>
      <td class="num">${formatDecimal(project.monthsStock)}</td>
      <td class="num">${formatInteger(project.avgDaysStock)}</td>
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
  byId("selectedConversion").textContent = `${formatDecimal(project.conversionPct)}%`;
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
  byId("baseConversion").textContent = `${formatDecimal(projection.baseConversionPct)}%`;
  byId("projectedConversion").textContent = `${formatDecimal(projection.projectedConversionPct)}%`;
  byId("projectedAbsorption").textContent = `${formatDecimal(projection.projectedAbsorption)} / mes`;
  byId("projectedMonths").textContent = formatDecimal(projection.projectedMonthsStock);
  byId("actualLeads").value = project.leads30d;
  byId("actualSeparations").value = project.separations30d;
  byId("actualAbsorption").value = projection.projectedAbsorption.toFixed(1);
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
      leads: Number(byId("actualLeads").value),
      separations: Number(byId("actualSeparations").value),
      absorption30d: Number(byId("actualAbsorption").value),
      priceM2: Number(byId("actualPriceM2").value)
    };
    const actualConversionPct = actual.separations / Math.max(actual.leads, 1) * 100;
    const conversionErrorPp = actualConversionPct - projection.projectedConversionPct;
    const absorptionError = actual.absorption30d - projection.projectedAbsorption;
    const evidence = {
      hypothesis: projection,
      actual,
      actualConversionPct,
      conversionErrorPp,
      absorptionError,
      recordedAt: new Date().toISOString()
    };
    const rows = getEvidence();
    rows.push(evidence);
    localStorage.setItem("pricingControlTowerEvidence", JSON.stringify(rows));
    byId("outcomeResult").hidden = false;
    byId("outcomeHeadline").textContent = `${projection.projectName}: conversión observada ${formatDecimal(actualConversionPct)}%`;
    byId("outcomeDetail").textContent = `La proyección fue ${formatDecimal(projection.projectedConversionPct)}%; el error es ${conversionErrorPp >= 0 ? "+" : ""}${conversionErrorPp.toFixed(1)} p.p. La absorción quedó ${absorptionError >= 0 ? "+" : ""}${absorptionError.toFixed(1)} unidades frente a lo proyectado. El registro mejora la auditoría, pero no prueba causalidad sin un contrafactual comparable.`;
    updateEvidenceMeter();
    trackEvent("pricing_outcome_recorded", { projectId: projection.projectId, conversionErrorPp, absorptionError });
  });

  byId("exportPortfolio").addEventListener("click", () => {
    const filtered = getFilteredProjects(projects);
    downloadCsv("pricing_control_tower_snapshot_demo.csv", [
      ["snapshot_date", "project_id", "project_name", "available_units", "available_value_pen", "price_m2_pen", "market_gap_pct", "net_sales_30d", "months_stock", "conversion_pct", "avg_days_stock", "pressure_score", "signal"],
      ...filtered.map((project) => [sourceData.meta.snapshotDate, project.id, project.name, project.availableUnits, project.availableValue, project.priceM2, project.marketGapPct, project.netSales30d, project.monthsStock, project.conversionPct, project.avgDaysStock, project.pressure, project.signal])
    ]);
    trackEvent("portfolio_snapshot_exported", { projects: filtered.length });
  });
  byId("exportEvidence").addEventListener("click", () => {
    downloadCsv("pricing_control_tower_evidence.csv", [
      ["recorded_at", "project_id", "project_name", "price_adjustment_pct", "elasticity", "projected_conversion_pct", "actual_conversion_pct", "conversion_error_pp", "projected_absorption", "actual_absorption", "absorption_error", "proposed_price_m2", "actual_price_m2"],
      ...getEvidence().map((item) => [item.recordedAt, item.hypothesis.projectId, item.hypothesis.projectName, item.hypothesis.priceAdjustmentPct, item.hypothesis.elasticity, item.hypothesis.projectedConversionPct, item.actualConversionPct, item.conversionErrorPp, item.hypothesis.projectedAbsorption, item.actual.absorption30d, item.absorptionError, item.hypothesis.proposedPriceM2, item.actual.priceM2])
    ]);
    trackEvent("pricing_evidence_exported", { rows: getEvidence().length });
  });
}

function init() {
  const projects = getProjects();
  if (!projects.length) return;
  byId("dataDisclaimer").textContent = sourceData.meta.disclaimer;
  byId("snapshotLabel").textContent = `Corte ${new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${sourceData.meta.snapshotDate}T12:00:00`)).replace(".", "")}`;
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
  module.exports = { pressureScore, classifyProject, enrichProjects, calculateProjection };
}
