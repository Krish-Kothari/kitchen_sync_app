const prisma = require('../config/prisma');
const AppError = require('../utils/appError');
const { isValidCoordinate } = require('../utils/geo');
const {
  hashPassword,
  comparePassword,
  signToken,
  sanitizeKitchen,
} = require('../utils/auth');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function register(req, res, next) {
  try {
    const {
      name,
      ownerName,
      email,
      phone,
      password,
      address,
      locality,
      latitude,
      longitude,
    } = req.body;

    if (!name || !ownerName || !email || !phone || !password || !address || !locality) {
      throw new AppError(
        'Missing required fields: name, ownerName, email, phone, password, address, locality',
        400
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedPhone = String(phone).trim();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      throw new AppError('Invalid email address format', 400);
    }

    if (String(password).length < 6) {
      throw new AppError('Password must be at least 6 characters long', 400);
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!isValidCoordinate(lat, lng)) {
      throw new AppError('Valid numeric latitude and longitude are required', 400);
    }

    const existing = await prisma.kitchen.findFirst({
      where: {
        OR: [{ email: normalizedEmail }, { phone: normalizedPhone }],
      },
      select: { id: true, email: true, phone: true },
    });

    if (existing) {
      const conflictField = existing.email === normalizedEmail ? 'email' : 'phone';
      throw new AppError(`A kitchen with this ${conflictField} is already registered`, 409);
    }

    const passwordHash = await hashPassword(password);

    const kitchen = await prisma.kitchen.create({
      data: {
        name: String(name).trim(),
        ownerName: String(ownerName).trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        passwordHash,
        address: String(address).trim(),
        locality: String(locality).trim(),
        latitude: lat,
        longitude: lng,
      },
    });

    const token = signToken(kitchen);

    res.status(201).json({
      message: 'Kitchen registered successfully',
      token,
      kitchen: sanitizeKitchen(kitchen),
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const kitchen = await prisma.kitchen.findUnique({
      where: { email: normalizedEmail },
    });

    if (!kitchen) {
      throw new AppError('Invalid email or password', 401);
    }

    const isMatch = await comparePassword(password, kitchen.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401);
    }

    const token = signToken(kitchen);

    res.status(200).json({
      message: 'Login successful',
      token,
      kitchen: sanitizeKitchen(kitchen),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login };
