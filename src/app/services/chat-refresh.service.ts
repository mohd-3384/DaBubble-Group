import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ChatRefreshService {
    refreshTrigger$ = new BehaviorSubject<number>(0);

    refresh() {
        console.log('[ChatRefreshService] Triggering refresh');
        this.refreshTrigger$.next(this.refreshTrigger$.value + 1);
    }

    refreshReactions() {
        console.log('[ChatRefreshService] Refreshing reactions');
        this.refresh();
    }
}
