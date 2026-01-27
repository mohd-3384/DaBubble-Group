import { ViewChild, Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationStart, NavigationEnd, ActivatedRoute } from '@angular/router';
import {
  Firestore,
  collection,
  collectionData,
  query,
  orderBy,
  getDocs,
  limit,
  doc,
  docData,
  updateDoc,
  serverTimestamp,
} from '@angular/fire/firestore';
import { Auth, authState, signOut } from '@angular/fire/auth';
import { Observable, BehaviorSubject, combineLatest, from, of } from 'rxjs';
import { map, switchMap, startWith, distinctUntilChanged, debounceTime } from 'rxjs/operators';
import { catchError, shareReplay } from 'rxjs/operators';
import { HeaderUser, ProfileView, SearchResult, UserDoc } from '../../interfaces/allInterfaces.interface';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss', './header.responsive.scss', './header.modal.scss'],
})
export class HeaderComponent {
  private fs = inject(Firestore);
  private auth = inject(Auth);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private host = inject(ElementRef<HTMLElement>);

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

  constructor() {
    // Beobachte Routen-Änderungen
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

  goBack() {
    const currentUrl = this.router.url;

    // Wenn wir in einem Thread sind → Browser Back (sicher, da wir vom Chat hier herkamen)
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

  toggleProfile() {
    this.profileOpen = !this.profileOpen;
    if (this.profileOpen) {
      this.profileModalOpen = false;
      this.closeSearch();
    }
  }

  openProfileModal() {
    this.profileOpen = false;
    this.profileModalOpen = true;
    this.profileView = 'view';
    this.closeSearch();
  }

  closeProfileModal() {
    this.profileModalOpen = false;
    this.profileView = 'view';
  }

  openEditProfile(user: HeaderUser) {
    this.profileView = 'edit';
    this.editName = user.name ?? '';
  }

  backToProfileView() {
    this.profileView = 'view';
  }

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

  closeAll() {
    this.profileOpen = false;
    this.profileModalOpen = false;
    this.closeSearch();
  }

  goToProfile() {
    this.profileOpen = false;
    this.profileModalOpen = false;
    this.router.navigate(['/profile']);
  }

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

  setSearch(v: string) {
    this.searchTerm = v;
    const term = (v || '').trim().toLowerCase();
    this.searchOpen = !!term;
    this.activeIndex = -1;
    this.search$.next(term);
  }

  openSearch() {
    const t = this.search$.value;
    this.searchOpen = !!t;
  }

  clearSearch() {
    this.searchTerm = '';
    this.search$.next('');
    this.closeSearch();
    queueMicrotask(() => this.searchInput?.nativeElement?.focus());
  }

  closeSearch() {
    this.searchOpen = false;
    this.activeIndex = -1;
  }

  results$: Observable<SearchResult[]> = combineLatest([
    authState(this.auth),
    this.search$.pipe(debounceTime(120), distinctUntilChanged())
  ]).pipe(
    switchMap(([u, term]) => {
      if (!u || !term) {
        this.latestResults = [];
        return of([] as SearchResult[]);
      }

      const channels$ = collectionData(collection(this.fs, 'channels'), { idField: 'id' }).pipe(
        map((rows: any[]) =>
          (rows || [])
            .map((c) => {
              const docId = String(c.id ?? '');
              const name = String(c?.name ?? '').trim();
              return { docId, name };
            })
            .filter((c) => c.name.toLowerCase().includes(term))
            .slice(0, 6)
            .map((c) => ({ kind: 'channel', id: c.docId, name: c.name } as SearchResult))
        ),
        catchError(() => of([] as SearchResult[]))
      );

      const users$ = collectionData(collection(this.fs, 'users'), { idField: 'id' }).pipe(
        map((rows: any[]) =>
          (rows || [])
            .filter((x) => String(x?.name ?? '').toLowerCase().includes(term))
            .slice(0, 6)
            .map((x) => ({
              kind: 'user',
              id: String(x.id),
              name: String(x.name ?? 'Unbekannt'),
              avatarUrl: (x.avatarUrl as string | undefined) ?? this.DEFAULT_AVATAR,
            }) as SearchResult)
        ),
        catchError(() => of([] as SearchResult[]))
      );

      const messages$ = from(this.searchChannelMessages(term)).pipe(
        catchError(() => of([] as SearchResult[]))
      );

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

  private async searchChannelMessages(term: string): Promise<SearchResult[]> {
    try {
      const chSnap = await getDocs(query(collection(this.fs, 'channels'), limit(20)));
      const channelIds = chSnap.docs.map((d) => d.id);

      const hits: SearchResult[] = [];
      const t = term.toLowerCase();

      for (const channelId of channelIds) {
        if (hits.length >= 10) break;

        const msgSnap = await getDocs(
          query(collection(this.fs, `channels/${channelId}/messages`), orderBy('createdAt', 'desc'), limit(40))
        );

        for (const d of msgSnap.docs) {
          const data: any = d.data();
          const text = String(data?.text ?? '');
          if (text && text.toLowerCase().includes(t)) {
            hits.push({ kind: 'message', channelId, text });
            if (hits.length >= 10) break;
          }
        }
      }

      return hits.slice(0, 10);
    } catch (e) {
      console.error('[HeaderSearch] message search failed:', e);
      return [];
    }
  }

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

  /** ---------- KEYBOARD NAV ---------- */
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

  /** ---------- OUTSIDE CLICK + ESC GLOBAL ---------- */
  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent) {
    const target = ev.target as Node | null;
    if (!target) return;

    if (!this.host.nativeElement.contains(target)) {
      this.closeAll();
    }
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeydown(ev: KeyboardEvent) {
    if (ev.key === 'Escape') {
      this.closeAll();
    }
  }
}
