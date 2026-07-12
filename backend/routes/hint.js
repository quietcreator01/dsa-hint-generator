// Core hint-generation route: validates the problem input, checks/deducts user
// credits, calls the Gemini API for a progressive hint, auto-categorizes the
// problem on the first hint, and appends to hint history. Mounted at /api/hints.

import express from 'express'
import { GoogleGenAI } from '@google/genai'
import rateLimit from 'express-rate-limit'
import authMiddleware from '../middleware/auth.js'
import User from '../models/User.js'
import HintHistory from '../models/HintHistory.js'
import { refreshCreditsIfNeeded, msUntilNextRefill, MAX_CREDITS } from '../utils/credits.js'

const router = express.Router()

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

// Limits hint requests per IP to prevent abuse/API cost overrun
const hintLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many requests — slow down.' },
})

const CATEGORIES = ['Arrays', 'Strings', 'Two Pointers', 'Sliding Window', 'Hash Map', 'Linked List', 'Trees', 'Graphs', 'Dynamic Programming', 'Sorting', 'Greedy', 'Recursion/Backtracking', 'Math', 'Stack/Queue', 'Other']

// Asks the model to classify a problem statement into one of the fixed CATEGORIES,
// used to tag hint history entries. Falls back to 'Other' on any failure or
// if the model returns something outside the allowed list, so this never blocks hint generation.
async function categorizeProblem(problem) {
  try {
    const prompt = `Classify this DSA problem into exactly one category from this list: ${CATEGORIES.join(', ')}.\n\nProblem: "${problem}"\n\nRespond with ONLY the category name, nothing else.`
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
    })
    const category = response.text.trim()
    return CATEGORIES.includes(category) ? category : 'Other'
  } catch (err) {
    return 'Other'
  }
}

// POST / - generates the next progressive hint for a problem.
// Body: { problem, hintLevel, previousHints, difficulty }
// hintLevel is 0-indexed (0 = first/most general hint); previousHints are passed
// back in so the prompt can explicitly tell the model not to repeat them.
router.post('/', hintLimiter, authMiddleware, async (req, res) => {
  try {
    const { problem, hintLevel, previousHints, difficulty } = req.body

    const trimmedProblem = problem ? problem.trim() : ''

    if (!trimmedProblem) {
      return res.status(400).json({ error: 'Please enter a problem description' })
    }

    if (trimmedProblem.length < 15) {
      return res.status(400).json({ error: 'Problem description is too short — add more detail' })
    }

    if (trimmedProblem.length > 3000) {
      return res.status(400).json({ error: 'Problem description is too long (max 3000 characters)' })
    }

    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Apply any time-based credit refill before checking balance
    refreshCreditsIfNeeded(user)

    if (user.credits <= 0) {
      await user.save()
      return res.status(403).json({ error: 'Out of credits', nextRefillMs: msUntilNextRefill(user), maxCredits: MAX_CREDITS })
    }

    // Tell the model what's already been said so it builds on prior hints instead of repeating them
    const priorHintsText =
      previousHints && previousHints.length > 0
        ? `\n\nHints already given so far:\n${previousHints.map((h, i) => `${i + 1}. ${h}`).join('\n')}\n\nDo NOT repeat these points. Build on them with genuinely new information.`
        : ''

    // Adjusts hint directness based on difficulty: Easy hints can be more direct,
    // Hard hints stay conceptual for longer to preserve challenge
    const difficultyNote =
      difficulty === 'Easy'
        ? ' Since this problem is marked Easy, hint 1 can be a little more direct about the pattern to use.'
        : difficulty === 'Hard'
        ? ' Since this problem is marked Hard, keep hints more conceptual and abstract even at higher hint numbers — avoid being too directive.'
        : ''

    // Core prompt instructs the model to never give a full solution, keep hints short,
    // and avoid LaTeX notation since the frontend renders plain text
    const prompt = `You are a DSA (Data Structures & Algorithms) tutor. A student is working on this problem:"${trimmedProblem}"Give hint number ${hintLevel + 1}. Hint 1 should be a very general nudge about the approach/pattern to consider (no code, no direct answer). Each subsequent hint should be progressively more specific — mentioning relevant data structures, algorithmic techniques, or edge cases — but NEVER give the full solution or code, even at the highest hint level. Keep the hint to 2-3 sentences. Only give the new hint itself — do not restate or number previous hints. Do not use LaTeX or math notation like $...$ — write everything in plain text (e.g. "index i, j" not "$(i, j)$").${difficultyNote}${priorHintsText}`

    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
    })

    // Strip any stray $ signs in case the model ignores the no-LaTeX instruction
    const hintText = response.text.replace(/\$/g, '')

    user.credits -= 1
    await user.save()

    // First hint for this problem: create a new history entry (also triggers categorization)
    if (hintLevel === 0) {
      const category = await categorizeProblem(trimmedProblem)
      await HintHistory.create({
        user: user._id,
        problem: trimmedProblem,
        hints: [hintText],
        category,
        difficulty: difficulty || null,
      })
    } else {
      // Subsequent hint: append to the most recent matching history entry for this user/problem
      await HintHistory.findOneAndUpdate(
        { user: user._id, problem: trimmedProblem },
        { $push: { hints: hintText } },
        { sort: { createdAt: -1 } }
      )
    }

    res.json({
      hint: hintText,
      creditsRemaining: user.credits,
      maxCredits: MAX_CREDITS,
    })
  } catch (err) {
    console.error('Gemini API error:', err)
    res.status(500).json({ error: 'Failed to generate hint' })
  }
})

export default router