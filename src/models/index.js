const User = require('./User');
const Challenge = require('./Challenge');
const Session = require('./Session');

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
