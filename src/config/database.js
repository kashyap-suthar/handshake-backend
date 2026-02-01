const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

const sequelize = new Sequelize(process.env.DATABASE_URL || {
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'handshake_db',
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    logging: (msg) => logger.debug(msg),
    pool: {
        max: parseInt(process.env.DB_POOL_MAX, 10) || 20,
        min: parseInt(process.env.DB_POOL_MIN, 10) || 5,
        acquire: 30000,
        idle: 10000,
    },
    define: {
        timestamps: true,
        underscored: true,
    },
});

const testConnection = async () => {
    try {
        await sequelize.authenticate();
        logger.info('✓ PostgreSQL connection established successfully');
        return true;
    } catch (error) {
        logger.error('✗ Unable to connect to PostgreSQL database:', error);
        return false;
    }
};

const syncDatabase = async (force = false) => {
    try {
        await sequelize.sync({ force, alter: !force });
        logger.info(`✓ Database synchronized ${force ? '(force mode)' : ''}`);
    } catch (error) {
        logger.error('✗ Failed to sync database:', error);
        throw error;
    }
};

const closeConnection = async () => {
    try {
        await sequelize.close();
        logger.info('✓ PostgreSQL connection closed');
    } catch (error) {
        logger.error('✗ Error closing database connection:', error);
    }
};

module.exports = {
    sequelize,
    testConnection,
    syncDatabase,
    closeConnection,
};
