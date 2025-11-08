import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  Firestore,
  doc, docData,
  collection, query, orderBy,
  collectionData
} from '@angular/fire/firestore';

import { map, switchMap } from 'rxjs/operators';
import { combineLatest, Observable, of } from 'rxjs';

type Kind = 'channel' | 'dm';
type HeaderIcon = 'tag' | 'person';

export type Msg = {
  id: string;
  text: string;
  authorId: string;
  authorName?: string;
  authorAvatar?: string;
  createdAt?: any;
};

type Vm = {
  kind: Kind;
  headerIcon: 'tag' | 'person';
  title: string;         // "# frontend" oder Benutzername
  messages: Msg[];
  memberAvatars?: string[];
  memberCount?: number;
};

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatDividerModule, MatTooltipModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
})
export class ChatComponent {
  private route = inject(ActivatedRoute);
  private fs = inject(Firestore);

  /** TODO: später aus deinem AuthService holen */
  private meId = 'uid_guest';

  /** erkennt anhand der Route, ob channel/:id oder dm/:id aktiv ist */
  private routeInfo$ = combineLatest([
    this.route.paramMap,
    this.route.url
  ]).pipe(
    map(([pm]) => {
      const id = pm.get('id') ?? '';
      // Pfad-Muster aus dem aktuellen Route-Config lesen
      const pattern = this.route.routeConfig?.path ?? '';
      const kind: Kind = pattern.startsWith('dm') ? 'dm' : 'channel';
      return { id, kind };
    })
  );

  /** Titel/Name als Observable (für Header) */
  private title$ = this.routeInfo$.pipe(
    switchMap(({ id, kind }) => {
      if (!id) return of({ kind, title: '', headerIcon: kind === 'channel' ? 'tag' : 'person' as const });

      if (kind === 'channel') {
        // Kanal-Name lesen
        return docData(doc(this.fs, `channels/${id}`)).pipe(
          map((d: any) => ({
            kind,
            title: d?.name ? `# ${d.name}` : `# ${id}`,
            headerIcon: 'tag' as const
          }))
        );
      } else {
        // DM: Ziel-User anzeigen
        return docData(doc(this.fs, `users/${id}`)).pipe(
          map((d: any) => ({
            kind,
            title: d?.name ?? 'Direktnachricht',
            headerIcon: 'person' as const
          }))
        );
      }
    })
  );

  /** Nachrichtenstrom je nach Kontext */
  private messages$ = this.routeInfo$.pipe(
    switchMap(({ id, kind }) => {
      if (!id) return of([] as Msg[]);

      if (kind === 'channel') {
        const q = query(
          collection(this.fs, `channels/${id}/messages`),
          orderBy('createdAt', 'asc')
        );
        return collectionData(q, { idField: 'id' }) as Observable<Msg[]>;
      } else {
        // DM: Konversations-ID deterministisch aus eigener UID + Ziel-UID
        const convId = [this.meId, id].sort().join('_');
        const q = query(
          collection(this.fs, `conversations/${convId}/messages`),
          orderBy('createdAt', 'asc')
        );
        return collectionData(q, { idField: 'id' }) as Observable<Msg[]>;
      }
    })
  );

  /** ViewModel für Template */
  vm$: Observable<Vm> = combineLatest([this.title$, this.messages$]).pipe(
    map(([meta, messages]): Vm => ({
      kind: meta.kind as Kind,
      headerIcon: (meta.kind === 'channel' ? 'tag' : 'person') as HeaderIcon,
      title: meta.title,
      messages
    }))
  );


  /** trackBy für *ngFor */
  trackByMsg = (_: number, m: Msg) => m.id;
}
