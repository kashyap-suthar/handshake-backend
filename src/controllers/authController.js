const { User } = require('../models');
const { generateToken } = require('../middleware/auth');
const { ConflictError, UnauthorizedError } = require('../utils/errors');
const logger = require('../utils/logger');

const register = async (req, res, next) => {
    try {
        const { username, email, password } = req.body;

        const existingUser = await User.findOne({
            where: {
                [require('sequelize').Op.or]: [{ email }, { username }],
            },
        });

        if (existingUser) {
            if (existingUser.email === email) {
                throw new ConflictError('Email already registered');
            }
            if (existingUser.username === username) {
                throw new ConflictError('Username already taken');
            }
        }

        const user = await User.create({
            username,
            email,
            password,
        });

        const token = generateToken(user);

        logger.info(`New user registered: ${username} (${email})`);

        res.status(201).json({
            success: true,
            data: {
                user: user.toJSON(),
                token,
            },
        });
    } catch (error) {
        next(error);
    }
};

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ where: { email } });

        if (!user) {
            throw new UnauthorizedError('Invalid credentials');
        }

        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            throw new UnauthorizedError('Invalid credentials');
        }

        const token = generateToken(user);

        logger.info(`User logged in: ${user.username}`);

        res.json({
            success: true,
            data: {
                user: user.toJSON(),
                token,
            },
        });
    } catch (error) {
        next(error);
    }
};

const getProfile = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.user.id);

        res.json({
            success: true,
            data: {
                user: user.toJSON(),
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    register,
    login,
    getProfile,
};
