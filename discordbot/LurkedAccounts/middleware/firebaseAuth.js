const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
const serviceAccountPath = path.join(__dirname, '..', 'serviceAccount.json');
let firebaseInitialized = false;

try {
  const serviceAccount = require(serviceAccountPath);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    firebaseInitialized = true;
    console.log('✅ Firebase Admin SDK initialized successfully');
  }
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
  console.error('Make sure serviceAccount.json exists in the root directory');
}

/**
 * Middleware to verify Firebase authentication token
 * Extracts and verifies the Bearer token from Authorization header
 */
async function verifyAuth(req, res, next) {
  if (!firebaseInitialized) {
    return res.status(500).json({
      success: false,
      error: 'Firebase authentication not configured'
    });
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - No token provided'
    });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    // Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Attach user information to request object
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified
    };

    next();
  } catch (error) {
    console.error('❌ Token verification failed:', error.message);
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
}

/**
 * Middleware to verify admin status
 * Checks if the authenticated user's email is in the admin list in Firestore
 */
async function verifyAdmin(req, res, next) {
  if (!firebaseInitialized) {
    return res.status(500).json({
      success: false,
      error: 'Firebase authentication not configured'
    });
  }

  if (!req.user || !req.user.email) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  try {
    // Fetch admin emails from Firestore
    const adminDoc = await admin.firestore()
      .collection('settings')
      .doc('admins')
      .get();

    if (!adminDoc.exists) {
      console.error('❌ Admin settings document not found in Firestore');
      return res.status(500).json({
        success: false,
        error: 'Admin configuration not found'
      });
    }

    const adminEmails = adminDoc.data()?.emails || [];
    const userEmail = req.user.email.toLowerCase();

    if (!adminEmails.includes(userEmail)) {
      console.warn(`⚠️ Non-admin user attempted admin action: ${userEmail}`);
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    // User is verified as admin, proceed
    next();
  } catch (error) {
    console.error('❌ Admin verification failed:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify admin status'
    });
  }
}

module.exports = {
  verifyAuth,
  verifyAdmin
};
