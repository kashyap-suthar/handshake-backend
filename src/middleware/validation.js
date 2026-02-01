const { body, param, query, validationResult } = require('express-validator');
const { ValidationError } = require('../utils/errors');

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map((err) => err.msg).join(', ');
        return next(new ValidationError(errorMessages));
    }

    next();
};

const validateRegister = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 50 })
        .withMessage('Username must be 3-50 characters'),
    body('email')
        .trim()
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email required'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),
    handleValidationErrors,
];

const validateLogin = [
    body('email')
        .trim()
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email required'),
    body('password')
        .notEmpty()
        .withMessage('Password required'),
    handleValidationErrors,
];

const validateCreateChallenge = [
    body('challengedId')
        .isUUID()
        .withMessage('Valid challengedId (UUID) required'),
    body('gameType')
        .trim()
        .notEmpty()
        .isLength({ max: 50 })
        .withMessage('gameType required (max 50 chars)'),
    handleValidationErrors,
];

const validateChallengeResponse = [
    body('response')
        .isIn(['ACCEPT', 'DECLINE'])
        .withMessage('response must be ACCEPT or DECLINE'),
    handleValidationErrors,
];

const validateDeviceToken = [
    body('fcm_token')
        .trim()
        .notEmpty()
        .withMessage('Device token required'),
    handleValidationErrors,
];

const validateUUID = [
    param('id')
        .isUUID()
        .withMessage('Valid UUID required'),
    handleValidationErrors,
];

module.exports = {
    handleValidationErrors,
    validateRegister,
    validateLogin,
    validateCreateChallenge,
    validateChallengeResponse,
    validateDeviceToken,
    validateUUID,
};
