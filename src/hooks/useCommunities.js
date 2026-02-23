import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useCommunities({ includeInactive = false } = {}) {
    return useQuery({
        queryKey: ['communities', { includeInactive }],
        queryFn: async () => {
            let q = supabase
                .from('communities')
                .select('*')
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
