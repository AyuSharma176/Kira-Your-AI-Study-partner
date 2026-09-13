import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function protect(req, res, next) {
  try {
    const bearerToken = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;
    const token = req.cookies?.token || bearerToken;

    if (!token) return res.status(401).json({ message: 'Please log in to continue.' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId);
    if (!user) return res.status(401).json({ message: 'Your session is no longer valid.' });

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Your session has expired. Please log in again.' });
  }
}
