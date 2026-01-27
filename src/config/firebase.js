const admin = require('firebase-admin');
const logger = require('../utils/logger');

let firebaseApp = null;

/**
 * Initialize Firebase Admin SDK
 */
const initializeFirebase = () => {
    try {
        // Check if already initialized
        if (firebaseApp) {
            return firebaseApp;
        }

        const projectId = process.env.FIREBASE_PROJECT_ID;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

        if (!projectId || !privateKey || !clientEmail) {
            logger.warn('⚠ Firebase credentials not configured, FCM notifications will be disabled');
            return null;
        }

        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                privateKey,
                clientEmail,
            }),
        });

        logger.info('✓ Firebase Admin SDK initialized successfully');
        return firebaseApp;
    } catch (error) {
        logger.error('✗ Failed to initialize Firebase Admin SDK:', error);
        return null;
    }
};

/**
 * Get Firebase messaging instance
 */
const getMessaging = () => {
    if (!firebaseApp) {
        initializeFirebase();
    }
    return firebaseApp ? admin.messaging() : null;
};

module.exports = {
    initializeFirebase,
    getMessaging,
};
