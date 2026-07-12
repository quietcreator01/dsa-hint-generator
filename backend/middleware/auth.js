// Middleware that verifies the JWT from the Authorization header and attaches
// the decoded userId to the request. Used on any protected route to establish
// that the requester is a logged-in user (adminMiddleware builds on top of this).

import jwt from 'jsonwebtoken'

// Expects header format "Authorization: Bearer <token>".
// Verifies the token and sets req.userId for downstream handlers.
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.split(' ')[1]

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.userId = decoded.userId
        next()
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' })
    }
}

export default authMiddleware