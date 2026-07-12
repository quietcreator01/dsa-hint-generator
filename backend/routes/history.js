// Route for fetching the logged-in user's own hint history, with optional
// search and category filtering. Mounted at /api/history.

import express from 'express'
import authMiddleware from '../middleware/auth.js'
import HintHistory from '../models/HintHistory.js'

const router = express.Router()

// GET / - returns the user's hint history, newest first.
// Query params: search (matches problem text or hint text, case-insensitive),
// category (exact match, 'All' or omitted means no filter)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, category } = req.query
    const query = { user: req.userId }

    if (category && category !== 'All') {
      query.category = category
    }
    if (search) {
      // matches if the search term appears in either the problem text or any hint
      query.$or = [
        { problem: { $regex: search, $options: 'i' } },
        { hints: { $regex: search, $options: 'i' } },
      ]
    }

    const history = await HintHistory.find(query).sort({ createdAt: -1 })
    res.json({ history })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' })
  }
})

export default router