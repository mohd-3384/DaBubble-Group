import { ViewChild, Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationStart, NavigationEnd, ActivatedRoute } from '@angular/router';
import { Firestore, doc, docData, updateDoc, serverTimestamp, } from '@angular/fire/firestore';
import { Auth, authState, signOut } from '@angular/fire/auth';
import { Observable, BehaviorSubject, combineLatest, of } from 'rxjs';
import { map, switchMap, startWith, distinctUntilChanged, debounceTime } from 'rxjs/operators';
import { catchError, shareReplay } from 'rxjs/operators';
import { HeaderUser, ProfileView, SearchResult, UserDoc } from '../../interfaces/allInterfaces.interface';
import { HeaderSearchService } from '../../services/header-search.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss', './header.modal.scss'],
})
export class HeaderComponent {
  private fs = inject(Firestore);
  private auth = inject(Auth);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private host = inject(ElementRef<HTMLElement>);
  private searchService = inject(HeaderSearchService);

  @ViewChild('searchInput', { static: false })
  searchInput?: ElementRef<HTMLInputElement>;

  private readonly DEFAULT_AVATAR = '/public/images/avatars/avatar-default.svg';

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
  private guestUser: HeaderUser = {
    id: 'guest',
    name: 'Guest',
    email: 'guest@dabubble.de',
    status: 'active',
    avatarUrl: this.DEFAULT_AVATAR,
    online: true,
  };

  user$: Observable<HeaderUser> = authState(this.auth).pipe(
    switchMap((u) => {
      if (!u) return of(this.guestUser);

      const uref = doc(this.fs, `users/${u.uid}`);
      return docData(uref, { idField: 'id' }).pipe(
        map((raw: any) => {
          const data = (raw || {}) as Partial<UserDoc> & { id?: string };
          return {
            id: data.id ?? u.uid,
            name: String(data.name ?? '').trim() || 'Guest',
            email: String(data.email ?? u.email ?? 'guest@dabubble.de').trim(),
            status: (data.status === 'away' ? 'away' : 'active') as 'active' | 'away',
            avatarUrl: String(data.avatarUrl ?? '').trim() || this.DEFAULT_AVATAR,
            online: !!(data.online ?? true),
          } satisfies HeaderUser;
        }),
        catchError(() => of(this.guestUser))
      );
    }),
    startWith(this.guestUser)
  );

  /**
   * Initializes the header component.
   * Subscribes to router events to track chat state and channel navigation.
   */
  constructor() {
    this.router.events
      .pipe()
      .subscribe((event) => {
        if (event instanceof NavigationStart || event instanceof NavigationEnd) {
          const url = event instanceof NavigationEnd
            ? (event.urlAfterRedirects || event.url)
            : event.url;

          // Check if we're in a chat route (channel, dm, new) or thread route
          const isChat =
            url.startsWith('/channel/') ||
            url.startsWith('/dm/') ||
            url.startsWith('/new');
          this.isChatOpen = isChat;

          // Check if we're in the new message route
          this.isNewMessageRoute = url.startsWith('/new');

          // Extrahiere channelId aus URL
          const channelMatch = url.match(/\/channel\/([^/]+)/);
          this.currentChannelId = channelMatch ? channelMatch[1] : null;
        }
      });
  }

  /**
   * Navigates back based on current route context.
   * Handles thread, new message, and chat routes differently.
   */
  goBack() {
    const currentUrl = this.router.url;

    if (currentUrl.match(/\/(channel|dm)\/[^/]+\/thread\//)) {
      window.history.back();
      return;
    }

    // Wenn wir in "Neue Nachricht" sind → Browser Back zur vorherigen Seite
    if (currentUrl.startsWith('/new')) {
      window.history.back();
      return;
    }

    // Wenn wir im Chat sind (Channel oder DM, aber nicht Thread) → zu Channels-Liste Vollbild
    if (currentUrl.startsWith('/channel/') || currentUrl.startsWith('/dm/')) {
      this.router.navigate(['/channels']);
      return;
    }

    // Fallback
    this.router.navigate(['/channels']);
  }

  /** ---------- PROFILE ---------- */
  profileOpen = false;
  profileModalOpen = false;
  profileView: ProfileView = 'view';
  editName = '';

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
   * Saves the edited profile name to Firestore.
   * Returns to view mode on success.
   * @param user - The current user data (unused but kept for compatibility)
   */
  async saveProfile(user: HeaderUser) {
    const name = (this.editName || '').trim();
    if (!name) return;

    const authUser = this.auth.currentUser;
    if (!authUser) return;

    console.log('[Profile] uid:', authUser.uid);

    try {
      const uref = doc(this.fs, `users/${authUser.uid}`);
      await updateDoc(uref, { name });
      console.log('[Profile] update ok');
      this.profileView = 'view';
    } catch (e: any) {
      console.error('[Profile] update failed:', e?.code, e);
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

    const u = this.auth.currentUser;
    if (u) {
      try {
        await updateDoc(doc(this.fs, `users/${u.uid}`), {
          online: false,
          lastSeen: serverTimestamp(),
        });
      } catch (e) {
        console.warn('[Logout] could not set offline:', e);
      }
    }

    await signOut(this.auth);
    this.router.navigate(['/login']);
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
  results$: Observable<SearchResult[]> = combineLatest([
    authState(this.auth),
    this.search$.pipe(debounceTime(120), distinctUntilChanged())
  ]).pipe(
    switchMap(([u, term]) => {
      if (!u || !term) {
        this.latestResults = [];
        return of([] as SearchResult[]);
      }

      const channels$ = this.searchService.searchChannels(term);
      const users$ = this.searchService.searchUsers(term);
      const messages$ = this.searchService.searchMessages(term);

      return combineLatest([channels$, users$, messages$]).pipe(
        map(([c, uu, m]) => {
          const merged = [...c, ...uu, ...m].slice(0, 10);
          this.latestResults = merged;
          return merged;
        }),
        catchError(() => of([] as SearchResult[]))
      );
    }),
    startWith([] as SearchResult[]),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  /**
   * Saves the user's display name to Firestore.
   * @param newNameRaw - The new display name to save
   */
  async saveDisplayName(newNameRaw: string) {
    const newName = (newNameRaw || '').trim();
    if (!newName) return;

    const authUser = this.auth.currentUser;
    if (!authUser) {
      console.warn('[Profile] Not authenticated -> cannot update Firestore');
      return;
    }

    try {
      const ref = doc(this.fs, `users/${authUser.uid}`);
      await updateDoc(ref, { name: newName });
      console.log('[Profile] name updated:', newName);
    } catch (e) {
      console.error('[Profile] update failed:', e);
    }
  }

  /**
   * Handles selection of a search result.
   * Navigates to the appropriate route based on result type and clears the search.
   * @param r - The selected search result
   */
  onSelectResult(r: SearchResult) {
    if (r.kind === 'channel') {
      this.router.navigate(['/channel', r.id]);
    }

    if (r.kind === 'user') {
      this.router.navigate(['/dm', r.id]);
    }

    if (r.kind === 'message') {
      this.router.navigate(['/channel', r.channelId]);
    }

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

    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      this.activeIndex = Math.min(results.length - 1, this.activeIndex + 1);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      this.activeIndex = Math.max(0, this.activeIndex - 1);
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      const picked = results[this.activeIndex];
      if (picked) this.onSelectResult(picked);
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      this.closeAll();
    }
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
