const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { CHALLENGE_STATES, CHALLENGE_STATE_TRANSITIONS } = require('../utils/constants');

const Challenge = sequelize.define('Challenge', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    challengerId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who created the challenge',
    },
    challengedId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        comment: 'User who is being challenged',
    },
    state: {
        type: DataTypes.ENUM(...Object.values(CHALLENGE_STATES)),
        defaultValue: CHALLENGE_STATES.PENDING,
        allowNull: false,
    },
    gameType: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'Type of game for the challenge',
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'When the challenge expires',
    },
    notificationAttempts: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Number of wake-up notification attempts',
    },
    lastNotificationAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Timestamp of last notification attempt',
    },
    metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: 'Additional challenge metadata',
    },
}, {
    tableName: 'challenges',
    indexes: [
        { fields: ['id'], unique: true },
        { fields: ['challengedId', 'state'] },
        { fields: ['challengerId', 'state'] },
        { fields: ['expiresAt'] },
        { fields: ['state'] },
    ],
});

Challenge.prototype.canTransitionTo = function (newState) {
    const allowedTransitions = CHALLENGE_STATE_TRANSITIONS[this.state] || [];
    return allowedTransitions.includes(newState);
};

Challenge.prototype.transitionTo = async function (newState) {
    if (!this.canTransitionTo(newState)) {
        throw new Error(
            `Invalid state transition from ${this.state} to ${newState}`,
        );
    }
    this.state = newState;
    await this.save();
};

Challenge.prototype.incrementNotificationAttempt = async function () {
    this.notificationAttempts += 1;
    this.lastNotificationAt = new Date();
    await this.save();
};

Challenge.prototype.isExpired = function () {
    return new Date() > this.expiresAt;
};

module.exports = Challenge;
