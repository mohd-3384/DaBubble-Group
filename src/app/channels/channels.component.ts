import { Component, inject, signal, Output, EventEmitter, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { Router } from '@angular/router';
import { BehaviorSubject, combineLatest, from, Observable, of, take } from 'rxjs';
import { UserService } from '../services/user.service';
import { ChannelService } from '../services/channel.service';
import { FormsModule } from '@angular/forms';
import { ChannelDoc, UserDoc, WsSearchResult } from '../interfaces/allInterfaces.interface';
import { Auth, authState } from '@angular/fire/auth';
import { ThreadState } from '../services/thread.state';
import { NavigationStart } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, filter, map, shareReplay, startWith, switchMap } from 'rxjs/operators';
import { collection, collectionData, Firestore, getDocs, limit, orderBy, query } from '@angular/fire/firestore';

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
  templateUrl: './channels.component.html',
  styleUrl: './channels.component.scss',
})
export class ChannelsComponent {
  private thread = inject(ThreadState);
  private usersSvc = inject(UserService);
  private chanSvc = inject(ChannelService);

  private fs = inject(Firestore);

  users$!: Observable<UserDoc[]>;
  channels$!: Observable<ChannelDoc[]>;

  workspaceCollapsed = signal(false);
  @Output() workspaceCollapsedChange = new EventEmitter<boolean>();

  /** UI State */
  collapsedChannels = signal(false);
  collapsedDMs = signal(false);
  meId: string | null = null;

  /** Channel-Modal */
  createChannelOpen = false;
  newChannelName = '';
  newChannelDescription = '';

  @ViewChild('wsSearchInput', { static: false })
  wsSearchInput?: ElementRef<HTMLInputElement>;

  private wsSearch$ = new BehaviorSubject<string>('');
  wsSearchOpen = false;
  wsActiveIndex = -1;
  private wsLatestResults: WsSearchResult[] = [];
  wsSearchTerm = '';

  toggleWorkspace() {
    this.workspaceCollapsed.update((v) => {
      const next = !v;
      this.workspaceCollapsedChange.emit(next);
      return next;
    });
  }

  private auth = inject(Auth);

  constructor(
    private router: Router) {

    this.users$ = this.usersSvc.users$();
    this.channels$ = this.chanSvc.channels$();

    authState(this.auth).pipe(take(1)).subscribe(u => this.meId = u?.uid ?? null);

    this.router.events
      .pipe(filter((e): e is NavigationStart => e instanceof NavigationStart))
      .subscribe(() => this.thread.close());
  }

  /** Modal öffnen */
  openCreateChannelModal() {
    this.createChannelOpen = true;
    this.newChannelName = '';
    this.newChannelDescription = '';
  }

  /** Modal schließen */
  closeCreateChannelModal() {
    this.createChannelOpen = false;
  }

  /** Channel wirklich erstellen (Submit im Formular) */
  async submitCreateChannel() {
    const raw = (this.newChannelName || '').trim();
    if (!raw) return;

    const topic = (this.newChannelDescription || '').trim();

    try {
      // createChannel gibt jetzt die generierte ID zurück
      const channelId = await this.chanSvc.createChannel(raw, topic);
      await this.chanSvc.addMeAsMember(channelId, 'owner');

      // Formular leeren & Modal schließen
      this.newChannelName = '';
      this.newChannelDescription = '';
      this.closeCreateChannelModal();

      // gleich in den neuen Channel springen
      this.router.navigate(['/channel', channelId]);
    } catch (e) {
      console.error('[ChannelModal] create failed:', e);
    }
  }

  /** trackBy-Helper für Performance */
  trackByUid = (_: number, u: UserDoc) => u.id;
  trackByCid = (_: number, c: ChannelDoc) => c.id;

  toggleChannels() { this.collapsedChannels.update(v => !v); }
  toggleDMs() { this.collapsedDMs.update(v => !v); }

  startNewMessage() {
    this.router.navigate(['/new']);
  }

  setWsSearch(v: string) {
    this.wsSearchTerm = v;
    const term = (v || '').trim().toLowerCase();
    this.wsSearchOpen = !!term;
    this.wsActiveIndex = -1;
    this.wsSearch$.next(term);
  }

  openWsSearch() {
    const t = this.wsSearch$.value;
    this.wsSearchOpen = !!t;
  }

  clearWsSearch() {
    this.wsSearchTerm = '';
    this.wsSearch$.next('');
    this.wsSearchOpen = false;
    this.wsActiveIndex = -1;
    queueMicrotask(() => this.wsSearchInput?.nativeElement?.focus());
  }

  closeWsSearch() {
    this.wsSearchOpen = false;
    this.wsActiveIndex = -1;
  }

  wsResults$: Observable<WsSearchResult[]> = combineLatest([
    authState(this.auth),
    this.wsSearch$.pipe(debounceTime(120), distinctUntilChanged()),
  ]).pipe(
    switchMap(([u, term]) => {
      if (!u || !term) {
        this.wsLatestResults = [];
        return of([] as WsSearchResult[]);
      }

      type WsChannelResult = Extract<WsSearchResult, { kind: 'channel' }>;

      const channels$ = collectionData(collection(this.fs, 'channels'), { idField: 'id' }).pipe(
        map((rows: any[]) =>
          (rows || [])
            .map((c): WsChannelResult => ({
              kind: 'channel',
              id: String(c.id),
              name: String(c?.name ?? c.id),
            }))
            .filter((c) => c.name.toLowerCase().includes(term))
            .slice(0, 6)
        ),
        catchError(() => of([] as WsChannelResult[]))
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
              avatarUrl: (x.avatarUrl as string | undefined),
            }) as WsSearchResult)
        ),
        catchError(() => of([] as WsSearchResult[]))
      );

      const messages$ = from(this.searchChannelMessages(term)).pipe(
        catchError(() => of([] as WsSearchResult[]))
      );

      return combineLatest([channels$, users$, messages$]).pipe(
        map(([c, uu, m]) => {
          const merged = [...c, ...uu, ...m].slice(0, 10);
          this.wsLatestResults = merged;
          return merged;
        }),
        catchError(() => of([] as WsSearchResult[]))
      );
    }),
    startWith([] as WsSearchResult[]),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  private async searchChannelMessages(term: string): Promise<WsSearchResult[]> {
    try {
      const chSnap = await getDocs(query(collection(this.fs, 'channels'), limit(20)));
      const channelIds = chSnap.docs.map((d) => d.id);

      const hits: WsSearchResult[] = [];
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
    } catch {
      return [];
    }
  }

  onSelectWsResult(r: WsSearchResult) {
    if (r.kind === 'channel') this.router.navigate(['/channel', r.id]);
    if (r.kind === 'user') this.router.navigate(['/dm', r.id]);
    if (r.kind === 'message') this.router.navigate(['/channel', r.channelId]);
    this.clearWsSearch();
  }

  onWsSearchKeydown(ev: KeyboardEvent) {
    if (!this.wsSearchOpen) return;

    const results = this.wsLatestResults ?? [];
    if (!results.length) return;

    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      this.wsActiveIndex = Math.min(results.length - 1, this.wsActiveIndex + 1);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      this.wsActiveIndex = Math.max(0, this.wsActiveIndex - 1);
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      const picked = results[this.wsActiveIndex];
      if (picked) this.onSelectWsResult(picked);
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      this.closeWsSearch();
    }
  }

  @HostListener('document:click')
  onDocClick() {
    this.closeWsSearch();
  }
}
