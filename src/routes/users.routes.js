const express = require('express');
const { Op } = require('sequelize');
const User = require('../models/User');
const presenceService = require('../services/PresenceService');
const { authenticateJWT } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/', authenticateJWT, async (req, res, next) => {
  try {
    const currentUserId = req.user.id;

    const users = await User.findAll({
      where: {
        id: { [Op.ne]: currentUserId },
        isActive: true,
      },
      attributes: ['id', 'username', 'email'],
      order: [['username', 'ASC']],
    });

    const usersWithPresence = await Promise.all(
      users.map(async (user) => {
        const presence = await presenceService.getPresence(user.id);
        return {
          id: user.id,
          username: user.username,
          email: user.email,
          isOnline: presence.isOnline,
          lastSeen: presence.lastSeen
            ? new Date(presence.lastSeen).toISOString()
            : null,
        };
      }),
    );

    usersWithPresence.sort((a, b) => {
      if (a.isOnline !== b.isOnline) {
        return b.isOnline - a.isOnline;
      }
      return a.username.localeCompare(b.username);
    });

    res.json({
      success: true,
      users: usersWithPresence,
    });
  } catch (error) {
    logger.error('Failed to get users list:', error);
    next(error);
  }
});

module.exports = router;
