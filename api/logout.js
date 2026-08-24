const { clearSessionCookie } = require("./_auth");

module.exports = function logout(_request, response) {
  response.writeHead(303, {
    Location: "/login",
    "Cache-Control": "no-store",
    "Set-Cookie": clearSessionCookie()
  });
  return response.end();
};
