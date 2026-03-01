import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ChannelService } from '../../../services/channel.service';
import { UserDoc } from '../../../interfaces/allInterfaces.interface';

/**
 * Helper service for managing channel creation modal state and operations.
 * Handles modal visibility, form data, and channel creation workflow.
 */
@Injectable()
export class ChannelsModalHelper {
  /** Modal visibility state */
  createChannelOpen = false;

  /** Add members modal visibility */
  addMembersOpen = false;

  /** Add members mode: all or selected */
  addMembersMode: 'all' | 'selected' = 'all';

  /** Add member input value */
  addMemberInput = '';

  /** Show suggestions dropdown */
  showAddMemberSuggest = false;

  /** Selected members for channel creation */
  selectedMembers: UserDoc[] = [];

  /** Pending channel name/description */
  pendingChannelName = '';
  pendingChannelDescription = '';

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
    this.pendingChannelName = '';
    this.pendingChannelDescription = '';
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
    this.pendingChannelName = raw;
    this.pendingChannelDescription = topic;
    this.openAddMembersModal();
  }

  /**
   * Opens the add members modal and resets selection state.
   */
  openAddMembersModal(): void {
    this.createChannelOpen = false;
    this.addMembersOpen = true;
    this.addMembersMode = 'all';
    this.addMemberInput = '';
    this.showAddMemberSuggest = false;
    this.selectedMembers = [];
  }

  /**
   * Closes the add members modal and returns to the create modal.
   */
  closeAddMembersModal(): void {
    this.addMembersOpen = false;
    this.showAddMemberSuggest = false;
    this.addMemberInput = '';
    this.createChannelOpen = true;
  }

  /**
   * Handles add member input change.
   */
  onAddMemberInput(value: string): void {
    this.addMemberInput = value;
    this.showAddMemberSuggest = !!value.trim();
  }

  /**
   * Selects a member for channel creation.
   */
  selectAddMember(user: UserDoc): void {
    if (this.selectedMembers.some((m) => m.id === user.id)) return;
    this.selectedMembers = [...this.selectedMembers, user];
    this.addMemberInput = '';
    this.showAddMemberSuggest = false;
  }

  /**
   * Removes a selected member.
   */
  removeSelectedMember(userId: string | undefined): void {
    if (!userId) return;
    this.selectedMembers = this.selectedMembers.filter((m) => m.id !== userId);
  }

  /**
   * Filters users for add member suggestions.
   */
  getAddMemberSuggestions(users: UserDoc[], meId: string | null): UserDoc[] {
    const q = (this.addMemberInput || '').trim().toLowerCase();
    if (!q) return [];
    const selectedIds = new Set(this.selectedMembers.map((m) => m.id));
    return users
      .filter((u) => !!u.id)
      .filter((u) => u.id !== meId)
      .filter((u) => !selectedIds.has(u.id))
      .filter((u) => String(u.name || '').toLowerCase().includes(q))
      .slice(0, 8);
  }

  /**
   * Finalizes channel creation after member selection.
   */
  async submitCreateChannelFinal(users: UserDoc[], meId: string | null): Promise<void> {
    const name = (this.pendingChannelName || '').trim();
    if (!name) return;

    try {
      const channelId = await this.chanSvc.createChannel(name, this.pendingChannelDescription);
      await this.chanSvc.addMeAsMember(channelId, 'owner');

      const candidates = this.addMembersMode === 'all' ? users : this.selectedMembers;
      const filtered = candidates.filter((u) => !!u.id && u.id !== meId);
      await this.chanSvc.addMembers(channelId, filtered);

      this.resetChannelForm();
      this.addMembersOpen = false;
      this.router.navigate(['/channel', channelId]);
    } catch (e) {
      console.error('[ChannelModal] create failed:', e);
    }
  }

  /**
   * Creates a new channel and navigates to it after adding the user as owner.
   * @param name - Channel name
   * @param topic - Channel description/topic
   */
  /**
   * Resets the channel creation form fields and closes the modal.
   */
  private resetChannelForm(): void {
    this.newChannelName = '';
    this.newChannelDescription = '';
    this.channelNameError = '';
    this.pendingChannelName = '';
    this.pendingChannelDescription = '';
    this.createChannelOpen = false;
    this.addMembersOpen = false;
  }
}
