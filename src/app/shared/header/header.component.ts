import { ViewChild, Component, ElementRef, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationStart, NavigationEnd, ActivatedRoute } from '@angular/router';
import { Firestore } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, BehaviorSubject, combineLatest, of } from 'rxjs';
import { map, switchMap, startWith, distinctUntilChanged, debounceTime } from 'rxjs/operators';
import { catchError, shareReplay } from 'rxjs/operators';
import { HeaderUser, ProfileView, SearchResult } from '../../interfaces/allInterfaces.interface';
import { HeaderSearchService } from '../../services/header-search.service';
import { HeaderProfileHelper } from './helpers/header-profile.helper';
import { HeaderSearchHelper } from './helpers/header-search.helper';
import { HeaderUserHelper } from './helpers/header-user.helper';
import { HeaderNavigationHelper } from './helpers/header-navigation.helper';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  private fs = inject(Firestore);
  private auth = inject(Auth);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private host = inject(ElementRef<HTMLElement>);
  private searchService = inject(HeaderSearchService);
  private profileHelper = inject(HeaderProfileHelper);
  private searchHelper = inject(HeaderSearchHelper);
  private userHelper = inject(HeaderUserHelper);
  private navHelper = inject(HeaderNavigationHelper);

  @ViewChild('searchInput', { static: false })
  searchInput?: ElementRef<HTMLInputElement>;

  /** ---------- MOBILE CHAT OPEN STATE ---------- */
  isChatOpen = false;
  isNewMessageRoute = false;
  private currentChannelId: string | null = null;

  isDesktop = window.innerWidth >= 1025;
  @HostListener('window:resize')
  onResize() {
    this.isDesktop = window.innerWidth >= 1025;
  }

  /** ---------- USER (Firestore users/{uid}) ---------- */
  user$: Observable<HeaderUser> = this.userHelper.getUserStream();

  /**
   * Initializes the header component.
   * Subscribes to router events to track chat state and channel navigation.
   */
  constructor() {
    this.router.events
      .pipe()
      .subscribe((event) => {
        this.handleRouterEvent(event);
      });
  }

  /**
   * Handles router navigation events to update chat state
   * @param event - Router event (NavigationStart or NavigationEnd)
   */
  private handleRouterEvent(event: any) {
    if (event instanceof NavigationStart || event instanceof NavigationEnd) {
      const url = this.navHelper.getEventUrl(event);
      this.updateChatState(url);
    }
  }

  /**
   * Updates component state based on current URL
   * @param url - The current route URL
   */
  private updateChatState(url: string) {
    this.isChatOpen = this.navHelper.isChatRoute(url);
    this.isNewMessageRoute = this.navHelper.isNewMessageRoute(url);
    this.currentChannelId = this.navHelper.extractChannelId(url);
  }

  /**
   * Navigates back based on current route context.
   * Handles thread, new message, and chat routes differently.
   */
  goBack() {
    this.navHelper.navigateBack(this.router.url);
  }

  /** ---------- PROFILE ---------- */
  profileOpen = false;
  profileModalOpen = false;
  profileView: ProfileView = 'view';
  editName = '';
  selectedAvatar = '';

  availableAvatars = [
    '/public/images/avatars/avatar1.svg',
    '/public/images/avatars/avatar2.svg',
    '/public/images/avatars/avatar3.svg',
    '/public/images/avatars/avatar4.svg',
    '/public/images/avatars/avatar5.svg',
    '/public/images/avatars/avatar6.svg',
  ];

  /**
   * Toggles the profile dropdown menu.
   * Closes the profile modal and search when opening.
   */
  toggleProfile() {
    this.profileOpen = !this.profileOpen;
    if (this.profileOpen) {
      this.profileModalOpen = false;
      this.closeSearch();
    }
  }

  /**
   * Opens the full profile modal in view mode.
   * Closes the profile dropdown and search.
   */
  openProfileModal() {
    this.profileOpen = false;
    this.profileModalOpen = true;
    this.profileView = 'view';
    this.closeSearch();
  }

  /**
   * Closes the profile modal and resets to view mode.
   */
  closeProfileModal() {
    this.profileModalOpen = false;
    this.profileView = 'view';
  }

  /**
   * Switches the profile modal to edit mode.
   * @param user - The current user data to pre-fill the form
   */
  openEditProfile(user: HeaderUser) {
    this.profileView = 'edit';
    this.editName = user.name ?? '';
  }

  /**
   * Returns to profile view mode from edit mode.
   */
  backToProfileView() {
    this.profileView = 'view';
  }

  /**
   * Opens the avatar selection view.
   * @param user - The current user data to pre-fill the current avatar
   */
  openAvatarSelection(user: HeaderUser) {
    this.profileView = 'avatar';
    this.selectedAvatar = user.avatarUrl || '';
  }

  /**
   * Selects an avatar from the available options.
   * @param avatarUrl - The URL of the selected avatar
   */
  selectAvatar(avatarUrl: string) {
    this.selectedAvatar = avatarUrl;
  }

  /**
   * Saves the selected avatar to Firestore.
   * Returns to view mode on success.
   */
  async saveAvatar() {
    if (!this.selectedAvatar) return;
    const authUser = this.auth.currentUser;
    if (!authUser) return;

    try {
      await this.profileHelper.updateUserAvatar(authUser.uid, this.selectedAvatar);
      this.profileView = 'view';
    } catch (e) {
      console.error('[Header] Failed to save avatar:', e);
    }
  }

  /**
   * Saves the edited profile name to Firestore.
   * Returns to view mode on success.
   * @param user - The current user data (unused but kept for compatibility)
   */
  async saveProfile(user: HeaderUser) {
    const name = (this.editName || '').trim();
    if (!name || name.length < 3) return;
    const authUser = this.auth.currentUser;
    if (!authUser) return;

    try {
      await this.profileHelper.updateUserName(authUser.uid, name);
      this.profileView = 'view';
    } catch (e) {
      // Error already logged in helper
    }
  }

  /**
   * Closes all open dropdowns and modals (profile and search).
   */
  closeAll() {
    this.profileOpen = false;
    this.profileModalOpen = false;
    this.closeSearch();
  }

  /**
   * Navigates to the profile page and closes all dropdowns.
   */
  goToProfile() {
    this.profileOpen = false;
    this.profileModalOpen = false;
    this.router.navigate(['/profile']);
  }

  /**
   * Logs out the current user.
   * Sets user offline in Firestore, signs out from Firebase Auth, and navigates to login.
   */
  async logout() {
    this.closeAll();
    await this.profileHelper.logout();
  }

  /** ---------- SEARCH ---------- */
  private search$ = new BehaviorSubject<string>('');
  searchOpen = false;
  activeIndex = -1;
  private latestResults: SearchResult[] = [];
  searchTerm = '';

  /**
   * Updates the search term and opens the search results dropdown.
   * @param v - The search term string
   */
  setSearch(v: string) {
    this.searchTerm = v;
    const term = (v || '').trim().toLowerCase();
    this.searchOpen = !!term;
    this.activeIndex = -1;
    this.search$.next(term);
  }

  /**
   * Opens the search dropdown if there is a search term.
   */
  openSearch() {
    const t = this.search$.value;
    this.searchOpen = !!t;
  }

  /**
   * Clears the search term and closes the search dropdown.
   * Refocuses the search input.
   */
  clearSearch() {
    this.searchTerm = '';
    this.search$.next('');
    this.closeSearch();
    queueMicrotask(() => this.searchInput?.nativeElement?.focus());
  }

  /**
   * Closes the search dropdown and resets the active index.
   */
  closeSearch() {
    this.searchOpen = false;
    this.activeIndex = -1;
  }

  /**
   * Observable that searches across channels, users, and messages.
   * Combines results from all sources and limits to 10 total results.
   */
  results$: Observable<SearchResult[]> = this.searchHelper.createSearchStream(
    this.search$.pipe(debounceTime(120), distinctUntilChanged()),
    (results) => { this.latestResults = results; }
  );

  /**
   * Saves the user's display name to Firestore.
   * @param newNameRaw - The new display name to save
   */
  async saveDisplayName(newNameRaw: string) {
    await this.profileHelper.saveDisplayName(newNameRaw, this.auth.currentUser);
  }

  /**
   * Handles selection of a search result.
   * Navigates to the appropriate route based on result type and clears the search.
   * @param r - The selected search result
   */
  onSelectResult(r: SearchResult) {
    this.searchHelper.navigateToResult(r);
    this.clearSearch();
  }

  /**
   * Handles keyboard navigation in search results.
   * Supports arrow keys for navigation, Enter to select, and Escape to close.
   * @param ev - The keyboard event
   */
  onSearchKeydown(ev: KeyboardEvent) {
    if (!this.searchOpen) return;
    const results = this.latestResults ?? [];
    if (!results.length) return;
    this.handleSearchKeyAction(ev, results);
  }

  /**
   * Dispatches keyboard events to appropriate handlers
   * @param ev - The keyboard event
   * @param results - Current search results
   */
  private handleSearchKeyAction(ev: KeyboardEvent, results: SearchResult[]) {
    if (ev.key === 'ArrowDown') {
      this.moveSearchSelectionDown(ev, results);
    } else if (ev.key === 'ArrowUp') {
      this.moveSearchSelectionUp(ev);
    } else if (ev.key === 'Enter') {
      this.selectSearchResult(ev, results);
    } else if (ev.key === 'Escape') {
      this.closeSearchOnEscape(ev);
    }
  }

  /**
   * Moves the search selection down
   * @param ev - The keyboard event
   * @param results - Current search results
   */
  private moveSearchSelectionDown(ev: KeyboardEvent, results: SearchResult[]) {
    ev.preventDefault();
    this.activeIndex = this.searchHelper.moveSelectionDown(this.activeIndex, results.length);
  }

  /**
   * Moves the search selection up
   * @param ev - The keyboard event
   */
  private moveSearchSelectionUp(ev: KeyboardEvent) {
    ev.preventDefault();
    this.activeIndex = this.searchHelper.moveSelectionUp(this.activeIndex);
  }

  /**
   * Selects the current search result
   * @param ev - The keyboard event
   * @param results - Current search results
   */
  private selectSearchResult(ev: KeyboardEvent, results: SearchResult[]) {
    ev.preventDefault();
    const picked = results[this.activeIndex];
    if (picked) this.onSelectResult(picked);
  }

  /**
   * Closes search on Escape key
   * @param ev - The keyboard event
   */
  private closeSearchOnEscape(ev: KeyboardEvent) {
    ev.preventDefault();
    this.closeAll();
  }

  /**
   * Closes all dropdowns when clicking outside the component.
   * Listener for global document clicks.
   * @param ev - The mouse event
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent) {
    const target = ev.target as Node | null;
    if (!target) return;
    if (!this.host.nativeElement.contains(target)) {
      this.closeAll();
    }
  }

  /**
   * Closes all dropdowns when pressing Escape.
   * Global keyboard listener.
   * @param ev - The keyboard event
   */
  @HostListener('window:keydown', ['$event'])
  onWindowKeydown(ev: KeyboardEvent) {
    if (ev.key === 'Escape') {
      this.closeAll();
    }
  }
}
