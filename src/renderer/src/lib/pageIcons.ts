import type { AppPage } from '../navigation'
import {
  Bolt,
  Box,
  BookOpen,
  BrandMastercard,
  CalendarEvent,
  ChartDots3,
  Files,
  ListTodo,
  Mail,
  Palette,
  Shield,
  Settings2,
  Table,
  type FilledIcon
} from '../components/ui/icons'

export const APP_PAGE_ICONS: Record<AppPage, FilledIcon> = {
  capture: Mail,
  stickyNote: Palette,
  knowledge: ChartDots3,
  notes: Files,
  projects: Box,
  tasks: ListTodo,
  resources: Table,
  subscriptions: BrandMastercard,
  calendar: CalendarEvent,
  schedules: Bolt,
  schedulingGuide: BookOpen,
  designAudit: Shield,
  settings: Settings2
}

export const VaultIcon = Box
