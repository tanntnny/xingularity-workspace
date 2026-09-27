import { forwardRef, useId } from 'react'
import {
  IconAdjustmentsHorizontalFilled,
  IconAlertCircle,
  IconAlertCircleFilled,
  IconAntennaBars3,
  IconAntennaBars4,
  IconAntennaBars5,
  IconArchive,
  IconArchiveFilled,
  IconArrowDownCircleFilled,
  IconArrowLeftCircleFilled,
  IconArrowRightCircleFilled,
  IconArrowUpCircleFilled,
  IconBellFilled,
  IconBellRingingFilled,
  IconBolt,
  IconBox,
  IconBookFilled,
  IconBrandGithubFilled,
  IconBrandJavascript,
  IconBrandMastercard,
  IconBrandPython,
  IconBriefcaseFilled,
  IconCalendarCheck,
  IconBulbFilled,
  IconCalendarEvent,
  IconCalendarEventFilled,
  IconCalendarFilled,
  IconCalendarOff,
  IconCameraFilled,
  IconChartLine,
  IconChartDots3,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconCheckFilled,
  IconCircleCheck,
  IconCircleCheckFilled,
  IconCircleDashed,
  IconCircleDashedMinus,
  IconCircleDotted,
  IconCircleDotFilled,
  IconCircleFilled,
  IconCircleHalf2,
  IconCircleKeyFilled,
  IconCircleArrowUpRightFilled,
  IconCircleRectangle,
  IconCircleXFilled,
  IconClock,
  IconClockCheck,
  IconClockFilled,
  IconClockOff,
  IconCopyFilled,
  IconCreditCardFilled,
  IconDeviceDesktop,
  IconDeviceDesktopFilled,
  IconDeviceFloppyFilled,
  IconDeviceSpeakerFilled,
  IconDirectionArrowsFilled,
  IconDiamonds,
  IconDiamondsFilled,
  IconDotsFilled,
  IconDotsVertical,
  IconDownloadFilled,
  IconExclamationMark,
  IconEyeFilled,
  IconFileDownloadFilled,
  IconFiles,
  IconFilter2,
  IconFilterFilled,
  IconFlagFilled,
  IconFlaskFilled,
  IconFolderFilled,
  IconFolderOff,
  IconFolderOpenFilled,
  IconGripVertical,
  IconGitBranch,
  IconHourglassEmpty,
  IconHourglassFilled,
  IconHeartFilled,
  IconHexagon,
  IconHexagonFilled,
  IconInbox,
  IconHomeFilled,
  IconKeyboardFilled,
  IconLayout2Filled,
  IconLayoutDashboardFilled,
  IconLayoutGridFilled,
  IconLayoutKanbanFilled,
  IconLayoutSidebarFilled,
  IconLayoutSidebarRightCollapseFilled,
  IconLayoutSidebarRightExpandFilled,
  IconListCheckFilled,
  IconListDetailsFilled,
  IconLinkFilled,
  IconMail,
  IconMessage2Filled,
  IconMessageChatbotFilled,
  IconMessageFilled,
  IconMaximize,
  IconPaletteFilled,
  IconPencilFilled,
  IconPlayerPlayFilled,
  IconPlusFilled,
  IconRefresh,
  IconRepeat,
  IconSendFilled,
  IconSearch,
  IconShield,
  IconSettingsFilled,
  IconShieldFilled,
  IconSparklesFilled,
  IconStar,
  IconStarFilled,
  IconTag,
  IconTagFilled,
  IconTable,
  IconTrash,
  IconTrendingDown,
  IconTrophyFilled,
  IconFileTypographyFilled,
  IconUnlink,
  IconWorldFilled,
  IconXFilled
} from '@tabler/icons-react'
import type { IconProps, TablerIcon } from '@tabler/icons-react'
import { cn } from '../../lib/utils'

export type FilledIcon = TablerIcon
export type FilledIconProps = IconProps

export const MarkdownFileIcon = forwardRef<SVGSVGElement, FilledIconProps>(
  ({ className, size = 24, title, children, stroke: _stroke, ...props }, ref) => {
    void _stroke
    const gradientId = useId().replace(/:/g, '')

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 30 30"
        className={cn('tabler-icon icon-tabler-markdown-file', className)}
        fill="none"
        {...props}
      >
        {title ? <title>{title}</title> : null}
        <defs>
          <linearGradient
            id={`markdown-file-gradient-${gradientId}`}
            x1="6"
            y1="3"
            x2="24"
            y2="27"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#f8f8f8" />
            <stop offset="1" stopColor="#ababab" />
          </linearGradient>
          <linearGradient
            id={`markdown-file-fold-gradient-${gradientId}`}
            x1="19"
            y1="3"
            x2="24"
            y2="8"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#eeeeee" />
            <stop offset="1" stopColor="#999999" />
          </linearGradient>
        </defs>
        <path
          d="M19 3H8C6.9 3 6 3.9 6 5v20c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8L19 3z"
          fill={`url(#markdown-file-gradient-${gradientId})`}
        />
        <polygon points="19,3 19,8 24,8" fill={`url(#markdown-file-fold-gradient-${gradientId})`} />
        {children}
      </svg>
    )
  }
)

