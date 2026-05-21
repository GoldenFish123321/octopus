import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ToolbarLayout = 'grid' | 'list';
export type ToolbarSortOrder = 'asc' | 'desc';
export type ToolbarSortField = 'name' | 'created';
export type ToolbarCreatedSortablePage = 'channel' | 'group';
export const TOOLBAR_PAGES = ['channel', 'group', 'model', 'log'] as const;
export type ToolbarPage = (typeof TOOLBAR_PAGES)[number];
export type ChannelFilter = 'all' | 'enabled' | 'disabled';
export type GroupFilter = 'all' | 'with-members' | 'empty';
export type ModelFilter = 'all' | 'priced' | 'free';

export type LogFilterOption = { value: string; label: string };
export interface LogFilters {
    search: string;
    group: string;
    channel: string;
    apikey: string;
    startTime: string;
    endTime: string;
}

interface ToolbarViewOptionsState {
    layouts: Partial<Record<ToolbarPage, ToolbarLayout>>;
    sortFields: Partial<Record<ToolbarCreatedSortablePage, ToolbarSortField>>;
    sortOrders: Partial<Record<ToolbarPage, ToolbarSortOrder>>;
    channelFilter: ChannelFilter;
    groupFilter: GroupFilter;
    modelFilter: ModelFilter;

    getLayout: (item: ToolbarPage) => ToolbarLayout;
    setLayout: (item: ToolbarPage, value: ToolbarLayout) => void;

    getSortField: (item: ToolbarCreatedSortablePage) => ToolbarSortField;
    setSortConfig: (
        item: ToolbarCreatedSortablePage,
        field: ToolbarSortField,
        order: ToolbarSortOrder
    ) => void;

    getSortOrder: (item: ToolbarPage) => ToolbarSortOrder;
    setSortOrder: (item: ToolbarPage, value: ToolbarSortOrder) => void;

    setChannelFilter: (value: ChannelFilter) => void;
    setGroupFilter: (value: GroupFilter) => void;
    setModelFilter: (value: ModelFilter) => void;

    logFilters: LogFilters;
    logFilterOptions: {
        groups: LogFilterOption[];
        channels: LogFilterOption[];
        apikeys: LogFilterOption[];
    };
    setLogFilter: (key: keyof LogFilters, value: string) => void;
    setLogFilterOptions: (options: Partial<{ groups: LogFilterOption[]; channels: LogFilterOption[]; apikeys: LogFilterOption[] }>) => void;
}

export const useToolbarViewOptionsStore = create<ToolbarViewOptionsState>()(
    persist(
        (set, get) => ({
            layouts: {},
            sortFields: {},
            sortOrders: {},
            channelFilter: 'all',
            groupFilter: 'all',
            modelFilter: 'all',

            getLayout: (item) => get().layouts[item] || 'grid',
            setLayout: (item, value) => {
                set((state) => ({ layouts: { ...state.layouts, [item]: value } }));
            },

            getSortField: (item) => get().sortFields[item] || 'name',
            setSortConfig: (item, field, order) => {
                set((state) => ({
                    sortFields: { ...state.sortFields, [item]: field },
                    sortOrders: { ...state.sortOrders, [item]: order },
                }));
            },

            getSortOrder: (item) => (get().sortOrders[item] === 'desc' ? 'desc' : 'asc'),
            setSortOrder: (item, value) => {
                set((state) => ({ sortOrders: { ...state.sortOrders, [item]: value } }));
            },

            setChannelFilter: (value) => set({ channelFilter: value }),
            setGroupFilter: (value) => set({ groupFilter: value }),
            setModelFilter: (value) => set({ modelFilter: value }),

            logFilters: { search: '', group: '', channel: '', apikey: '', startTime: '', endTime: '' },
            logFilterOptions: { groups: [], channels: [], apikeys: [] },
            setLogFilter: (key, value) =>
                set((state) => ({ logFilters: { ...state.logFilters, [key]: value } })),
            setLogFilterOptions: (options) =>
                set((state) => ({ logFilterOptions: { ...state.logFilterOptions, ...options } })),
        }),
        {
            name: 'toolbar-view-options-storage',
            partialize: (state) => ({
                layouts: state.layouts,
                sortFields: state.sortFields,
                sortOrders: state.sortOrders,
                channelFilter: state.channelFilter,
                groupFilter: state.groupFilter,
                modelFilter: state.modelFilter,
                logFilters: state.logFilters,
            }),
        }
    )
);
