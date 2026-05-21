'use client';

import { useMemo, useState } from 'react';
import { ArrowUpAZ, Check, CalendarIcon, ChevronDown, Clock3, LayoutGrid, List, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
    MorphingDialog,
    MorphingDialogTrigger,
    MorphingDialogContainer,
    MorphingDialogContent,
} from '@/components/ui/morphing-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { buttonVariants } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useNavStore, type NavItem } from '@/components/modules/navbar';
import { CreateDialogContent as ChannelCreateContent } from '@/components/modules/channel/Create';
import { CreateDialogContent as GroupCreateContent } from '@/components/modules/group/Create';
import { CreateDialogContent as ModelCreateContent } from '@/components/modules/model/Create';
import { useTranslations } from 'next-intl';
import { useSearchStore } from './search-store';
import {
    useToolbarViewOptionsStore,
    TOOLBAR_PAGES,
    type ToolbarPage,
    type ChannelFilter,
    type GroupFilter,
    type ModelFilter,
    type LogFilterOption,
    type ToolbarSortField,
    type ToolbarSortOrder,
} from './view-options-store';

const CHANNEL_FILTER_OPTIONS: ChannelFilter[] = ['all', 'enabled', 'disabled'];
const GROUP_FILTER_OPTIONS: GroupFilter[] = ['all', 'with-members', 'empty'];
const MODEL_FILTER_OPTIONS: ModelFilter[] = ['all', 'priced', 'free'];
type CombinedSortOption = {
    value: `${ToolbarSortField}-${ToolbarSortOrder}`;
    field: ToolbarSortField;
    order: ToolbarSortOrder;
    labelKey: string;
};
function formatDate(date: Date): string {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const COMBINED_SORT_OPTIONS: readonly CombinedSortOption[] = [
    { value: 'name-asc', field: 'name', order: 'asc', labelKey: 'popover.nameAsc' },
    { value: 'name-desc', field: 'name', order: 'desc', labelKey: 'popover.nameDesc' },
    { value: 'created-asc', field: 'created', order: 'asc', labelKey: 'popover.createdAsc' },
    { value: 'created-desc', field: 'created', order: 'desc', labelKey: 'popover.createdDesc' },
] as const;

function isToolbarPage(item: NavItem): item is ToolbarPage {
    return (TOOLBAR_PAGES as readonly NavItem[]).includes(item);
}

function CreateDialogContent({ activeItem }: { activeItem: ToolbarPage }) {
    switch (activeItem) {
        case 'channel':
            return <ChannelCreateContent />;
        case 'group':
            return <GroupCreateContent />;
        case 'model':
            return <ModelCreateContent />;
    }
}

function SearchableFilterSelect({
    value,
    onValueChange,
    options,
    allLabel,
    placeholder,
    searchPlaceholder,
    emptyText,
}: {
    value: string;
    onValueChange: (value: string) => void;
    options: LogFilterOption[];
    allLabel: string;
    placeholder: string;
    searchPlaceholder: string;
    emptyText: string;
}) {
    const [open, setOpen] = useState(false);
    const [keyword, setKeyword] = useState('');

    const filteredOptions = useMemo(() => {
        const term = keyword.trim().toLowerCase();
        if (!term) return options;
        return options.filter((option) => option.label.toLowerCase().includes(term));
    }, [keyword, options]);

    const selectedLabel = useMemo(() => {
        if (!value) return allLabel;
        return options.find((option) => option.value === value)?.label ?? value;
    }, [allLabel, options, value]);

    return (
        <Popover
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (!nextOpen) {
                    setKeyword('');
                }
            }}
        >
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'h-8 rounded-lg border px-2 text-xs font-medium text-left transition-colors flex items-center gap-1',
                        !value
                            ? 'border-border bg-muted/20 text-foreground hover:bg-muted/30'
                            : 'border-primary/30 bg-primary text-primary-foreground'
                    )}
                >
                    <span className="truncate flex-1">{selectedLabel || placeholder}</span>
                    <ChevronDown className="size-3 shrink-0" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-2">
                <Input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="h-8"
                />
                <div className="mt-2 max-h-56 overflow-auto space-y-1">
                    <button
                        type="button"
                        onClick={() => {
                            onValueChange('');
                            setOpen(false);
                        }}
                        className={cn(
                            'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent',
                            !value && 'bg-accent'
                        )}
                    >
                        <span className="truncate">{allLabel}</span>
                        {!value && <Check className="size-4 text-primary" />}
                    </button>
                    {filteredOptions.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                                onValueChange(option.value);
                                setOpen(false);
                            }}
                            className={cn(
                                'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent',
                                value === option.value && 'bg-accent'
                            )}
                        >
                            <span className="truncate">{option.label}</span>
                            {value === option.value && <Check className="size-4 text-primary" />}
                        </button>
                    ))}
                    {filteredOptions.length === 0 && (
                        <div className="px-2 py-2 text-xs text-muted-foreground">{emptyText}</div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

export function Toolbar() {
    const t = useTranslations('toolbar');
    const { activeItem } = useNavStore();
    const toolbarItem = isToolbarPage(activeItem) ? activeItem : null;
    const searchTerm = useSearchStore((s) => (toolbarItem ? s.searchTerms[toolbarItem] || '' : ''));
    const setSearchTerm = useSearchStore((s) => s.setSearchTerm);
    const layout = useToolbarViewOptionsStore((s) => (toolbarItem ? s.getLayout(toolbarItem) : 'grid'));
    const sortField = useToolbarViewOptionsStore((s) =>
        toolbarItem === 'channel' || toolbarItem === 'group' ? s.getSortField(toolbarItem) : 'name'
    );
    const sortOrder = useToolbarViewOptionsStore((s) => (toolbarItem ? s.getSortOrder(toolbarItem) : 'asc'));
    const setLayout = useToolbarViewOptionsStore((s) => s.setLayout);
    const setSortConfig = useToolbarViewOptionsStore((s) => s.setSortConfig);
    const setSortOrder = useToolbarViewOptionsStore((s) => s.setSortOrder);
    const channelFilter = useToolbarViewOptionsStore((s) => s.channelFilter);
    const groupFilter = useToolbarViewOptionsStore((s) => s.groupFilter);
    const modelFilter = useToolbarViewOptionsStore((s) => s.modelFilter);
    const setChannelFilter = useToolbarViewOptionsStore((s) => s.setChannelFilter);
    const setGroupFilter = useToolbarViewOptionsStore((s) => s.setGroupFilter);
    const setModelFilter = useToolbarViewOptionsStore((s) => s.setModelFilter);
    const logFilters = useToolbarViewOptionsStore((s) => s.logFilters);
    const logFilterOptions = useToolbarViewOptionsStore((s) => s.logFilterOptions);
    const setLogFilter = useToolbarViewOptionsStore((s) => s.setLogFilter);
    const [expandedSearchItem, setExpandedSearchItem] = useState<ToolbarPage | null>(null);
    const searchExpanded = expandedSearchItem === toolbarItem;

    if (!toolbarItem) return null;
    const isLogPage = toolbarItem === 'log';
    const showLayoutOptions = !isLogPage && toolbarItem !== 'group';
    const showCombinedSortOptions = toolbarItem === 'channel' || toolbarItem === 'group';

    const channelFilterLabelKeys: Record<ChannelFilter, string> = {
        all: 'popover.filter.channel.all',
        enabled: 'popover.filter.channel.enabled',
        disabled: 'popover.filter.channel.disabled',
    };
    const groupFilterLabelKeys: Record<GroupFilter, string> = {
        all: 'popover.filter.group.all',
        'with-members': 'popover.filter.group.withMembers',
        empty: 'popover.filter.group.empty',
    };
    const modelFilterLabelMap: Record<ModelFilter, string> = {
        all: 'popover.filter.model.all',
        priced: 'popover.filter.model.priced',
        free: 'popover.filter.model.free',
    };

    const filterOptions = toolbarItem === 'channel'
        ? CHANNEL_FILTER_OPTIONS.map((value) => ({
            value,
            label: t(channelFilterLabelKeys[value]),
        }))
        : toolbarItem === 'group'
            ? GROUP_FILTER_OPTIONS.map((value) => ({
                value,
                label: t(groupFilterLabelKeys[value]),
            }))
            : toolbarItem === 'model'
                ? MODEL_FILTER_OPTIONS.map((value) => ({
                    value,
                    label: t(modelFilterLabelMap[value]),
                }))
                : [];

    const activeFilter = toolbarItem === 'channel'
        ? channelFilter
        : toolbarItem === 'group'
            ? groupFilter
            : toolbarItem === 'model'
                ? modelFilter
                : '';

    const handleFilterChange = (value: string) => {
        switch (toolbarItem) {
            case 'channel':
                setChannelFilter(value as ChannelFilter);
                break;
            case 'group':
                setGroupFilter(value as GroupFilter);
                break;
            case 'model':
                setModelFilter(value as ModelFilter);
                break;
        }
    };

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key="toolbar"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2"
            >
                {/* 搜索按钮/展开框 */}
                <div className="relative h-9 w-9">
                    {!searchExpanded ? (
                        <motion.button
                            layoutId="search-box"
                            onClick={() => setExpandedSearchItem(toolbarItem)}
                            className={buttonVariants({ variant: "ghost", size: "icon", className: "absolute inset-0 rounded-xl transition-none hover:bg-transparent text-muted-foreground hover:text-foreground" })}
                        >
                            <motion.span layout="position"><Search className="size-4 transition-colors duration-300" /></motion.span>
                        </motion.button>
                    ) : (
                        <motion.div
                            layoutId="search-box"
                            className="absolute right-0 top-0 flex items-center gap-2 h-9 px-3 rounded-xl border"
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        >
                            <motion.span layout="position"><Search className="size-4 text-muted-foreground shrink-0" /></motion.span>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(toolbarItem, e.target.value)}
                                autoFocus
                                className="w-20 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                            />
                            <button
                                onClick={() => {
                                    setSearchTerm(toolbarItem, '');
                                    setExpandedSearchItem(null);
                                }}
                                className="p-0.5 rounded shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="size-3.5" />
                            </button>
                        </motion.div>
                    )}
                </div>

                <Popover>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            aria-label={t('popover.ariaLabel')}
                            className={buttonVariants({
                                variant: 'ghost',
                                size: 'icon',
                                className: 'rounded-xl transition-none hover:bg-transparent text-muted-foreground hover:text-foreground',
                            })}
                        >
                            <SlidersHorizontal className="size-4 transition-colors duration-300" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent
                        align="center"
                        side="bottom"
                        sideOffset={8}
                        className="w-64 rounded-2xl border border-border/60 bg-card p-3 shadow-xl"
                    >
                        <div className="grid gap-3">
                            {isLogPage ? (
                                <>
                                    <div className="grid gap-2">
                                        <p className="text-xs font-medium text-muted-foreground">{t('popover.filter.log.timeRange')}</p>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <button
                                                    type="button"
                                                    className={cn(
                                                        'h-8 rounded-lg border px-2 text-xs font-medium text-left transition-colors flex items-center gap-1',
                                                        (logFilters.startTime || logFilters.endTime)
                                                            ? 'border-primary/30 bg-primary text-primary-foreground'
                                                            : 'border-border bg-muted/20 text-foreground hover:bg-muted/30'
                                                    )}
                                                >
                                                    <span className="truncate flex-1">
                                                        {logFilters.startTime && logFilters.endTime
                                                            ? `${formatDate(new Date(Number(logFilters.startTime) * 1000))} - ${formatDate(new Date(Number(logFilters.endTime) * 1000))}`
                                                            : t('popover.filter.log.timeRangePlaceholder')}
                                                    </span>
                                                    <CalendarIcon className="size-3 shrink-0" />
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent align="start" className="w-auto p-0">
                                                <Calendar
                                                    mode="range"
                                                    selected={{
                                                        from: logFilters.startTime ? new Date(Number(logFilters.startTime) * 1000) : undefined,
                                                        to: logFilters.endTime ? new Date(Number(logFilters.endTime) * 1000) : undefined,
                                                    }}
                                                    onSelect={(range) => {
                                                        setLogFilter('startTime', range?.from ? String(Math.floor(range.from.getTime() / 1000)) : '');
                                                        setLogFilter('endTime', range?.to ? String(Math.floor(range.to.getTime() / 1000) + 86399) : '');
                                                    }}
                                                    numberOfMonths={1}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="grid gap-2">
                                        <p className="text-xs font-medium text-muted-foreground">{t('popover.filter.log.group')}</p>
                                        <SearchableFilterSelect
                                            value={logFilters.group}
                                            onValueChange={(v) => setLogFilter('group', v)}
                                            options={logFilterOptions.groups}
                                            allLabel={t('popover.filter.log.allGroups')}
                                            placeholder={t('popover.filter.log.group')}
                                            searchPlaceholder={t('popover.filter.log.searchPlaceholder')}
                                            emptyText={t('popover.filter.log.noResult')}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <p className="text-xs font-medium text-muted-foreground">{t('popover.filter.log.channel')}</p>
                                        <SearchableFilterSelect
                                            value={logFilters.channel}
                                            onValueChange={(v) => setLogFilter('channel', v)}
                                            options={logFilterOptions.channels}
                                            allLabel={t('popover.filter.log.allChannels')}
                                            placeholder={t('popover.filter.log.channel')}
                                            searchPlaceholder={t('popover.filter.log.searchPlaceholder')}
                                            emptyText={t('popover.filter.log.noResult')}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <p className="text-xs font-medium text-muted-foreground">{t('popover.filter.log.apikey')}</p>
                                        <SearchableFilterSelect
                                            value={logFilters.apikey}
                                            onValueChange={(v) => setLogFilter('apikey', v)}
                                            options={logFilterOptions.apikeys}
                                            allLabel={t('popover.filter.log.allApikeys')}
                                            placeholder={t('popover.filter.log.apikey')}
                                            searchPlaceholder={t('popover.filter.log.searchPlaceholder')}
                                            emptyText={t('popover.filter.log.noResult')}
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    {showLayoutOptions && (
                                        <div className="grid gap-2">
                                            <p className="text-xs font-medium text-muted-foreground">{t('popover.layout')}</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setLayout(toolbarItem, 'grid')}
                                                    className={cn(
                                                        'h-8 rounded-lg border text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors',
                                                        layout === 'grid'
                                                            ? 'border-primary/30 bg-primary text-primary-foreground'
                                                            : 'border-border bg-muted/20 text-foreground hover:bg-muted/30'
                                                    )}
                                                >
                                                    <LayoutGrid className="size-3.5" />
                                                    {t('popover.grid')}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setLayout(toolbarItem, 'list')}
                                                    className={cn(
                                                        'h-8 rounded-lg border text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors',
                                                        layout === 'list'
                                                            ? 'border-primary/30 bg-primary text-primary-foreground'
                                                            : 'border-border bg-muted/20 text-foreground hover:bg-muted/30'
                                                    )}
                                                >
                                                    <List className="size-3.5" />
                                                    {t('popover.list')}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid gap-2">
                                        <p className="text-xs font-medium text-muted-foreground">{t('popover.sort')}</p>
                                        {showCombinedSortOptions ? (
                                            <div className="grid grid-cols-2 gap-2">
                                                {COMBINED_SORT_OPTIONS.map((option) => (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => {
                                                            if (toolbarItem === 'channel' || toolbarItem === 'group') {
                                                                setSortConfig(toolbarItem, option.field, option.order);
                                                            }
                                                        }}
                                                        className={cn(
                                                            'h-8 rounded-lg border text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors',
                                                            sortField === option.field && sortOrder === option.order
                                                                ? 'border-primary/30 bg-primary text-primary-foreground'
                                                                : 'border-border bg-muted/20 text-foreground hover:bg-muted/30'
                                                        )}
                                                    >
                                                        {option.field === 'name' ? <ArrowUpAZ className="size-3.5" /> : <Clock3 className="size-3.5" />}
                                                        {t(option.labelKey)}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setSortOrder(toolbarItem, 'asc')}
                                                    className={cn(
                                                        'h-8 rounded-lg border text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors',
                                                        sortOrder === 'asc'
                                                            ? 'border-primary/30 bg-primary text-primary-foreground'
                                                            : 'border-border bg-muted/20 text-foreground hover:bg-muted/30'
                                                    )}
                                                >
                                                    <ArrowUpAZ className="size-3.5" />
                                                    {t('popover.nameAsc')}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setSortOrder(toolbarItem, 'desc')}
                                                    className={cn(
                                                        'h-8 rounded-lg border text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors',
                                                        sortOrder === 'desc'
                                                            ? 'border-primary/30 bg-primary text-primary-foreground'
                                                            : 'border-border bg-muted/20 text-foreground hover:bg-muted/30'
                                                    )}
                                                >
                                                    <ArrowUpAZ className="size-3.5" />
                                                    {t('popover.nameDesc')}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid gap-2">
                                        <p className="text-xs font-medium text-muted-foreground">{t('popover.filter.title')}</p>
                                        <div className="grid gap-2">
                                            {filterOptions.map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => handleFilterChange(option.value)}
                                                    className={cn(
                                                        'h-8 rounded-lg border px-2 text-xs font-medium text-left transition-colors',
                                                        activeFilter === option.value
                                                            ? 'border-primary/30 bg-primary text-primary-foreground'
                                                            : 'border-border bg-muted/20 text-foreground hover:bg-muted/30'
                                                    )}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </PopoverContent>
                </Popover>

                {/* 创建按钮 */}
                {toolbarItem !== 'log' && (
                    <MorphingDialog>
                        <MorphingDialogTrigger className={buttonVariants({ variant: "ghost", size: "icon", className: "rounded-xl transition-none hover:bg-transparent text-muted-foreground hover:text-foreground" })}>
                            <Plus className="size-4 transition-colors duration-300" />
                        </MorphingDialogTrigger>

                        <MorphingDialogContainer>
                            <MorphingDialogContent className="w-fit max-w-full bg-card text-card-foreground px-6 py-4 rounded-3xl custom-shadow max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
                                <CreateDialogContent activeItem={toolbarItem} />
                            </MorphingDialogContent>
                        </MorphingDialogContainer>
                    </MorphingDialog>
                )}
            </motion.div>
        </AnimatePresence>
    );
}

export { useSearchStore } from './search-store';
export { useToolbarViewOptionsStore } from './view-options-store';
