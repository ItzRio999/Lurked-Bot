const admin = require("firebase-admin");

function isLocalHostValue(value = "") {
  return /(^|\/\/)(localhost|127\.0\.0\.1)(:\d+)?/i.test(String(value));
}

function isLocalDevBypassRequest(req) {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  const origin = req.header("origin") || "";
  const referer = req.header("referer") || "";
  const host = req.header("host") || "";
  const forwardedHost = req.header("x-forwarded-host") || "";

  return [origin, referer, host, forwardedHost].some(isLocalHostValue);
}

function verifyAppCheck(options = {}) {
  const consume = options.consume !== false;

  return async (req, res, next) => {
    const appCheckToken = req.header("X-Firebase-AppCheck");

    if (!appCheckToken) {
      if (isLocalDevBypassRequest(req)) {
        req.appCheck = { bypassed: true, reason: "local-dev-missing-token" };
        return next();
      }

      return res.status(401).json({
        success: false,
        error: "Missing App Check token",
      });
    }

    try {
      const result = await admin.appCheck().verifyToken(appCheckToken, { consume });

      if (consume && result.alreadyConsumed) {
        return res.status(401).json({
          success: false,
          error: "App Check token was already used",
        });
      }

      req.appCheck = result;
      next();
    } catch (error) {
      console.error("App Check verification failed:", error.message);

      if (isLocalDevBypassRequest(req)) {
        req.appCheck = { bypassed: true, reason: "local-dev-invalid-token" };
        return next();
      }

      return res.status(401).json({
        success: false,
        error: "Invalid App Check token",
      });
    }
  };
}

module.exports = { verifyAppCheck };
