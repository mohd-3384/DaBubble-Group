import { inject, Injectable } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthReadyService {
  private auth = inject(Auth);

  async requireUser() {
    return await firstValueFrom(
      authState(this.auth).pipe(filter((u): u is NonNullable<typeof u> => !!u))
    );
  }
}
