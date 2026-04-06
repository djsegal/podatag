import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

// ─── Auth hook ───────────────────────────────────────────────
export function useAuth() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  const signInWithEmail = async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
  }

  return { session, loading, signInWithEmail, signOut }
}

// ─── Profile hook ────────────────────────────────────────────
export function useProfile(userId) {
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    if (!userId) { setProfile(null); return }
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data)
      })
  }, [userId])

  const upsertProfile = async (displayName) => {
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, display_name: displayName })
    if (!error) setProfile({ display_name: displayName })
    return { error }
  }

  return { profile, upsertProfile }
}

// ─── Availability hook ───────────────────────────────────────
export function useAvailability(city, format) {
  const [allSlots, setAllSlots] = useState({}) // { displayName: { slotKey: true } }
  const [allUsers, setAllUsers] = useState([]) // [displayName, ...]
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    setLoading(true)

    // Fetch availability rows
    const { data: availData, error: availErr } = await supabase
      .from('availability')
      .select('slot_key, user_id')
      .eq('city', city)
      .eq('format', format)

    if (availErr) {
      console.error('Error loading availability:', availErr)
      setLoading(false)
      return
    }

    // Collect unique user IDs and fetch their profiles
    const userIds = [...new Set((availData || []).map(r => r.user_id))]
    const nameMap = {} // userId -> displayName

    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', userIds)

      for (const p of (profileData || [])) {
        nameMap[p.id] = p.display_name
      }
    }

    const slotsByUser = {}
    const userSet = new Set()

    for (const row of (availData || [])) {
      const name = nameMap[row.user_id] || 'Unknown'
      userSet.add(name)
      if (!slotsByUser[name]) slotsByUser[name] = {}
      slotsByUser[name][row.slot_key] = true
    }

    setAllSlots(slotsByUser)
    setAllUsers([...userSet])
    setLoading(false)
  }, [city, format])

  useEffect(() => { loadAll() }, [loadAll])

  // Replace all slots for a user in one scope
  const submitSlots = async (userId, slotKeys) => {
    // Delete existing
    await supabase
      .from('availability')
      .delete()
      .eq('user_id', userId)
      .eq('city', city)
      .eq('format', format)

    // Insert new
    if (slotKeys.length > 0) {
      const rows = slotKeys.map(sk => ({
        user_id: userId,
        city,
        format,
        slot_key: sk,
      }))
      await supabase.from('availability').insert(rows)
    }

    // Reload
    await loadAll()
  }

  return { allSlots, allUsers, loading, submitSlots, reload: loadAll }
}
