import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
});

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, createdAt: user.createdAt };
}

function createToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

export async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) return res.status(409).json({ message: 'An account with that email already exists.' });

    const user = await User.create({ name: name.trim(), email: normalizedEmail, password });
    const token = createToken(user._id);
    res.cookie('token', token, cookieOptions());
    return res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Incorrect email or password.' });
    }

    const token = createToken(user._id);
    res.cookie('token', token, cookieOptions());
    return res.status(200).json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
}

export function me(req, res) {
  res.json({ user: publicUser(req.user) });
}

export function logout(req, res) {
  res.clearCookie('token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
  res.status(204).end();
}
