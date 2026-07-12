// Admin-only routes: list users, view aggregate stats, view a user's hint
// history, delete a user, and manually adjust a user's credit balance.
// Mounted at /api/admin, protected by authMiddleware + adminMiddleware on every route.

import express from 'express'
import authMiddleware from '../middleware/auth.js'
import adminMiddleware from '../middleware/admin.js'
import User from '../models/User.js'
import HintHistory from '../models/HintHistory.js'

const router = express.Router()

// GET /users - list all users, newest first, with password field excluded
router.get('/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 })
    res.json({ users })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

// GET /stats - aggregate counts for the admin dashboard (users, problems attempted, hints given)
router.get('/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments()
    const totalProblems = await HintHistory.countDocuments()
    const allHistory = await HintHistory.find()
    // total hints isn't a stored field, so it's summed across all history documents
    const totalHints = allHistory.reduce((sum, h) => sum + h.hints.length, 0)
    res.json({ totalUsers, totalProblems, totalHints })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

// GET /users/:id/history - hint history for a specific user, newest first
router.get('/users/:id/history', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const history = await HintHistory.find({ user: req.params.id }).sort({ createdAt: -1 })
    res.json({ history })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user history' })
  }
})

// DELETE /users/:id - removes a user and cascades deletion of their hint history
router.delete('/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await HintHistory.deleteMany({ user: req.params.id })
    await User.findByIdAndDelete(req.params.id)
    res.json({ message: 'User deleted' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' })
  }
})

// PATCH /users/:id/credits - lets an admin manually set a user's credit balance
router.patch('/users/:id/credits', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { credits } = req.body
    if (typeof credits !== 'number' || credits < 0) {
      return res.status(400).json({ error: 'Credits must be a non-negative number' })
    }
    const user = await User.findByIdAndUpdate(req.params.id, { credits }, { new: true }).select('-password')
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ user })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update credits' })
  }
})

export default router