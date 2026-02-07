import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { MessageVm, DayGroup } from '../../../interfaces/allInterfaces.interface';
import { sameYMD, dayLabel } from './date.utils';

/**
 * Service for grouping messages by day
 */
@Injectable()
export class MessageGroupHelper {
    /**
     * Groups messages by day
     * @param messages$ - Observable of messages
     * @returns Observable of day groups
     */
    getGroups$(messages$: Observable<MessageVm[]>): Observable<DayGroup[]> {
        return messages$.pipe(
            map((msgs) => this.groupByDay(msgs))
        );
    }

    /**
     * Groups messages into day buckets
     * @param msgs - Array of messages
     * @returns Array of day groups
     */
    private groupByDay(msgs: MessageVm[]): DayGroup[] {
        const today = new Date();
        const buckets = this.createBuckets(msgs);

        return this.sortAndMapBuckets(buckets, today);
    }

    /**
     * Creates day buckets from messages
     * @param msgs - Array of messages
     * @returns Map of date keys to messages
     */
    private createBuckets(msgs: MessageVm[]): Map<string, MessageVm[]> {
        const buckets = new Map<string, MessageVm[]>();

        for (const m of msgs) {
            const d = m.createdAt;
            if (!d) continue;

            const key = this.createDateKey(d);

            if (!buckets.has(key)) buckets.set(key, []);
            buckets.get(key)!.push(m);
        }

        return buckets;
    }

    /**
     * Creates a date key string (YYYY-MM-DD)
     * @param d - Date
     * @returns Date key string
     */
    private createDateKey(d: Date): string {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    /**
     * Sorts buckets and maps to day groups
     * @param buckets - Map of date keys to messages
     * @param today - Today's date
     * @returns Array of day groups
     */
    private sortAndMapBuckets(
        buckets: Map<string, MessageVm[]>,
        today: Date
    ): DayGroup[] {
        return [...buckets.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, items]) => this.createDayGroup(key, items, today));
    }

    /**
     * Creates a day group from bucket data
     * @param key - Date key
     * @param items - Messages in this day
     * @param today - Today's date
     * @returns Day group object
     */
    private createDayGroup(key: string, items: MessageVm[], today: Date): DayGroup {
        this.sortMessagesByTime(items);

        const date = this.parseDateKey(key);
        const isToday = sameYMD(date, today);

        return {
            label: isToday ? 'Heute' : dayLabel(date),
            isToday,
            items,
        } as DayGroup;
    }

    /**
     * Sorts messages by creation time
     * @param items - Messages to sort
     */
    private sortMessagesByTime(items: MessageVm[]): void {
        items.sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime());
    }

    /**
     * Parses date key string to Date object
     * @param key - Date key (YYYY-MM-DD)
     * @returns Date object
     */
    private parseDateKey(key: string): Date {
        const [y, mo, da] = key.split('-').map(Number);
        return new Date(y, mo - 1, da);
    }
}
