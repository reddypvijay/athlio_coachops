import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useCoaches({ includeInactive = false } = {}) {
    return useQuery({
        queryKey: ['coaches', { includeInactive }],
        queryFn: async () => {
            let q = supabase
                .from('coaches')
                .select(`
                    *,
                    coach_sport_assignments (
                        id,
                        monthly_salary,
                        sports (
                            id,
                            sport_name,
                            community_id,
                            operating_days,
                            weekly_off_days,
                            communities ( id, name )
                        )
                    )
                `)
                .order('name')
            if (!includeInactive) {
                q = q.eq('status', 'active')
            }
            const { data, error } = await q
            if (error) throw error
            return data
        },
    })
}
