import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Service for triggering UI refresh of chat messages and reactions
 */
@Injectable({ providedIn: 'root' })
export class ChatRefreshService {
  /**
   * Observable trigger for general chat refresh
   */
  refreshTrigger$ = new BehaviorSubject<number>(0);

  /**
   * Triggers a general chat refresh by incrementing the trigger counter
   */
  refresh() {
    this.refreshTrigger$.next(this.refreshTrigger$.value + 1);
  }

  /**
   * Triggers a reactions-specific refresh
   */
  refreshReactions() {
    this.refresh();
  }
}
