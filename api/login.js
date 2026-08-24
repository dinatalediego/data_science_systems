const {
  authIsConfigured,
  createSessionToken,
  passwordIsValid,
  sessionCookie
} = require("./_auth");

function getPassword(request) {
  if (request.body && typeof request.body === "object") return request.body.password || "";
  if (typeof request.body === "string") return new URLSearchParams(request.body).get("password") || "";
  return "";
}

module.exports = async function login(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).send("Método no permitido");
  }

  if (!authIsConfigured()) {
    return response.status(503).send("Acceso no configurado");
  }

  const password = getPassword(request);
  if (!passwordIsValid(password)) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    response.writeHead(303, { Location: "/login?error=1" });
    return response.end();
  }

  response.writeHead(303, {
    Location: "/",
    "Set-Cookie": sessionCookie(createSessionToken())
  });
  return response.end();
};
