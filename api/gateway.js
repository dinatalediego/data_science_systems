const fs = require("node:fs");
const path = require("node:path");
const { requestHasValidSession } = require("./_auth");

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

const allowedFiles = new Set(["index.html", "styles.css", "data.js", "app.js"]);

function securityHeaders(response, allowInlineStyle = false) {
  response.setHeader("Cache-Control", "private, no-store, max-age=0");
  response.setHeader("Content-Security-Policy", [
    "default-src 'self'",
    "script-src 'self'",
    `style-src 'self'${allowInlineStyle ? " 'unsafe-inline'" : ""}`,
    "img-src 'self' data:",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'"
  ].join("; "));
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
}

function loginPage(hasError) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>Acceso · Pricing Control Tower</title>
  <style>
    :root{--ink:#112d2c;--forest:#0c2d2b;--paper:#f3f0e7;--lime:#dff36b;--coral:#ff705d}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:var(--forest);color:var(--ink);font-family:Inter,system-ui,sans-serif}
    main{width:min(100%,440px);background:var(--paper);border:1px solid rgba(255,255,255,.25);box-shadow:0 24px 80px rgba(0,0,0,.3)}
    header{padding:28px 30px 18px;border-bottom:1px solid rgba(17,45,44,.16)}.mark{display:inline-grid;place-items:center;width:46px;height:46px;background:var(--lime);font:700 13px ui-monospace,monospace;margin-bottom:24px}
    p{color:#65736f;line-height:1.55}h1{margin:0;font:600 36px Georgia,serif;line-height:1.02}form{padding:26px 30px 30px}
    label{display:grid;gap:8px;font-size:12px;font-weight:700;letter-spacing:.04em}input{width:100%;padding:14px;border:1px solid rgba(17,45,44,.24);background:#fffdf8;font:inherit}
    input:focus{outline:3px solid rgba(120,152,242,.35);border-color:#5274d7}button{width:100%;margin-top:18px;padding:14px;border:0;background:var(--ink);color:white;font-weight:700;cursor:pointer}
    .error{margin:0 0 16px;padding:10px 12px;background:#ffe4df;color:#8e2c1d;font-size:13px}.note{font-size:11px;margin:18px 0 0}
  </style>
</head>
<body>
  <main>
    <header><span class="mark">D/S</span><h1>Pricing<br />Control Tower</h1><p>Acceso restringido al corte histórico abril–mayo de 2026.</p></header>
    <form action="/api/login" method="post">
      ${hasError ? '<p class="error" role="alert">La contraseña no es correcta.</p>' : ""}
      <label>Contraseña<input name="password" type="password" autocomplete="current-password" required autofocus /></label>
      <button type="submit">Ingresar al tablero</button>
      <p class="note">La sesión expira después de 8 horas. No se almacenan datos personales en esta aplicación.</p>
    </form>
  </main>
</body>
</html>`;
}

function resolveFile(filePath) {
  const candidates = [
    path.join(process.cwd(), filePath),
    path.join(__dirname, "..", filePath)
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

module.exports = function gateway(request, response) {
  const rawPath = Array.isArray(request.query.path) ? request.query.path.join("/") : String(request.query.path || "");
  const requestedPath = rawPath.replace(/^\/+/, "").split("?")[0];
  const loginRequested = requestedPath === "login";

  securityHeaders(response, loginRequested);

  if (loginRequested) {
    if (requestHasValidSession(request)) {
      response.writeHead(303, { Location: "/" });
      return response.end();
    }
    response.statusCode = 200;
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    return response.end(loginPage(new URL(request.url, "https://local").searchParams.get("error") === "1"));
  }

  if (!requestHasValidSession(request)) {
    response.writeHead(303, { Location: "/login" });
    return response.end();
  }

  if (!["GET", "HEAD"].includes(request.method)) {
    response.setHeader("Allow", "GET, HEAD");
    return response.status(405).send("Método no permitido");
  }

  const filePath = requestedPath === "" ? "index.html" : requestedPath;
  const isAllowedNested = /^(docs\/[a-z0-9._-]+\.md|schemas\/[a-z0-9._-]+\.json)$/i.test(filePath);
  if ((!allowedFiles.has(filePath) && !isAllowedNested) || filePath.includes("..")) {
    return response.status(404).send("No encontrado");
  }

  const resolved = resolveFile(filePath);
  if (!resolved) return response.status(404).send("No encontrado");
  response.statusCode = 200;
  response.setHeader("Content-Type", CONTENT_TYPES[path.extname(filePath)] || "application/octet-stream");
  if (request.method === "HEAD") return response.end();
  return fs.createReadStream(resolved).pipe(response);
};
