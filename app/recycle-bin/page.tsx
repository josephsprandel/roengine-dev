import { redirect } from 'next/navigation'

export default function RecycleBinPage() {
  redirect('/settings?tab=recycle-bin')
}
