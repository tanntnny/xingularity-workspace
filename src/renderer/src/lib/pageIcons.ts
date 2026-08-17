import type { AppPage } from '../navigation'
import {
  Bolt,
  Box,
  BookOpen,
  BrandMastercard,
  CalendarEvent,
  ChartDots3,
  Files,
  Mail,
  Paintbrush,
  Settings2,
  type FilledIcon
} from '../components/ui/icons'

export const APP_PAGE_ICONS: Record<AppPage, FilledIcon> = {
  capture: Mail,
  knowledge: ChartDots3,
  notes: Files,
  projects: Box,
  subscriptions: BrandMastercard,
  calendar: CalendarEvent,
  schedules: Bolt,
  schedulingGuide: BookOpen,
  designAudit: Paintbrush,
  settings: Settings2
}

export const VaultIcon = Box
