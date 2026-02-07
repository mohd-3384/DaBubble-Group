import { Component, inject, Output, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { Router } from '@angular/router';
import { Observable, take } from 'rxjs';
import { UserService } from '../../services/user.service';
import { ChannelService } from '../../services/channel.service';
import { FormsModule } from '@angular/forms';
import { ChannelDoc, UserDoc, WsSearchResult } from '../../interfaces/allInterfaces.interface';
import { Auth, authState } from '@angular/fire/auth';
import { ThreadService } from '../../services/thread.service';
import { NavigationStart } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ChannelsModalHelper } from './helpers/channels-modal.helper';
import { ChannelsSearchHelper } from './helpers/channels-search.helper';
import { ChannelsUiStateHelper } from './helpers/channels-ui-state.helper';

@Component({
  selector: 'app-channels',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatTooltipModule,
    ScrollingModule,
    FormsModule
  ],
  providers: [
    ChannelsModalHelper,
    ChannelsSearchHelper,
    ChannelsUiStateHelper
  ],
  templateUrl: './channels.component.html',
  styleUrl: './channels.component.scss',
})
export class ChannelsComponent {
  private thread = inject(ThreadService);
  private usersSvc = inject(UserService);
  private chanSvc = inject(ChannelService);
  private auth = inject(Auth);
  private router = inject(Router);

  private modalHelper = inject(ChannelsModalHelper);
  private searchHelper = inject(ChannelsSearchHelper);
  private uiStateHelper = inject(ChannelsUiStateHelper);

  users$!: Observable<UserDoc[]>;
  channels$!: Observable<ChannelDoc[]>;
  meId: string | null = null;

  @ViewChild('wsSearchInput', { static: false })
  set wsSearchInput(el: ElementRef<HTMLInputElement> | undefined) {
    this.searchHelper.wsSearchInput = el;
  }

  // Delegierte Properties für Modal
  get createChannelOpen() { return this.modalHelper.createChannelOpen; }
  set createChannelOpen(v: boolean) { this.modalHelper.createChannelOpen = v; }
  get newChannelName() { return this.modalHelper.newChannelName; }
  set newChannelName(v: string) { this.modalHelper.newChannelName = v; }
  get newChannelDescription() { return this.modalHelper.newChannelDescription; }
  set newChannelDescription(v: string) { this.modalHelper.newChannelDescription = v; }
  get channelNameError() { return this.modalHelper.channelNameError; }

  // Delegierte Properties für Search
  get wsSearchTerm() { return this.searchHelper.wsSearchTerm; }
  set wsSearchTerm(v: string) { this.searchHelper.wsSearchTerm = v; }
  get wsSearchOpen() { return this.searchHelper.wsSearchOpen; }
  get wsActiveIndex() { return this.searchHelper.wsActiveIndex; }
  get wsResults$() { return this.searchHelper.wsResults$; }

  // Delegierte Properties für UI State
  get workspaceCollapsed() { return this.uiStateHelper.workspaceCollapsed; }
  get collapsedChannels() { return this.uiStateHelper.collapsedChannels; }
  get collapsedDMs() { return this.uiStateHelper.collapsedDMs; }

  @Output() workspaceCollapsedChange = this.uiStateHelper.workspaceCollapsedChange;

  /**
   * Toggles the workspace sidebar collapse state.
   * Emits the new collapsed state to parent components.
   */
  toggleWorkspace() {
    this.uiStateHelper.toggleWorkspace();
  }

  /**
   * Initializes the channels component.
   * Sets up observables for users and channels, retrieves the current user ID,
   * and subscribes to router events to close threads on navigation.
   */
  constructor() {
    this.users$ = this.usersSvc.users$();
    this.channels$ = this.chanSvc.channels$();
    authState(this.auth).pipe(take(1)).subscribe(u => this.meId = u?.uid ?? null);
    this.router.events
      .pipe(filter((e): e is NavigationStart => e instanceof NavigationStart))
      .subscribe(() => this.thread.close());
  }

  /**
   * Opens the channel creation modal and resets form fields.
   */
  openCreateChannelModal() {
    this.modalHelper.openCreateChannelModal();
  }

  /**
   * Closes the channel creation modal.
   */
  closeCreateChannelModal() {
    this.modalHelper.closeCreateChannelModal();
  }

  /**
   * Submits the channel creation form.
   * Creates a new channel, adds the current user as owner, and navigates to it.
   * @returns Promise that resolves when the channel is created
   */
  async submitCreateChannel() {
    await this.modalHelper.submitCreateChannel();
  }

  /**
   * TrackBy function for user lists to optimize performance.
   * @param _ - Index (unused)
   * @param u - User document
   * @returns User ID
   */
  trackByUid = (_: number, u: UserDoc) => u.id;

  /**
   * TrackBy function for channel lists to optimize performance.
   * @param _ - Index (unused)
   * @param c - Channel document
   * @returns Channel ID
   */
  trackByCid = (_: number, c: ChannelDoc) => c.id;

  /**
   * Toggles the collapsed state of the channels section.
   */
  toggleChannels() {
    this.uiStateHelper.toggleChannels();
  }

  /**
   * Toggles the collapsed state of the direct messages section.
   */
  toggleDMs() {
    this.uiStateHelper.toggleDMs();
  }

  /**
   * Navigates to the new message page.
   */
  startNewMessage() {
    this.router.navigate(['/new']);
  }

  /**
   * Updates the workspace search term and opens the search results.
   * @param v - The search term string
   */
  setWsSearch(v: string) {
    this.searchHelper.setWsSearch(v);
  }

  /**
   * Opens the workspace search dropdown if there is a search term.
   */
  openWsSearch() {
    this.searchHelper.openWsSearch();
  }

  /**
   * Clears the workspace search and resets the search state.
   * Refocuses the search input field.
   */
  clearWsSearch() {
    this.searchHelper.clearWsSearch();
  }

  /**
   * Closes the workspace search dropdown.
   */
  closeWsSearch() {
    this.searchHelper.closeWsSearch();
  }

  /**
   * Handles selection of a workspace search result.
   * Navigates to the appropriate route based on result type and clears the search.
   * @param r - The selected search result
   */
  onSelectWsResult(r: WsSearchResult) {
    this.searchHelper.onSelectWsResult(r);
  }

  /**
   * Handles keyboard navigation in the workspace search results.
   * Supports arrow keys for navigation, Enter to select, and Escape to close.
   * @param ev - The keyboard event
   */
  onWsSearchKeydown(ev: KeyboardEvent) {
    this.searchHelper.onWsSearchKeydown(ev);
  }

  /**
   * Closes the workspace search when clicking anywhere in the document.
   * Listener for global document clicks.
   */
  @HostListener('document:click')
  onDocClick() {
    this.searchHelper.closeWsSearch();
  }
}
