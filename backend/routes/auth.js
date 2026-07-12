// Auth routes: signup, login, get current user (with credit auto-refill check),
// and account deletion (cascades to hint history). Mounted at /api/auth.

import express from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import authMiddleware from '../middleware/auth.js'
import { refreshCreditsIfNeeded, msUntilNextRefill, MAX_CREDITS } from '../utils/credits.js'
import HintHistory from '../models/HintHistory.js'

const router = express.Router()

// POST /signup - creates a new user with a hashed password and returns a JWT
router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await User.create({
      email,
      password: hashedPassword,
    })

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    })

    res.status(201).json({
      token,
      user: { id: user._id, email: user.email, credits: user.credits },
    })
  } catch (err) {
    console.error('Signup error:', err)
    res.status(500).json({ error: 'Signup failed' })
  }
})

// POST /login - verifies credentials and returns a JWT
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' })
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    })

    res.json({
      token,
      user: { id: user._id, email: user.email, credits: user.credits },
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Login failed' })
  }
})

// GET /me - returns the logged-in user's profile, applying any pending credit
// refill first (so the client always sees an up-to-date balance without a separate call)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const refreshed = refreshCreditsIfNeeded(user)
    if (refreshed) await user.save()

    res.json({
      user: { id: user._id, email: user.email, credits: user.credits },
      nextRefillMs: msUntilNextRefill(user),
      maxCredits: MAX_CREDITS,
      isAdmin: user.isAdmin,
    })
  } catch (err) {
    console.error('Me error:', err)
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})

// DELETE /me - permanently deletes the account and all associated hint history
router.delete('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) return res.status(404).json({ error: 'User not found' })

    await HintHistory.deleteMany({ user: req.userId })
    await User.findByIdAndDelete(req.userId)

    res.json({ message: 'Account deleted' })
  } catch (err) {
    console.error('Delete account error:', err)
    res.status(500).json({ error: 'Failed to delete account' })
  }
})

export default router