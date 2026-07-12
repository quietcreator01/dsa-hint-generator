// Credit system utilities: users get MAX_CREDITS refilled once per calendar day
// (based on local server time). Used by auth/me and hint generation routes to
// check/refresh a user's credit balance without a scheduled job.

export const MAX_CREDITS = 50

// True if date1 and date2 fall on the same calendar day (ignores time of day)
function isSameDay(date1, date2) {
    return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
    )
}

// Resets a user's credits to MAX_CREDITS if their last refill wasn't today.
// Mutates the passed-in user doc but does NOT save it — callers are responsible
// for calling user.save() if this returns true.
// Returns true if a refill happened, false otherwise.
export function refreshCreditsIfNeeded(user) {
    const now = new Date()
    const last = user.lastRefill ? new Date(user.lastRefill) : null

    if (!last || !isSameDay(last, now)) {
        user.credits = MAX_CREDITS
        user.lastRefill = now
        return true
    }
    return false
}

// Returns milliseconds remaining until the next refill (i.e. until midnight tonight),
// used by the frontend to show a countdown when a user is out of credits
export function msUntilNextRefill(user) {
    const now = new Date()
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0)
    return nextMidnight.getTime() - now.getTime()
}