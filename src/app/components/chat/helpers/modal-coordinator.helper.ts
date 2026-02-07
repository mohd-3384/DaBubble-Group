import { Injectable, inject } from '@angular/core';
import { ChatStateHelper } from './chat-state.helper';
import { Observable } from 'rxjs';
import { ChannelDoc } from '../../../interfaces/allInterfaces.interface';
import { ChannelModalHelper } from './channel-modal.helper';
import { ChannelService } from '../../../services/channel.service';
import { MembersModalHelper } from './members-modal.helper';
import { ModalPositionHelper } from './modal-position.helper';
import { UserProfileHelper } from './user-profile.helper';
import { ChatRefsHelper } from './chat-refs.helper';

/**
 * Helper for coordinating all modal operations
 */
@Injectable()
export class ModalCoordinatorHelper {
  private state = inject(ChatStateHelper);
  private channelModal = inject(ChannelModalHelper);
  private membersModal = inject(MembersModalHelper);
  private modalPos = inject(ModalPositionHelper);
  private userProfileHelper = inject(UserProfileHelper);
  private chanSvc = inject(ChannelService);
  private refs = inject(ChatRefsHelper);

  /**
   * Opens the channel info modal
   * @param channelDoc$ - Channel document observable
   */
  async openChannelInfoModal(channelDoc$: Observable<ChannelDoc | null>): Promise<void> {
    this.state.channelNameEdit = false;
    this.state.channelDescEdit = false;
    const data = await this.channelModal.openChannelInfo(channelDoc$);
    this.state.editChannelName = data.editChannelName;
    this.state.editChannelDesc = data.editChannelDesc;
    this.state.channelTopic = data.channelTopic;
    this.state.channelInfoOpen = true;
  }

  /**
   * Closes the channel info modal
   */
  closeChannelInfoModal(): void {
    this.state.channelInfoOpen = false;
    this.state.channelNameEdit = false;
    this.state.channelDescEdit = false;
  }

  /**
   * Toggles channel name edit mode
   * @param channelDoc$ - Channel document observable
   */
  async toggleChannelNameEdit(channelDoc$: Observable<ChannelDoc | null>): Promise<void> {
    const result = await this.channelModal.toggleChannelNameEdit(
      this.state.channelNameEdit,
      this.state.editChannelName,
      channelDoc$
    );
    if (result) {
      this.state.channelNameEdit = result.channelNameEdit;
      this.state.editChannelName = result.editChannelName;
    } else {
      this.state.channelNameEdit = false;
    }
  }

  /**
   * Toggles channel description edit mode
   * @param channelDoc$ - Channel document observable
   */
  async toggleChannelDescEdit(channelDoc$: Observable<ChannelDoc | null>): Promise<void> {
    const result = await this.channelModal.toggleChannelDescEdit(
      this.state.channelDescEdit,
      this.state.editChannelDesc,
      channelDoc$
    );
    if (result) {
      this.state.channelDescEdit = result.channelDescEdit;
      this.state.editChannelDesc = result.editChannelDesc;
    } else {
      this.state.channelDescEdit = false;
    }
  }

  /**
   * Handles leaving the current channel
   */
  async onLeaveChannel(): Promise<void> {
    try {
      const channelId = window.location.pathname.split('/').pop();
      if (channelId) {
        await this.chanSvc.leaveChannel(channelId);
        this.closeChannelInfoModal();
      }
    } catch (e) {
      console.error('Channel verlassen fehlgeschlagen:', e);
    }
  }

  /**
   * Opens the members modal
   * @param event - Optional mouse event
   */
  openMembersModal(event?: MouseEvent): void {
    event?.stopPropagation();
    this.state.membersModalOpen = true;
    const el = this.refs.membersBtn?.nativeElement;
    if (el) this.state.membersModalPos = this.modalPos.positionModalFrom(el, 'members');
  }

  /**
   * Closes the members modal
   */
  closeMembersModal(): void {
    this.state.membersModalOpen = false;
  }

  /**
   * Opens the add members modal
   */
  openAddMembersModal(): void {
    this.state.membersModalOpen = false;
    this.state.addMembersOpen = true;
    const el = this.refs.addMembersBtn?.nativeElement;
    if (el) this.state.addMembersModalPos = this.modalPos.positionModalFrom(el, 'add');
  }

  /**
   * Closes the add members modal
   */
  closeAddMembersModal(): void {
    this.state.addMembersOpen = false;
    const result = this.membersModal.resetAddMemberState(this.state.getAddMemberInput$());
    this.state.addMemberInput = result.addMemberInput;
    this.state.addMemberSelected = result.addMemberSelected;
  }

  /**
   * Submits the add member operation
   * @returns Promise that resolves to success status
   */
  async submitAddMember(): Promise<boolean> {
    return await this.membersModal.submitAddMember(this.state.addMemberSelected);
  }

  /**
   * Handles input in add member field
   * @param value - Input value
   */
  onAddMemberInput(value: string): void {
    const result = this.membersModal.onAddMemberInput(value, this.state.getAddMemberInput$());
    this.state.addMemberInput = result.addMemberInput;
    this.state.showAddMemberSuggest = result.showAddMemberSuggest;
    this.state.addMemberSelected = result.addMemberSelected;
  }

  /**
   * Selects a member from add member suggestions
   * @param u - User to add
   */
  selectAddMember(u: any): void {
    const result = this.membersModal.selectAddMember(u, this.state.getAddMemberInput$());
    this.state.addMemberSelected = result.addMemberSelected;
    this.state.addMemberInput = result.addMemberInput;
    this.state.showAddMemberSuggest = result.showAddMemberSuggest;
  }

  /**
   * Opens user profile modal
   * @param userIdFromList - Optional user ID
   */
  async openUserProfileModal(userIdFromList?: string): Promise<void> {
    const profile = await this.userProfileHelper.openUserProfile(userIdFromList);
    if (profile) {
      this.state.userProfile = profile;
      this.state.userProfileOpen = true;
    }
  }

  /**
   * Closes user profile modal
   */
  closeUserProfileModal(): void {
    this.state.userProfileOpen = false;
  }
}
