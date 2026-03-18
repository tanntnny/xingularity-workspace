import { useCallback, useEffect, useState } from 'react'
import type {
  CreateWeeklyPlanPriorityInput,
  CreateWeeklyPlanWeekInput,
  DeleteWeeklyPlanWeekInput,
  ReorderWeeklyPlanPrioritiesInput,
  UpdateWeeklyPlanPriorityInput,
  UpdateWeeklyPlanWeekInput,
  UpsertWeeklyPlanReviewInput,
  WeeklyPlanState,
  RendererVaultApi,
  VaultInfo
} from '../../../shared/types'

type Mutation<T> = (input: T) => Promise<void>

type MutationMap = {
  createWeek: Mutation<CreateWeeklyPlanWeekInput>
  updateWeek: Mutation<UpdateWeeklyPlanWeekInput>
  deleteWeek: Mutation<DeleteWeeklyPlanWeekInput>
  addPriority: Mutation<CreateWeeklyPlanPriorityInput>
  updatePriority: Mutation<UpdateWeeklyPlanPriorityInput>
  deletePriority: (priorityId: string) => Promise<void>
  reorderPriorities: Mutation<ReorderWeeklyPlanPrioritiesInput>
  upsertReview: Mutation<UpsertWeeklyPlanReviewInput>
}

interface UseWeeklyPlanResult extends MutationMap {
  data: WeeklyPlanState | null
  loading: boolean
  refresh: () => Promise<void>
  isReady: boolean
}

export function useWeeklyPlan(
  vaultApi: RendererVaultApi | undefined,
  pushToast: (kind: 'info' | 'error' | 'success', message: string) => void,
  vaultInfo: VaultInfo | null
): UseWeeklyPlanResult {
  const [data, setData] = useState<WeeklyPlanState | null>(null)
  const [loading, setLoading] = useState(false)

  const hasApi = Boolean(vaultApi?.weeklyPlan) && Boolean(vaultInfo)

  const ensureApi = useCallback(() => {
    if (!vaultInfo) {
      throw new Error('No vault selected')
    }
    if (!vaultApi) {
      throw new Error('Vault API unavailable')
    }
    if (!vaultApi.weeklyPlan) {
      throw new Error('Weekly Plan API unavailable')
    }
    return vaultApi.weeklyPlan
  }, [vaultApi, vaultInfo])

  const load = useCallback(async () => {
    if (!vaultInfo || !vaultApi || !vaultApi.weeklyPlan) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const state = await vaultApi.weeklyPlan.getState()
      setData(state)
    } catch (error) {
      pushToast('error', String(error))
    } finally {
      setLoading(false)
    }
  }, [vaultInfo, vaultApi, pushToast])

  useEffect(() => {
    void load()
  }, [load])

  const runMutation = useCallback(
    async (handler: (api: RendererVaultApi['weeklyPlan']) => Promise<WeeklyPlanState>) => {
      try {
        const api = ensureApi()
        const state = await handler(api)
        setData(state)
      } catch (error) {
        pushToast('error', String(error))
      }
    },
    [ensureApi, pushToast]
  )

  const createMutation = <T,>(
    fn: (api: RendererVaultApi['weeklyPlan'], input: T) => Promise<WeeklyPlanState>
  ): Mutation<T> => {
    return async (input: T) => {
      await runMutation((api) => fn(api, input))
    }
  }

  return {
    data,
    loading,
    refresh: load,
    isReady: hasApi,
    createWeek: createMutation((api, input) => api.createWeek(input)),
    updateWeek: createMutation((api, input) => api.updateWeek(input)),
    deleteWeek: createMutation((api, input) => api.deleteWeek(input)),
    addPriority: createMutation((api, input) => api.addPriority(input)),
    updatePriority: createMutation((api, input) => api.updatePriority(input)),
    deletePriority: async (priorityId: string) => {
      await runMutation((api) => api.deletePriority(priorityId))
    },
    reorderPriorities: createMutation((api, input) => api.reorderPriorities(input)),
    upsertReview: createMutation((api, input) => api.upsertReview(input))
  }
}
