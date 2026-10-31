import type { ComponentType } from 'react';
import { ArrowLeftRight, ArrowRightLeft, CalendarClock, Clock, Settings } from 'lucide-react';
import type { MessageKey } from '../lib/i18n';

export type IconComponent = ComponentType<{
  size?: number | string;
  className?: string;
  strokeWidth?: number;
}>;

export type ViewId = 'clock' | 'compare' | 'planner' | 'converter' | 'settings';

export const NAV_ITEMS: { id: ViewId; icon: IconComponent; labelKey: MessageKey; hintKey: MessageKey }[] = [
  { id: 'clock', icon: Clock, labelKey: 'nav.clock', hintKey: 'clock.subtitle' },
  { id: 'compare', icon: ArrowLeftRight, labelKey: 'nav.compare', hintKey: 'compare.subtitle' },
  { id: 'planner', icon: CalendarClock, labelKey: 'nav.planner', hintKey: 'planner.subtitle' },
  { id: 'converter', icon: ArrowRightLeft, labelKey: 'nav.converter', hintKey: 'converter.subtitle' },
  { id: 'settings', icon: Settings, labelKey: 'nav.settings', hintKey: 'settings.subtitle' },
];

export const AUTHOR_HANDLE = '@0xkillcoin';
export const AUTHOR_URL = 'https://x.com/0xkillcoin';
