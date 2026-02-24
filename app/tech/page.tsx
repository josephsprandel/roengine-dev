'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { TechROCard } from '@/components/tech/tech-ro-card'
import { PullToRefresh } from '@/components/tech/pull-to-refresh'
import { Loader2, Inbox } from 'lucide-react'
import type { TechWorkOrder } from '@/lib/tech-helpers'

export default function TechDashboard() {
  const { user } = useAuth()
  const [myJobs, setMyJobs] = useState<TechWorkOrder[]>([])
  const [allJobs, setAllJobs] = useState<(TechWorkOrder & { assigned_tech_name?: string })[]>([])
  const [loadingMy, setLoadingMy] = useState(true)
  const [loadingAll, setLoadingAll] = useState(false)
  const [activeTab, setActiveTab] = useState('my-jobs')

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('auth_token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [])

  const fetchMyJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/tech/my-jobs', { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setMyJobs(data.work_orders || [])
      }
    } catch (err) {
      console.error('Error fetching my jobs:', err)
    } finally {
      setLoadingMy(false)
    }
  }, [getAuthHeaders])

  const fetchAllJobs = useCallback(async () => {
    setLoadingAll(true)
    try {
      const res = await fetch('/api/tech/all-jobs', { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setAllJobs(data.work_orders || [])
      }
    } catch (err) {
      console.error('Error fetching all jobs:', err)
    } finally {
      setLoadingAll(false)
    }
  }, [getAuthHeaders])

  // Load my jobs on mount
  useEffect(() => {
    fetchMyJobs()
  }, [fetchMyJobs])

  // Load all jobs when switching to that tab
  useEffect(() => {
    if (activeTab === 'all-jobs' && allJobs.length === 0) {
      fetchAllJobs()
    }
  }, [activeTab, allJobs.length, fetchAllJobs])

  const handleRefresh = useCallback(async () => {
    if (activeTab === 'my-jobs') {
      await fetchMyJobs()
    } else {
      await fetchAllJobs()
    }
  }, [activeTab, fetchMyJobs, fetchAllJobs])

  return (
    <div className="px-4 pt-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full h-12">
          <TabsTrigger value="my-jobs" className="flex-1 text-base h-10">
            My Jobs
            {myJobs.length > 0 && (
              <span className="ml-1.5 bg-primary/20 text-primary text-xs font-bold px-1.5 py-0.5 rounded-full">
                {myJobs.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="all-jobs" className="flex-1 text-base h-10">
            All Open
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-jobs">
          <PullToRefresh onRefresh={handleRefresh}>
            <div className="space-y-3 pt-3 pb-8">
              {loadingMy ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={28} className="animate-spin text-muted-foreground" />
                </div>
              ) : myJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Inbox size={48} className="mb-3 opacity-50" />
                  <p className="text-base font-medium">No jobs assigned</p>
                  <p className="text-sm mt-1">Check All Open for available work</p>
                </div>
              ) : (
                myJobs.map((wo) => (
                  <TechROCard key={wo.id} workOrder={wo} />
                ))
              )}
            </div>
          </PullToRefresh>
        </TabsContent>

        <TabsContent value="all-jobs">
          <PullToRefresh onRefresh={handleRefresh}>
            <div className="space-y-3 pt-3 pb-8">
              {loadingAll ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={28} className="animate-spin text-muted-foreground" />
                </div>
              ) : allJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Inbox size={48} className="mb-3 opacity-50" />
                  <p className="text-base font-medium">No open jobs</p>
                </div>
              ) : (
                allJobs.map((wo) => (
                  <TechROCard
                    key={wo.id}
                    workOrder={wo}
                    showAssignedTech
                    assignedTechName={wo.assigned_tech_name}
                  />
                ))
              )}
            </div>
          </PullToRefresh>
        </TabsContent>
      </Tabs>
    </div>
  )
}