MarkdownFileIcon.displayName = 'MarkdownFileIcon'

export const ExcalidrawFileIcon = forwardRef<SVGSVGElement, FilledIconProps>(
  ({ className, size = 24, title, children, stroke: _stroke, ...props }, ref) => {
    void _stroke
    const gradientId = useId().replace(/:/g, '')

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 36 36"
        className={cn('tabler-icon icon-tabler-excalidraw-file', className)}
        fill="none"
        {...props}
      >
        {title ? <title>{title}</title> : null}
        <defs>
          <linearGradient
            id={`excalidraw-file-hand-gradient-${gradientId}`}
            x1="21"
            y1="23"
            x2="34"
            y2="34"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#eeeeee" />
            <stop offset="1" stopColor="#999999" />
          </linearGradient>
          <linearGradient
            id={`excalidraw-file-pencil-gradient-${gradientId}`}
            x1="7"
            y1="7"
            x2="31"
            y2="31"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#f8f8f8" />
            <stop offset="1" stopColor="#ababab" />
          </linearGradient>
          <linearGradient
            id={`excalidraw-file-metal-gradient-${gradientId}`}
            x1="2"
            y1="2"
            x2="15"
            y2="15"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#eeeeee" />
            <stop offset="1" stopColor="#999999" />
          </linearGradient>
        </defs>
        <path
          fill="url(#excalidraw-file-hand-gradient-${gradientId})"
          d="M35.222 33.598c-.647-2.101-1.705-6.059-2.325-7.566c-.501-1.216-.969-2.438-1.544-3.014c-.575-.575-1.553-.53-2.143.058c0 0-2.469 1.675-3.354 2.783c-1.108.882-2.785 3.357-2.785 3.357c-.59.59-.635 1.567-.06 2.143c.576.575 1.798 1.043 3.015 1.544c1.506.62 5.465 1.676 7.566 2.325c.359.11 1.74-1.271 1.63-1.63z"
        />
        <path
          fill="#c7c7c7"
          d="M13.643 5.308a2.946 2.946 0 0 1 0 4.167l-4.167 4.168a2.948 2.948 0 0 1-4.167 0L1.141 9.475a2.948 2.948 0 0 1 0-4.167l4.167-4.167a2.946 2.946 0 0 1 4.167 0l4.168 4.167z"
        />
        <path
          fill="url(#excalidraw-file-pencil-gradient-${gradientId})"
          d="M31.353 23.018l-4.17 4.17l-4.163 4.165L7.392 15.726l8.335-8.334l15.626 15.626z"
        />
        <path
          fill="#292929"
          d="M32.078 34.763s2.709 1.489 3.441.757c.732-.732-.765-3.435-.765-3.435s-2.566.048-2.676 2.678z"
        />
        <path
          fill="url(#excalidraw-file-metal-gradient-${gradientId})"
          d="M2.183 10.517l8.335-8.335l5.208 5.209l-8.334 8.335z"
        />
        <path
          fill="#999999"
          d="M3.225 11.558l8.334-8.334l1.042 1.042L4.267 12.6zm2.083 2.086l8.335-8.335l1.042 1.042l-8.335 8.334z"
        />
        {children}
      </svg>
    )
  }
)

ExcalidrawFileIcon.displayName = 'ExcalidrawFileIcon'

