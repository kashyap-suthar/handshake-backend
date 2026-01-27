const User = require('./User');
const Challenge = require('./Challenge');
const Session = require('./Session');

/**
 * Define model associations
 */

// User <-> Challenge relationships
User.hasMany(Challenge, {
    foreignKey: 'challengerId',
    as: 'challengesCreated',
});

User.hasMany(Challenge, {
    foreignKey: 'challengedId',
    as: 'challengesReceived',
});

Challenge.belongsTo(User, {
    foreignKey: 'challengerId',
    as: 'challenger',
});

Challenge.belongsTo(User, {
    foreignKey: 'challengedId',
    as: 'challenged',
});

// Challenge <-> Session relationship
Challenge.hasOne(Session, {
    foreignKey: 'challengeId',
    as: 'session',
});

Session.belongsTo(Challenge, {
    foreignKey: 'challengeId',
    as: 'challenge',
});

module.exports = {
    User,
    Challenge,
    Session,
};
