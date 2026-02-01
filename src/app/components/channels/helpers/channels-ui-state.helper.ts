import { Injectable, signal, WritableSignal, EventEmitter } from '@angular/core';

/**
 * Helper service for managing UI state in the channels component.
 * Handles sidebar collapse states and workspace visibility.
 */
@Injectable()
export class ChannelsUiStateHelper {
  /** Workspace sidebar collapse state */
  workspaceCollapsed: WritableSignal<boolean> = signal(false);

  /** Channels section collapse state */
  collapsedChannels: WritableSignal<boolean> = signal(false);

  /** Direct messages section collapse state */
  collapsedDMs: WritableSignal<boolean> = signal(false);

  /** Event emitter for workspace collapse state changes */
  workspaceCollapsedChange = new EventEmitter<boolean>();

  /**
   * Toggles the workspace sidebar collapse state.
   * Emits the new collapsed state to parent components.
   */
  toggleWorkspace(): void {
    this.workspaceCollapsed.update((v) => {
      const next = !v;
      this.workspaceCollapsedChange.emit(next);
      return next;
    });
  }

  /**
   * Toggles the collapsed state of the channels section.
   */
  toggleChannels(): void {
    this.collapsedChannels.update(v => !v);
  }

  /**
   * Toggles the collapsed state of the direct messages section.
   */
  toggleDMs(): void {
    this.collapsedDMs.update(v => !v);
  }
}
