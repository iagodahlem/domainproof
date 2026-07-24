// Barrel export for consumers. Components land here as they ship.
export { Button, type ButtonProps } from './button'
export { Header, type HeaderProps } from './header'
export { CenteredMain } from './centered-main'
export { Logo, type LogoProps } from './logo'
export { BrowserChrome, type BrowserChromeProps } from './browser-chrome'
export { CopyButton, type CopyButtonProps } from './copy-button'
export { CopyField, type CopyFieldProps } from './copy-field'
export {
  Badge,
  type BadgeProps,
  type Tone,
  ProviderBadge,
  type ProviderBadgeProps,
  StatusPill,
  type StatusPillProps,
  dotVariants,
} from './badge'
export {
  Callout,
  type CalloutProps,
  type CalloutTone,
  type CalloutEmphasis,
} from './callout'
export { ConfirmBar, type ConfirmBarProps } from './confirm-bar'
export { Card, CardHead, CardBody, CardRow } from './card'
export { Table, TableHeader, TableBody, TableRow, TableCell } from './table'
export { RecordField, type RecordFieldProps } from './record-field'
export {
  RecordCard,
  type RecordCardProps,
  type RecordCardStepTone,
} from './record-card'
export {
  DomainTable,
  DomainTableHead,
  DomainTableRow,
  type DomainTableRowProps,
  DomainTableRowSkeleton,
} from './domain-table'
export {
  VerticalTimeline,
  type VerticalTimelineProps,
  type VerticalTimelineStep,
  type TimelineStepStatus,
} from './vertical-timeline'
export {
  StatusSummary,
  type StatusSummaryProps,
  type StatusSummaryMetaItem,
  Stepper,
  type StepperProps,
  type StepperStep,
  type StepperStepStatus,
} from './status-summary'
export {
  CodePanel,
  type CodePanelProps,
  type CodePanelTab,
  CodeToken,
  type CodeTokenKind,
} from './code-panel'
export {
  PathChooser,
  type PathChooserProps,
  type PathChooserOption,
} from './path-chooser'
export {
  VerificationLog,
  type VerificationLogProps,
  type VerificationLogEntry,
  VerificationLogStatus,
} from './verification-log'
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentedControlOption,
} from './segmented-control'
export { ThemeToggle, type ThemeToggleProps } from './theme-toggle'
export {
  ThemeProvider,
  useTheme,
  type ThemeOverride,
  type ThemePreference,
} from './theme-provider'
export { THEME_STORAGE_KEY } from './theme-storage-key'
export { TextField, type TextFieldProps } from './text-field'
export { Select, type SelectProps, type SelectOption } from './select'
export { Checkbox, type CheckboxProps } from './checkbox'
export {
  Menu,
  MenuTrigger,
  MenuContent,
  type MenuContentProps,
  MenuItem,
  type MenuItemProps,
  MenuSeparator,
} from './menu'
export {
  Dialog,
  DialogTrigger,
  DialogContent,
  type DialogContentProps,
  DialogTitle,
  DialogDescription,
  DialogClose,
  ConfirmDialog,
  type ConfirmDialogProps,
} from './dialog'
export {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  type DrawerContentProps,
  DrawerHeader,
  type DrawerHeaderProps,
  DrawerBody,
  DrawerFooter,
} from './drawer'
export { Skeleton } from './skeleton'
export { cn } from './cn'
