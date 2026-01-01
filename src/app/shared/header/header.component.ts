import { ViewChild, Component, ElementRef, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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
} from '@angular/fire/firestore';
import { Auth, authState, signOut } from '@angular/fire/auth';
import { Observable, BehaviorSubject, combineLatest, from, of } from 'rxjs';
import { map, switchMap, startWith, distinctUntilChanged, debounceTime } from 'rxjs/operators';
import { UserDoc } from '../../interfaces/allInterfaces.interface';

type SearchResult =
  | { kind: 'channel'; id: string }
  | { kind: 'user'; id: string; name: string; avatarUrl?: string }
  | { kind: 'message'; channelId: string; text: string };

type HeaderUser = {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'away';
  avatarUrl: string;
  online: boolean;
};

type ProfileView = 'view' | 'edit';

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
  private host = inject(ElementRef<HTMLElement>);

  @ViewChild('searchInput', { static: false })
  searchInput?: ElementRef<HTMLInputElement>;

  private readonly DEFAULT_AVATAR = '/public/images/avatars/avatar-default.svg';

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

          const name = String(data.name ?? '').trim() || 'Guest';
          const email = String(data.email ?? u.email ?? 'guest@dabubble.de').trim();
          const status = (data.status === 'away' ? 'away' : 'active') as 'active' | 'away';
          const avatarUrl = String(data.avatarUrl ?? '').trim() || this.DEFAULT_AVATAR;
          const online = !!(data.online ?? true);

          return {
            id: data.id ?? u.uid,
            name,
            email,
            status,
            avatarUrl,
            online,
          } satisfies HeaderUser;
        }),
        startWith({
          id: u.uid,
          name: '…',
          email: u.email ?? '',
          status: 'active',
          avatarUrl: this.DEFAULT_AVATAR,
          online: true,
        } as HeaderUser)
      );
    }),
    startWith(this.guestUser)
  );

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

  results$: Observable<SearchResult[]> = this.search$.pipe(
    debounceTime(120),
    distinctUntilChanged(),
    switchMap((term) => {
      if (!term) return of([] as SearchResult[]);

      const channels$ = collectionData(collection(this.fs, 'channels'), { idField: 'id' }).pipe(
        map((rows: any[]) =>
          (rows || [])
            .filter((c) => String(c.id || '').toLowerCase().includes(term))
            .slice(0, 6)
            .map((c) => ({ kind: 'channel', id: String(c.id) } as SearchResult))
        )
      );

      const users$ = collectionData(collection(this.fs, 'users'), { idField: 'id' }).pipe(
        map((rows: any[]) =>
          (rows || [])
            .filter((u) => String(u?.name ?? '').toLowerCase().includes(term))
            .slice(0, 6)
            .map(
              (u) =>
                ({
                  kind: 'user',
                  id: String(u.id),
                  name: String(u.name ?? 'Unbekannt'),
                  avatarUrl: (u.avatarUrl as string | undefined) ?? this.DEFAULT_AVATAR,
                }) as SearchResult
            )
        )
      );

      const messages$ = from(this.searchChannelMessages(term));

      return combineLatest([channels$, users$, messages$]).pipe(
        map(([c, u, m]) => {
          const merged = [...c, ...u, ...m].slice(0, 10);
          this.latestResults = merged;
          return merged;
        })
      );
    }),
    startWith([] as SearchResult[])
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