export const AlertCircle = IconAlertCircleFilled
export const AlertCircleOutline = IconAlertCircle
export const AntennaBars3 = IconAntennaBars3
export const AntennaBars4 = IconAntennaBars4
export const AntennaBars5 = IconAntennaBars5
export const ArchiveOutline = IconArchive
export const Archive = IconArchiveFilled
export const ArrowDown = IconArrowDownCircleFilled
export const ArrowLeft = IconArrowLeftCircleFilled
export const ArrowRight = IconArrowRightCircleFilled
export const ArrowRightToLine = IconDirectionArrowsFilled
export const ArrowUp = IconArrowUpCircleFilled
export const ArrowUpDown = IconDirectionArrowsFilled
export const ArrowUpRight = IconCircleArrowUpRightFilled
export const AtSign = IconCircleKeyFilled
export const Bell = IconBellFilled
export const BellRing = IconBellRingingFilled
export const Bolt = IconBolt
export const Box = IconBox
export const BookOpen = IconBookFilled
export const Bot = IconMessageChatbotFilled
export const Briefcase = IconBriefcaseFilled
export const BrandMastercard = IconBrandMastercard
export const Calendar = IconCalendarFilled
export const CalendarCheck = IconCalendarCheck
export const CalendarEvent = IconCalendarEvent
export const CalendarClock = IconCalendarEventFilled
export const CalendarDays = IconCalendarEventFilled
export const CalendarIcon = IconCalendarFilled
export const CalendarOff = IconCalendarOff
export const CalendarPlus = IconCalendarEventFilled
export const Camera = IconCameraFilled
export const ChartLine = IconChartLine
export const ChartDots3 = IconChartDots3
export const Check = IconCheckFilled
export const CircleCheck = IconCircleCheck
export const CheckCircle2 = IconCircleCheckFilled
export const ChevronDown = IconChevronDown
export const ChevronLeft = IconChevronLeft
export const ChevronRight = IconChevronRight
export const ChevronUp = IconChevronUp
export const Circle = IconCircleFilled
export const CircleAlert = IconAlertCircleFilled
export const CircleDashed = IconCircleDashed
export const CircleDashedMinus = IconCircleDashedMinus
export const CircleDotted = IconCircleDotted
export const CircleHalf2 = IconCircleHalf2
export const CircleRectangle = IconCircleRectangle
export const Clock = IconClockFilled
export const ClockOutline = IconClock
export const ClockCheck = IconClockCheck
export const Clock3 = IconClockFilled
export const ClockOff = IconClockOff
export const Command = IconCircleKeyFilled
export const Copy = IconCopyFilled
export const CreditCard = IconCreditCardFilled
export const Download = IconDownloadFilled
export const ExclamationMark = IconExclamationMark
export const Eye = IconEyeFilled
export const FileDown = IconFileDownloadFilled
export const Files = IconFiles
export const FileText = MarkdownFileIcon
export const Flag = IconFlagFilled
export const FlaskConical = IconFlaskFilled
export const Filter = IconFilter2
export const Filter2 = Filter
export const Folder = IconFolderFilled
export const FolderInput = IconFolderOpenFilled
export const FolderKanban = IconLayoutKanbanFilled
export const FolderOff = IconFolderOff
export const FolderOpen = IconFolderOpenFilled
export const FolderPlus = IconFolderOpenFilled
export const Funnel = IconFilterFilled
export const GitBranch = IconBrandGithubFilled
export const GitBranchOutline = IconGitBranch
export const Globe = IconWorldFilled
export const HardDrive = IconDeviceDesktopFilled
export const HardDriveOutline = IconDeviceDesktop
export const Heart = IconHeartFilled
export const Hexagon = IconHexagon
export const HexagonFilled = IconHexagonFilled
export const Home = IconHomeFilled
export const Inbox = IconInbox
export const House = IconHomeFilled
export const JavaScript = IconBrandJavascript
export const Keyboard = IconKeyboardFilled
export const Landmark = IconDeviceDesktopFilled
export const Layers3 = IconLayout2Filled
export const LayoutDashboard = IconLayoutDashboardFilled
export const LayoutGrid = IconLayoutGridFilled
export const Lightbulb = IconBulbFilled
export const Link = IconLinkFilled
export const Link2 = IconLinkFilled
export const ListTodo = IconListCheckFilled
export const Loader2 = IconHourglassFilled
export const LoaderCircle = IconHourglassFilled
export const HourglassEmpty = IconHourglassEmpty
export const Mail = IconMail
export const Maximize = IconMaximize
export const Megaphone = IconDeviceSpeakerFilled
export const MessageSquare = IconMessageFilled
export const MessageSquarePlus = IconMessage2Filled
export const Milestone = IconDiamonds
export const MilestoneFilled = IconDiamondsFilled
export const Monitor = IconDeviceDesktopFilled
export const MoreHorizontal = IconDotsFilled
export const MoreVertical = IconDotsVertical
export const GripVertical = IconGripVertical
export const NotebookPen = IconBookFilled
export const NotebookTabs = IconBookFilled
export const Option = IconCircleKeyFilled
export const Package = IconLayoutGridFilled
export const Paintbrush = IconPaletteFilled
export const Palette = IconPaletteFilled
export const PanelLeft = IconLayoutSidebarFilled
export const PanelRightClose = IconLayoutSidebarRightCollapseFilled
export const PanelRightOpen = IconLayoutSidebarRightExpandFilled
export const PanelsTopLeft = IconLayoutDashboardFilled
export const PenTool = IconPencilFilled
export const Pencil = IconPencilFilled
export const Play = IconPlayerPlayFilled
export const Plus = IconPlusFilled
export const Python = IconBrandPython
export const RefreshCw = IconRefresh
export const Repeat = IconRepeat
export const Rocket = IconSendFilled
export const Rows3 = IconListDetailsFilled
export const Save = IconDeviceFloppyFilled
export const Search = IconSearch
export const Settings2 = IconSettingsFilled
export const Shield = IconShieldFilled
export const ShieldOutline = IconShield
export const SlidersHorizontal = IconAdjustmentsHorizontalFilled
export const Sparkles = IconSparklesFilled
export const Star = IconStarFilled
export const StarOutline = IconStar
export const Tag = IconTagFilled
export const TagOutline = IconTag
export const Table = IconTable
export const Terminal = IconDeviceDesktopFilled
export const Target = IconCircleDotFilled
export const Trash2 = IconTrash
export const TrendingDown = IconTrendingDown
export const Trophy = IconTrophyFilled
export const Type = IconFileTypographyFilled
export const Unlink = IconUnlink
export const WalletCards = IconCreditCardFilled
export const X = IconXFilled
export const XCircle = IconCircleXFilled
