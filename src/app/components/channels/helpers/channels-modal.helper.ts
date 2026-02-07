import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ChannelService } from '../../../services/channel.service';

/**
 * Helper service for managing channel creation modal state and operations.
 * Handles modal visibility, form data, and channel creation workflow.
 */
@Injectable()
export class ChannelsModalHelper {
  /** Modal visibility state */
  createChannelOpen = false;

  /** New channel name input */
  newChannelName = '';

  /** New channel description/topic input */
  newChannelDescription = '';

  /** Channel name validation error */
  channelNameError = '';

  constructor(
    private chanSvc: ChannelService,
    private router: Router
  ) { }

  /**
   * Opens the channel creation modal and resets form fields.
   */
  openCreateChannelModal(): void {
    this.createChannelOpen = true;
    this.newChannelName = '';
    this.newChannelDescription = '';
    this.channelNameError = '';
  }

  /**
   * Closes the channel creation modal.
   */
  closeCreateChannelModal(): void {
    this.createChannelOpen = false;
    this.channelNameError = '';
  }

  /**
   * Submits the channel creation form.
   * Creates a new channel, adds the current user as owner, and navigates to it.
   * @returns Promise that resolves when the channel is created
   */
  async submitCreateChannel(): Promise<void> {
    const raw = (this.newChannelName || '').trim();
    if (!raw) return;

    this.channelNameError = '';
    const duplicate = await this.chanSvc.isChannelNameTaken(raw);
    if (duplicate) {
      this.channelNameError = 'Channel-Name existiert bereits.';
      return;
    }

    const topic = (this.newChannelDescription || '').trim();
    await this.createAndNavigateToChannel(raw, topic);
  }

  /**
   * Creates a new channel and navigates to it after adding the user as owner.
   * @param name - Channel name
   * @param topic - Channel description/topic
   */
  private async createAndNavigateToChannel(name: string, topic: string): Promise<void> {
    try {
      const channelId = await this.chanSvc.createChannel(name, topic);
      await this.chanSvc.addMeAsMember(channelId, 'owner');
      this.resetChannelForm();
      this.router.navigate(['/channel', channelId]);
    } catch (e) {
      console.error('[ChannelModal] create failed:', e);
    }
  }

  /**
   * Resets the channel creation form fields and closes the modal.
   */
  private resetChannelForm(): void {
    this.newChannelName = '';
    this.newChannelDescription = '';
    this.channelNameError = '';
    this.closeCreateChannelModal();
  }
}
