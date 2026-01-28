/* eslint-disable quotes */
const express = require("express");
const { Op } = require("sequelize");
const User = require("../models/User");
const presenceService = require("../services/PresenceService");
const { authenticateJWT } = require("../middleware/auth");
const logger = require("../utils/logger");

const router = express.Router();

/**
 * GET /api/v1/users
 * Get list of all users (except current user) to select as challenge opponents
 */
router.get("/", authenticateJWT, async (req, res, next) => {
  try {
    const currentUserId = req.user.id;

    // Get all users except the current user
    const users = await User.findAll({
      where: {
        id: { [Op.ne]: currentUserId },
        isActive: true,
      },
      attributes: ["id", "username", "email"],
      order: [["username", "ASC"]],
    });

    // Get presence info for each user
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

    // Sort: online users first, then alphabetically by username
    usersWithPresence.sort((a, b) => {
      if (a.isOnline !== b.isOnline) {
        return b.isOnline - a.isOnline; // Online users first
      }
      return a.username.localeCompare(b.username);
    });

    res.json({
      success: true,
      users: usersWithPresence,
    });
  } catch (error) {
    logger.error("Failed to get users list:", error);
    next(error);
  }
});

module.exports = router;
