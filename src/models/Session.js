const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { SESSION_STATES } = require('../utils/constants');

/**
 * Session model
 */
const Session = sequelize.define('Session', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    challengeId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'challenges',
            key: 'id',
        },
        comment: 'Challenge that created this session',
    },
    players: {
        type: DataTypes.ARRAY(DataTypes.UUID),
        allowNull: false,
        validate: {
            hasExactlyTwoPlayers(value) {
                if (value.length !== 2) {
                    throw new Error('Session must have exactly 2 players');
                }
            },
        },
        comment: 'Array of player IDs [player1, player2]',
    },
    state: {
        type: DataTypes.ENUM(...Object.values(SESSION_STATES)),
        defaultValue: SESSION_STATES.ACTIVE,
        allowNull: false,
    },
    startedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    endedAt: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: 'Additional session metadata (score, winner, etc.)',
    },
}, {
    tableName: 'sessions',
    indexes: [
        { fields: ['id'], unique: true },
        { fields: ['challengeId'] },
        {
            fields: ['players'],
            using: 'gin',
            comment: 'GIN index for array searches',
        },
        { fields: ['state'] },
    ],
});

/**
 * Instance methods
 */

// Check if user is in session
Session.prototype.hasPlayer = function (userId) {
    return this.players.includes(userId);
};

// End session
Session.prototype.endSession = async function (state = SESSION_STATES.COMPLETED, metadata = {}) {
    this.state = state;
    this.endedAt = new Date();
    this.metadata = { ...this.metadata, ...metadata };
    await this.save();
};

module.exports = Session;
