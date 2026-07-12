// Mongoose schema for a registered user, including auth fields, credit balance
// for hint generation, and admin flag. Credits refill over time — see utils/credits.js
// for the refill logic that consumes lastRefill.

import mongoose from 'mongoose'
import { MAX_CREDITS } from '../utils/credits.js'

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // stored as a bcrypt hash, not plaintext
  credits: { type: Number, default: MAX_CREDITS },
  lastRefill: { type: Date, default: Date.now }, // timestamp used to calculate credit refills
  isAdmin: { type: Boolean, default: false },
}, { timestamps: true })

const User = mongoose.model('User', userSchema)
export default User