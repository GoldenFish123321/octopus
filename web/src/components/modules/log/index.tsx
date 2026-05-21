'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useLogs, type LogFilters } from '@/api/endpoints/log';
import { useGroupList } from '@/api/endpoints/group';
import { useChannelList } from '@/api/endpoints/channel';
import { useAPIKeyList } from '@/api/endpoints/apikey';
import { LogCard } from './Item';
import { VirtualizedGrid } from '@/components/common/VirtualizedGrid';
import { useSearchStore, useToolbarViewOptionsStore } from '@/components/modules/toolbar';

/**
 * 日志页面组件
 * - 初始加载 pageSize 条历史日志
 * - SSE 实时推送新日志
 * - 滚动自动加载更多
 * - 服务端筛选（搜索/时间/分组/渠道/apikey）
 */
export function Log() {
    const t = useTranslations('log');

    const searchTerm = useSearchStore((s) => s.getSearchTerm('log'));
    const logFilters = useToolbarViewOptionsStore((s) => s.logFilters);
    const setLogFilterOptions = useToolbarViewOptionsStore((s) => s.setLogFilterOptions);

    const filters = useMemo<Partial<LogFilters>>(() => ({
        search: searchTerm || undefined,
        group: logFilters.group || undefined,
        channel: logFilters.channel || undefined,
        apikey: logFilters.apikey || undefined,
        startTime: logFilters.startTime || undefined,
        endTime: logFilters.endTime || undefined,
    }), [searchTerm, logFilters.group, logFilters.channel, logFilters.apikey, logFilters.startTime, logFilters.endTime]);

    const { logs, hasMore, isLoading, isLoadingMore, loadMore } = useLogs({
        pageSize: 10,
        filters,
    });

    const { data: groups = [] } = useGroupList();
    const { data: channels = [] } = useChannelList();
    const { data: apikeys = [] } = useAPIKeyList();

    const groupOptions = useMemo(() => {
        const names = groups
            .map((group) => group.name?.trim())
            .filter((name): name is string => !!name);
        if (logFilters.group) {
            names.push(logFilters.group);
        }
        return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
    }, [groups, logFilters.group]);

    const channelOptions = useMemo(() => {
        const names = channels
            .map((channel) => channel.raw.name?.trim())
            .filter((name): name is string => !!name);
        if (logFilters.channel) {
            names.push(logFilters.channel);
        }
        return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
    }, [channels, logFilters.channel]);

    const apikeyOptions = useMemo(() => {
        const names = apikeys
            .map((key) => key.name?.trim())
            .filter((name): name is string => !!name);
        if (logFilters.apikey) {
            names.push(logFilters.apikey);
        }
        return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
    }, [apikeys, logFilters.apikey]);

    useEffect(() => {
        setLogFilterOptions({
            groups: groupOptions.map((v) => ({ value: v, label: v })),
            channels: channelOptions.map((v) => ({ value: v, label: v })),
            apikeys: apikeyOptions.map((v) => ({ value: v, label: v })),
        });
    }, [groupOptions, channelOptions, apikeyOptions, setLogFilterOptions]);

    const canLoadMore = hasMore && !isLoading && !isLoadingMore && logs.length > 0;
    const handleReachEnd = useCallback(() => {
        if (!canLoadMore) return;
        void loadMore();
    }, [canLoadMore, loadMore]);

    const footer = useMemo(() => {
        if (hasMore && (isLoading || isLoadingMore)) {
            return (
                <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            );
        }
        if (!hasMore && logs.length > 0) {
            return (
                <div className="flex justify-center py-4">
                    <span className="text-sm text-muted-foreground">{t('list.noMore')}</span>
                </div>
            );
        }
        return null;
    }, [hasMore, isLoading, isLoadingMore, logs.length, t]);

    return (
        <div className="flex flex-1 flex-col gap-4 h-full min-h-0">
            <VirtualizedGrid
                items={logs}
                layout="list"
                columns={{ default: 1 }}
                estimateItemHeight={80}
                overscan={8}
                getItemKey={(log) => `log-${log.id}`}
                renderItem={(log) => <LogCard log={log} />}
                footer={footer}
                onReachEnd={handleReachEnd}
                reachEndEnabled={canLoadMore}
                reachEndOffset={2}
            />
        </div>
    );
}
