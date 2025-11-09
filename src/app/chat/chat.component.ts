import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, doc, docData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { Vm } from '../interfaces/chat.interface';


@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
})
export class ChatComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private firestore = inject(Firestore);

  vm$: Observable<Vm>;

  constructor() {
    this.vm$ = this.route.paramMap.pipe(
      switchMap(params => {
        const id = params.get('id')!;
        // robust statt window.location:
        const isDM = this.router.url.includes('/dm/');
        const path = isDM ? `users/${id}` : `channels/${id}`;
        const ref = doc(this.firestore, path);

        return docData(ref).pipe(
          map((data: any): Vm => ({
            kind: isDM ? 'dm' as const : 'channel' as const,
            title: isDM
              ? String(data?.name ?? 'Direct Message')
              : `# ${String(data?.name ?? 'Channel')}`,
            avatarUrl: isDM ? (data?.avatarUrl as string | undefined) : undefined,
            online: isDM ? (data?.online as boolean | undefined) : undefined,
          }))
        );
      })
    );
  }
}

