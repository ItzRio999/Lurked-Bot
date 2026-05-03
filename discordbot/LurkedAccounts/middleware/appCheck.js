const admin = require("firebase-admin");

function verifyAppCheck(options = {}) {
  const consume = options.consume !== false;

  return async (req, res, next) => {
    const appCheckToken = req.header("X-Firebase-AppCheck");

    if (!appCheckToken) {
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
      return res.status(401).json({
        success: false,
        error: "Invalid App Check token",
      });
    }
  };
}

module.exports = { verifyAppCheck };
