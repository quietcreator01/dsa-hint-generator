// Entry point for the Express server: sets up middleware, connects to MongoDB,
// and mounts all API route groups (auth, hints, history, admin).

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import dns from 'dns'
import hintRoutes from './routes/hint.js'
import authRoutes from './routes/auth.js'
import historyRoutes from './routes/history.js'
import adminRoutes from './routes/admin.js'

// Forces Google's public DNS servers — works around DNS resolution issues
// with the default resolver in some hosting/container environments
dns.setServers(['8.8.8.8', '8.8.4.4'])

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json())
app.use('/api/history', historyRoutes)
app.use('/api/admin', adminRoutes)

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err))

// Simple health-check / landing route
app.get('/', (req, res) => {
  res.send('DSA Hint Generator API is running')
})

app.use('/api/hint', hintRoutes)
app.use('/api/auth', authRoutes)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})