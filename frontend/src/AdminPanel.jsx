// Admin dashboard component: shows aggregate stats, lists all users with search,
// and lets an admin edit credits, view a user's hint history, or delete a user.
// Rendered as an overlay/panel, closed via the onClose prop.

import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function AdminPanel({ onClose }) {
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [userSearch, setUserSearch] = useState('')
  const [editingCredits, setEditingCredits] = useState(null) // { userId, value }
  const [viewingHistory, setViewingHistory] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  // Loads stats and user list in parallel on mount.
  // Both requests are allowed to fail independently — whichever succeeds still renders.
  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }

      const [statsRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/stats`, { headers }),
        fetch(`${API_URL}/api/admin/users`, { headers }),
      ])

      const statsData = await statsRes.json()
      const usersData = await usersRes.json()

      if (statsRes.ok) setStats(statsData)
      if (usersRes.ok) setUsers(usersData.users)

      if (!statsRes.ok || !usersRes.ok) {
        setError('Failed to load some admin data')
      }
    } catch (err) {
      setError('Network error — is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  // Deletes the user currently held in deleteTarget (set via the confirm modal)
  // and removes them from local state on success, avoiding a full refetch
  const handleDeleteUser = async () => {
    if (!deleteTarget) return
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/api/admin/users/${deleteTarget._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u._id !== deleteTarget._id))
        setDeleteTarget(null)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to delete user')
      }
    } catch (err) {
      setError('Network error — is the backend running?')
    }
  }

  // Puts a user's credit field into inline edit mode
  const startEditCredits = (u) => {
    setEditingCredits({ userId: u._id, value: String(u.credits) })
  }

  // Submits the edited credit value for the user in editingCredits.
  // Silently no-ops on invalid input (NaN or negative) instead of showing an error,
  // since the input is already constrained by min="0".
  const saveCredits = async () => {
    if (!editingCredits) return
    const newCredits = parseInt(editingCredits.value, 10)
    if (isNaN(newCredits) || newCredits < 0) return

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/api/admin/users/${editingCredits.userId}/credits`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ credits: newCredits }),
      })
      if (res.ok) {
        const data = await res.json()
        setUsers((prev) => prev.map((u) => (u._id === data.user._id ? { ...u, credits: data.user.credits } : u)))
        setEditingCredits(null)
      } else {
        setError('Failed to update credits')
      }
    } catch (err) {
      setError('Network error')
    }
  }

  // Fetches a specific user's hint history and opens it in the history view
  const viewUserHistory = async (u) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/api/admin/users/${u._id}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) setViewingHistory({ user: u, entries: data.history })
    } catch (err) {
      setError('Failed to load user history')
    }
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Client-side filter of the already-fetched user list, case-insensitive email match
  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  )

  return (
    <div className="admin-panel">
      <div className="history-header">
        <h2>Admin</h2>
        <button type="button" onClick={onClose}>Close</button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading && <p className="subtitle">Loading admin data...</p>}

      {!loading && stats && (
        <div className="admin-stats-row">
          <div className="admin-stat-card">
            <p className="admin-stat-value">{stats.totalUsers}</p>
            <p className="admin-stat-label">Users</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-value">{stats.totalProblems}</p>
            <p className="admin-stat-label">Problems</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-value">{stats.totalHints}</p>
            <p className="admin-stat-label">Hints given</p>
          </div>
        </div>
      )}

      {viewingHistory && (
        <div className="admin-user-history">
          <div className="history-header">
            <h3>{viewingHistory.user.email}'s history</h3>
            <button type="button" onClick={() => setViewingHistory(null)}>Close</button>
          </div>
          {viewingHistory.entries.length === 0 && <p className="subtitle">No problems yet.</p>}
          {viewingHistory.entries.map((entry) => (
            <div className="history-entry" key={entry._id}>
              <div className="history-entry-header">
                <p className="history-problem">{entry.problem}</p>
                {entry.category && <span className="tag tag-category">{entry.category}</span>}
              </div>
              <p className="history-meta">{entry.hints.length} hint{entry.hints.length !== 1 ? 's' : ''}</p>
            </div>
          ))}
        </div>
      )}

      {!loading && users.length > 0 && (
        <>
          <input
            type="text"
            placeholder="Search users by email..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            className="history-search admin-user-search"
          />
          <p className="history-count">{filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}</p>
          <div className="admin-user-list">
            {filteredUsers.map((u) => (
              <div className="admin-user-row" key={u._id}>
                <div className="admin-user-info">
                  <div className="user-avatar admin-avatar">{u.email[0].toUpperCase()}</div>
                  <div>
                    <p className="admin-user-email">
                      {u.email}
                      {u.isAdmin && <span className="tag tag-category admin-tag">Admin</span>}
                    </p>
                    <p className="admin-user-meta">
                      {editingCredits?.userId === u._id ? (
                        <span className="credits-edit-row">
                          <input
                            type="number"
                            min="0"
                            value={editingCredits.value}
                            onChange={(e) => setEditingCredits({ userId: u._id, value: e.target.value })}
                            className="credits-edit-input"
                            autoFocus
                          />
                          <button type="button" className="ghost-btn credits-save-btn" onClick={saveCredits}>Save</button>
                          <button type="button" className="ghost-btn credits-save-btn" onClick={() => setEditingCredits(null)}>Cancel</button>
                        </span>
                      ) : (
                        <>
                          <button type="button" className="link-btn credits-link" onClick={() => startEditCredits(u)}>
                            {u.credits} credits
                          </button>
                          {' '}· joined {formatDate(u.createdAt)}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="admin-row-actions">
                  <button type="button" className="ghost-btn" onClick={() => viewUserHistory(u)}>
                    View history
                  </button>
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() => setDeleteTarget(u)}
                    disabled={u.isAdmin}
                    title={u.isAdmin ? "Can't delete an admin account" : 'Delete user'}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Delete this user?</h3>
            <p>
              This permanently removes <strong>{deleteTarget.email}</strong> and all their hint history. This cannot be undone.
            </p>
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="danger-btn-solid" onClick={handleDeleteUser}>
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminPanel