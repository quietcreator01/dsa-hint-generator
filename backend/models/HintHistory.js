// Mongoose schema for a single hint-generation session, storing the problem,
// the progressive hints given, and metadata. Referenced from user history views
// and the admin panel to show what problems/hints users have requested.

import mongoose from 'mongoose'

const hintHistorySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  problem: { type: String, required: true },
  hints: [{ type: String }], // ordered array of hints, from most general to most specific
  category: { type: String, default: 'Other' },
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard', null], default: null },
}, { timestamps: true }) // adds createdAt/updatedAt automatically

const HintHistory = mongoose.model('HintHistory', hintHistorySchema)
export default HintHistory