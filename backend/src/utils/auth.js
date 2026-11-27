const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

const SALT_ROUNDS = 10;

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

async function comparePassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

function signToken(kitchen) {
  return jwt.sign(
    {
      sub: kitchen.id,
      email: kitchen.email,
      role: kitchen.role,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

function sanitizeKitchen(kitchen) {
  if (!kitchen) return null;
  const { passwordHash, ...safeKitchen } = kitchen;
  return safeKitchen;
}

module.exports = {
  hashPassword,
  comparePassword,
  signToken,
  verifyToken,
  sanitizeKitchen,
};
