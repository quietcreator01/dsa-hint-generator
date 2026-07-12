// Middleware that restricts route access to admin users only.
// Assumes an earlier auth middleware has already set req.userId from a verified token.
// Used by mounting it on admin-only routes (e.g. /api/admin/*) before the route handler runs.

import User from '../models/User.js'

// Allows the request through only if req.userId belongs to an admin user.
const adminMiddleware = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId)
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' })
    }
    next()
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
}

export default adminMiddleware