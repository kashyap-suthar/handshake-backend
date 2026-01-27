const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');

/**
 * User model
 */
const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
            len: [3, 50],
        },
    },
    email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true,
        },
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    deviceTokens: {
        type: DataTypes.ARRAY(DataTypes.TEXT),
        defaultValue: [],
        comment: 'FCM device tokens for push notifications',
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
}, {
    tableName: 'users',
    indexes: [
        { fields: ['username'], unique: true },
        { fields: ['email'], unique: true },
    ],
    hooks: {
        beforeCreate: async (user) => {
            if (user.password) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
            }
        },
        beforeUpdate: async (user) => {
            if (user.changed('password')) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
            }
        },
    },
});

/**
 * Instance methods
 */

// Compare password
User.prototype.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Add device token
User.prototype.addDeviceToken = async function (token) {
    if (!this.deviceTokens.includes(token)) {
        this.deviceTokens = [...this.deviceTokens, token];
        await this.save();
    }
};

// Remove device token
User.prototype.removeDeviceToken = async function (token) {
    this.deviceTokens = this.deviceTokens.filter((t) => t !== token);
    await this.save();
};

// Get public profile (without password)
User.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.password;
    return values;
};

module.exports = User;
