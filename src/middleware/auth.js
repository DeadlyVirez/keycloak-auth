export function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  const host = req.headers['host'] || 'localhost:3000';
  res.redirect(`http://${host}/login`);
}