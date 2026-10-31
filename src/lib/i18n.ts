/** Lightweight i18n dictionary (zh / en). No runtime dependency, fully typed. */
import type { Language } from './types';

type Entry = { en: string; zh: string };

export const messages = {
  'app.name': { en: 'TimeBridge', zh: 'TimeBridge' },
  'app.tagline': { en: 'Find the right time, anywhere.', zh: '跨越时区，找到所有人都合适的时间。' },
  'app.subtitle': {
    en: 'A global time workspace for distributed teams: live clocks, an hour-by-hour grid, a meeting finder and a converter — all in your browser.',
    zh: '为分布式团队打造的全球时间工作台：实时时钟、逐小时对照表、会议时间查找器与时间转换器，全部在浏览器本地完成。',
  },
  'app.follow': { en: 'Follow the author on X', zh: '在 X 上关注作者' },
  'app.author': { en: 'Author', zh: '作者' },

  'nav.clock': { en: 'World Clock', zh: '世界时钟' },
  'nav.compare': { en: 'Time Comparison', zh: '时间对照' },
  'nav.planner': { en: 'Meeting Planner', zh: '会议规划' },
  'nav.converter': { en: 'Converter', zh: '时间转换' },
  'nav.settings': { en: 'Settings', zh: '设置' },
  'nav.workspace': { en: 'Workspace', zh: '工作台' },
  'nav.openMenu': { en: 'Open menu', zh: '打开菜单' },
  'nav.closeMenu': { en: 'Close menu', zh: '关闭菜单' },

  'header.localTime': { en: 'Your local time', zh: '你的本地时间' },
  'header.cities': { en: '{n} cities', zh: '{n} 个城市' },
  'header.oneCity': { en: '1 city', zh: '1 个城市' },

  'action.addCity': { en: 'Add city', zh: '添加城市' },
  'action.cancel': { en: 'Cancel', zh: '取消' },
  'action.close': { en: 'Close', zh: '关闭' },
  'action.copy': { en: 'Copy', zh: '复制' },
  'action.copied': { en: 'Copied', zh: '已复制' },
  'action.remove': { en: 'Remove', zh: '删除' },
  'action.setDefault': { en: 'Set as default city', zh: '设为默认城市' },
  'action.isDefault': { en: 'Default city', zh: '默认城市' },
  'action.share': { en: 'Share', zh: '分享' },
  'action.today': { en: 'Today', zh: '今天' },
  'action.prevDay': { en: 'Previous day', zh: '前一天' },
  'action.nextDay': { en: 'Next day', zh: '后一天' },
  'action.reset': { en: 'Reset to defaults', zh: '恢复默认设置' },
  'action.export': { en: 'Export settings', zh: '导出设置' },
  'action.clearData': { en: 'Clear all data', zh: '清除所有数据' },
  'action.selectAll': { en: 'Select all', zh: '全选' },
  'action.clearSelection': { en: 'Clear', zh: '清空' },
  'action.findTimes': { en: 'Find times', zh: '查找时间' },
  'action.copyAll': { en: 'Copy all', zh: '复制全部' },
  'action.addToMyCities': { en: 'Add to my cities', zh: '添加到我的城市' },
  'action.more': { en: 'More', zh: '更多' },

  'clock.title': { en: 'World Clock', zh: '世界时钟' },
  'clock.subtitle': {
    en: 'Every city you follow, side by side, updating live.',
    zh: '与已添加的城市并排显示，实时更新。',
  },
  'clock.yours': { en: 'Your timezone', zh: '你的时区' },
  'clock.offset': { en: 'Offset', zh: '时差' },
  'clock.zone': { en: 'Timezone', zh: '时区' },
  'clock.dst': { en: 'DST', zh: '夏令时' },
  'clock.noDst': { en: 'No DST', zh: '无夏令时' },
  'clock.empty.title': { en: 'No cities yet', zh: '还没有添加城市' },
  'clock.empty.body': {
    en: 'Add the cities your team works from and TimeBridge will keep them in sync.',
    zh: '添加团队所在的城市，TimeBridge 会实时同步它们的时间。',
  },
  'clock.dragHint': { en: 'Drag the handle to reorder', zh: '拖动把手可排序' },
  'clock.today': { en: 'Today', zh: '今天' },
  'clock.tomorrow': { en: 'Tomorrow', zh: '明天' },
  'clock.yesterday': { en: 'Yesterday', zh: '昨天' },
  'clock.daysAhead': { en: 'In {n} days', zh: '{n} 天后' },
  'clock.daysBehind': { en: '{n} days ago', zh: '{n} 天前' },

  'compare.title': { en: 'Time Comparison', zh: '全球时间对照表' },
  'compare.subtitle': {
    en: 'One row per city, one column per hour. Scroll horizontally to see how a shared moment lands for everyone.',
    zh: '每行一个城市，每列一个时间点。横向滑动即可看到同一时刻在各城市的当地时间。',
  },
  'compare.now': { en: 'Now', zh: '现在' },
  'compare.legend.work': { en: 'Working hours', zh: '工作时间' },
  'compare.legend.shoulder': { en: 'Early / late', zh: '清晨 / 傍晚' },
  'compare.legend.night': { en: 'Night', zh: '深夜' },
  'compare.legend.weekend': { en: 'Weekend', zh: '周末' },
  'compare.cellHint': { en: 'Tap a cell to inspect and copy', zh: '点击单元格查看并复制' },
  'compare.scrollHint': { en: 'Swipe horizontally', zh: '左右滑动查看更多' },
  'compare.empty.title': { en: 'Nothing to compare', zh: '暂无可对照的城市' },
  'compare.empty.body': { en: 'Add at least one city to build the grid.', zh: '至少添加一个城市才能生成对照表。' },
  'compare.referenceHint': {
    en: 'Column headers use your local timezone.',
    zh: '列标题使用你的本地时区。',
  },
  'compare.detail': { en: 'Local time', zh: '当地时间' },

  'planner.title': { en: 'Meeting Planner', zh: '会议时间查找器' },
  'planner.subtitle': {
    en: 'Pick the participants, the range and the duration — TimeBridge finds the windows where everyone is awake.',
    zh: '选择参与城市、日期范围和会议时长，TimeBridge 会找出所有人都在合理时间内的会议时段。',
  },
  'planner.participants': { en: 'Participants', zh: '参与城市' },
  'planner.participantsHint': { en: 'Select at least two cities', zh: '至少选择两个城市' },
  'planner.range': { en: 'Date range', zh: '日期范围' },
  'planner.startDate': { en: 'Start date', zh: '开始日期' },
  'planner.days': { en: 'Days', zh: '天数' },
  'planner.duration': { en: 'Duration', zh: '会议时长' },
  'planner.workHours': { en: 'Working hours', zh: '工作时间' },
  'planner.allowWeekend': { en: 'Allow weekend', zh: '允许周末' },
  'planner.allowNonWork': { en: 'Allow outside working hours', zh: '允许非工作时间' },
  'planner.run': { en: 'Find meeting times', zh: '查找会议时间' },
  'planner.running': { en: 'Searching…', zh: '正在搜索…' },
  'planner.empty.title': { en: 'No window found', zh: '没有找到合适时段' },
  'planner.empty.body': {
    en: 'Try a longer range, a shorter meeting, or allow weekend / outside-hours slots.',
    zh: '试试扩大日期范围、缩短会议时长，或允许周末与非工作时间。',
  },
  'planner.result.ideal': { en: 'Everyone is inside working hours', zh: '所有参与者都在工作时间内' },
  'planner.result.compromise': {
    en: 'Best available compromise — highlighted cities would join outside their working hours.',
    zh: '最佳折中方案 —— 被标记的城市需在非工作时间参会。',
  },
  'planner.result.relaxedNonWork': {
    en: 'No slot matched the strict rules, so the working-hours rule was relaxed.',
    zh: '没有完全符合严格条件的时段，已放宽工作时间限制。',
  },
  'planner.result.relaxedWeekend': {
    en: 'No slot matched the strict rules, so weekends were allowed as well.',
    zh: '没有完全符合严格条件的时段，已同时放宽周末限制。',
  },
  'planner.result.count': { en: '{n} candidate windows', zh: '{n} 个候选时段' },
  'planner.best': { en: 'Best', zh: '最佳' },
  'planner.score': { en: '{n}% in work hours', zh: '{n}% 在工作时间' },
  'planner.quality.work': { en: 'Working hours', zh: '工作时间' },
  'planner.quality.shoulder': { en: 'Just outside', zh: '非工作时段（相邻）' },
  'planner.quality.night': { en: 'Night', zh: '深夜' },
  'planner.quality.weekend': { en: 'Weekend', zh: '周末' },
  'planner.needCities': { en: 'Add at least two cities first.', zh: '请先添加至少两个城市。' },
  'planner.shareThis': { en: 'Share this slot', zh: '分享这个时段' },

  'converter.title': { en: 'Time Converter', zh: '时间转换器' },
  'converter.subtitle': {
    en: 'Pick a city, a date and a time — see it everywhere else at once.',
    zh: '选择来源城市、日期和时间，立刻看到它在所有城市的当地时间。',
  },
  'converter.source': { en: 'From', zh: '来源城市' },
  'converter.date': { en: 'Date', zh: '日期' },
  'converter.time': { en: 'Time', zh: '时间' },
  'converter.now': { en: 'Use current time', zh: '使用当前时间' },
  'converter.results': { en: 'Converted times', zh: '转换结果' },
  'converter.empty': { en: 'Add a city to convert into it.', zh: '添加城市后即可转换。' },
  'converter.invalid': { en: 'Enter a valid date and time.', zh: '请输入有效的日期和时间。' },
  'converter.gap': {
    en: 'This local time does not exist (clocks spring forward) — showing the shifted result.',
    zh: '该本地时间因夏令时开始被跳过，这里显示顺延后的时间。',
  },
  'converter.overlap': {
    en: 'This local time happens twice (clocks fall back) — using the first occurrence.',
    zh: '该本地时间因夏令时结束出现两次，这里按第一次计算。',
  },
  'converter.sameDay': { en: 'Same day', zh: '当天' },
  'converter.copyLine': { en: 'Copy line', zh: '复制该行' },

  'settings.title': { en: 'Settings', zh: '设置' },
  'settings.subtitle': {
    en: 'Preferences are stored locally in this browser only.',
    zh: '所有偏好仅保存在当前浏览器的本地存储中。',
  },
  'settings.appearance': { en: 'Appearance', zh: '外观' },
  'settings.language': { en: 'Language', zh: '语言' },
  'settings.theme': { en: 'Theme', zh: '主题' },
  'settings.theme.dark': { en: 'Dark', zh: '深色' },
  'settings.theme.light': { en: 'Light', zh: '浅色' },
  'settings.timeFormat': { en: 'Time format', zh: '时间格式' },
  'settings.hourCycle.24': { en: '24-hour (14:30)', zh: '24 小时制（14:30）' },
  'settings.hourCycle.12': { en: '12-hour (2:30 PM)', zh: '12 小时制（2:30 PM）' },
  'settings.showSeconds': { en: 'Show seconds', zh: '显示秒' },
  'settings.weekStart': { en: 'Week starts on', zh: '每周起始日' },
  'settings.weekStart.mon': { en: 'Monday', zh: '星期一' },
  'settings.weekStart.sun': { en: 'Sunday', zh: '星期日' },
  'settings.scheduling': { en: 'Scheduling', zh: '日程偏好' },
  'settings.defaultDuration': { en: 'Default meeting length', zh: '默认会议时长' },
  'settings.workHours': { en: 'Working hours', zh: '工作时间' },
  'settings.workHoursHint': {
    en: 'Used by the comparison grid and the meeting finder.',
    zh: '用于时间对照表和会议时间查找器。',
  },
  'settings.primaryCity': { en: 'Default city', zh: '默认城市' },
  'settings.primaryCityHint': {
    en: 'Used as the reference column and the converter source.',
    zh: '作为参考时区与时间转换器的来源城市。',
  },
  'settings.primaryCityAuto': { en: 'Match my local timezone', zh: '跟随我的本地时区' },
  'settings.data': { en: 'Data & privacy', zh: '数据与隐私' },
  'settings.dataBody': {
    en: 'TimeBridge runs entirely in your browser. Settings, cities and preferences live in localStorage and are never uploaded. Share links encode only the meeting data you choose.',
    zh: 'TimeBridge 完全在浏览器中运行。设置、城市列表与偏好保存在 localStorage 中，不会上传。分享链接只编码你选择分享的会议信息。',
  },
  'settings.clearConfirm': {
    en: 'Clear every city and reset all preferences?',
    zh: '确定要清除所有城市并重置偏好设置吗？',
  },
  'settings.cleared': { en: 'All local data cleared', zh: '本地数据已清除' },
  'settings.resetDone': { en: 'Settings restored to defaults', zh: '已恢复默认设置' },
  'settings.saved': { en: 'Saved', zh: '已保存' },
  'settings.minutes': { en: 'min', zh: '分钟' },
  'settings.dayCount': { en: 'days', zh: '天' },

  'search.title': { en: 'Add a city', zh: '添加城市' },
  'search.placeholder': { en: 'Search city, country or timezone…', zh: '搜索城市、国家或时区…' },
  'search.hint': {
    en: 'Works in English and Chinese, by city, country or IANA timezone.',
    zh: '支持中文与英文，可按城市、国家或 IANA 时区名搜索。',
  },
  'search.quick': { en: 'Quick add', zh: '常用城市' },
  'search.results': { en: 'Results', zh: '搜索结果' },
  'search.empty': { en: 'No city matches “{q}”', zh: '没有找到与“{q}”匹配的城市' },
  'search.emptyHint': { en: 'Try another spelling or the country name.', zh: '试试其他拼写或国家名称。' },
  'search.added': { en: 'Added', zh: '已添加' },
  'search.allAdded': { en: 'All {n} cities are already on your list', zh: '{n} 个城市都已添加' },
  'search.limit': { en: 'You can track up to {n} cities', zh: '最多可添加 {n} 个城市' },

  'share.title': { en: 'Share meeting time', zh: '分享会议时间' },
  'share.meetingTitle': { en: 'Meeting title', zh: '会议标题' },
  'share.titlePlaceholder': { en: 'Global team sync', zh: '全球团队同步会' },
  'share.duration': { en: 'Duration', zh: '时长' },
  'share.cities': { en: 'Cities included', zh: '包含城市' },
  'share.link': { en: 'Share link', zh: '分享链接' },
  'share.copyText': { en: 'Copy as text', zh: '复制纯文本' },
  'share.copyMarkdown': { en: 'Copy as Markdown', zh: '复制 Markdown' },
  'share.copyLink': { en: 'Copy link', zh: '复制链接' },
  'share.privacy': {
    en: 'The link carries only the meeting title, time, duration and city names — no accounts, no tracking.',
    zh: '链接只包含会议标题、时间、时长与城市名称，不含账号信息，也不做任何追踪。',
  },
  'share.preview': { en: 'Preview', zh: '预览' },
  'share.openShared': { en: 'Import shared meeting', zh: '导入分享的会议' },
  'share.sharedLoaded': { en: 'A shared meeting is loaded', zh: '已载入分享的会议' },
  'share.sharedTitle': { en: 'Shared meeting', zh: '分享的会议' },

  'toast.copied': { en: 'Copied to clipboard', zh: '已复制到剪贴板' },
  'toast.copyFailed': { en: 'Clipboard unavailable — select the text manually', zh: '无法访问剪贴板，请手动选择文本' },
  'toast.cityAdded': { en: 'Added {city}', zh: '已添加 {city}' },
  'toast.cityRemoved': { en: 'Removed {city}', zh: '已删除 {city}' },
  'toast.cityLimit': { en: 'City limit reached ({n})', zh: '已达到城市数量上限（{n}）' },
  'toast.duplicate': { en: '{city} is already on your list', zh: '{city} 已在列表中' },
  'toast.privacyLocal': { en: 'Everything stays in your browser', zh: '所有数据仅保存在你的浏览器' },
  'toast.shareReady': { en: 'Share link copied', zh: '分享链接已复制' },

  'a11y.removeCity': { en: 'Remove {city}', zh: '删除 {city}' },
  'a11y.moveUp': { en: 'Move {city} up', zh: '将 {city} 上移' },
  'a11y.moveDown': { en: 'Move {city} down', zh: '将 {city} 下移' },
  'a11y.setPrimary': { en: 'Use {city} as default', zh: '将 {city} 设为默认城市' },
  'a11y.dialog': { en: 'Dialog', zh: '对话框' },

  'common.weekday.sun': { en: 'Sunday', zh: '星期日' },
  'common.weekday.mon': { en: 'Monday', zh: '星期一' },
  'common.weekday.tue': { en: 'Tuesday', zh: '星期二' },
  'common.weekday.wed': { en: 'Wednesday', zh: '星期三' },
  'common.weekday.thu': { en: 'Thursday', zh: '星期四' },
  'common.weekday.fri': { en: 'Friday', zh: '星期五' },
  'common.weekday.sat': { en: 'Saturday', zh: '星期六' },
  'common.min': { en: 'min', zh: '分钟' },
  'common.hour': { en: 'h', zh: '小时' },
  'common.sameTime': { en: 'Same as local', zh: '与本地时间相同' },
  'common.you': { en: 'You', zh: '你' },
  'common.na': { en: '—', zh: '—' },
} as const satisfies Record<string, Entry>;

export type MessageKey = keyof typeof messages;

export function localeFor(language: Language): string {
  return language === 'zh' ? 'zh-CN' : 'en-US';
}

export function translate(
  language: Language,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const entry = messages[key];
  let value: string = entry[language] ?? entry.en;
  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      value = value.split(`{${name}}`).join(String(replacement));
    }
  }
  return value;
}

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

export function createTranslator(language: Language): Translate {
  return (key, vars) => translate(language, key, vars);
}
