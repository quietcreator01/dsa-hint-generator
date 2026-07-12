// User's own hint history panel: searchable, filterable by category, with
// expandable entries showing the full progressive hints for each problem.

import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const CATEGORIES = ['All', 'Arrays', 'Strings', 'Two Pointers', 'Sliding Window', 'Hash Map', 'Linked List', 'Trees', 'Graphs', 'Dynamic Programming', 'Sorting', 'Greedy', 'Recursion/Backtracking', 'Math', 'Stack/Queue', 'Other']

// Placeholder row shown while history is loading
function HistorySkeleton() {
  return (
    <div className="history-entry skeleton-entry">
      <div className="skeleton-line" style={{ width: '70%', height: '16px' }} />
      <div className="skeleton-line" style={{ width: '30%', height: '11px', marginTop: '10px' }} />
    </div>
  )
}

function History({ onClose }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [expanded, setExpanded] = useState({})

  // Debounced refetch: waits 300ms after the user stops typing/changing category
  // before hitting the backend, so every keystroke doesn't fire a request
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchHistory()
    }, 300)
    return () => clearTimeout(timer)
  }, [search, category])

  // Fetches history filtered by the current search text and category
  const fetchHistory = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      if (search.trim()) params.append('search', search.trim())
      if (category !== 'All') params.append('category', category)

      const res = await fetch(`${API_URL}/api/history?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) setHistory(data.history)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Toggles whether a given history entry's hints are shown
  const toggleExpanded = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const formatDate = (dateStr) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  return (
    <div className="history-panel">
      <div className="history-header">
        <h2>History</h2>
        <button type="button" onClick={onClose}>Close</button>
      </div>

      <div className="history-filters">
        <div className="history-search-wrap">
          <svg className="search-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search problems or hints..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="history-search"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="history-category-select"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {loading && (
        <>
          <HistorySkeleton />
          <HistorySkeleton />
          <HistorySkeleton />
        </>
      )}

      {!loading && history.length === 0 && (
        <div className="history-empty">
          <p className="history-empty-title">
            {search || category !== 'All' ? 'No matches found' : 'No problems yet'}
          </p>
          <p className="subtitle">
            {search || category !== 'All'
              ? 'Try a different search term or category.'
              : 'Solve a problem to see it show up here.'}
          </p>
        </div>
      )}

      {!loading && history.length > 0 && (
        <p className="history-count">{history.length} problem{history.length !== 1 ? 's' : ''}</p>
      )}

      {history.map((entry) => {
        const isOpen = expanded[entry._id]
        return (
          <div className="history-entry" key={entry._id}>
            <button
              type="button"
              className="history-entry-toggle"
              onClick={() => toggleExpanded(entry._id)}
            >
              <div className="history-entry-header">
                <p className="history-problem">{entry.problem}</p>
                <div className="history-tags">
                  {entry.category && <span className="tag tag-category">{entry.category}</span>}
                  {entry.difficulty && (
                    <span className={`tag tag-difficulty tag-${entry.difficulty.toLowerCase()}`}>
                      {entry.difficulty}
                    </span>
                  )}
                </div>
              </div>
              <div className="history-meta-row">
                <span className="history-meta">{entry.hints.length} hint{entry.hints.length !== 1 ? 's' : ''} · {formatDate(entry.createdAt)}</span>
                <svg
                  className={`chevron ${isOpen ? 'open' : ''}`}
                  viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </button>

            {isOpen && (
              <div className="history-hints">
                {entry.hints.map((h, i) => (
                  <div className="hint-box" key={i}>
                    <div className="hint-number">{i + 1}</div>
                    <div className="hint-content">
                      <h3>Hint {i + 1}</h3>
                      <p>{h}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default History