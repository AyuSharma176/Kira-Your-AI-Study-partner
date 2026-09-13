export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(error);
  if (res.headersSent) return next(error);

  if (error.name === 'MulterError') {
    return res.status(400).json({ message: `Upload error: ${error.message}` });
  }
  if (error.code === 11000) {
    return res.status(409).json({ message: 'That file has already been analyzed.' });
  }
  if (error.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid resource identifier.' });
  }

  const status = error.statusCode || 500;
  return res.status(status).json({ message: error.message || 'Something went wrong.' });
}
