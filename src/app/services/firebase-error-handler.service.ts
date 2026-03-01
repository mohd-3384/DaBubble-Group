import { ErrorHandler, Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';

@Injectable()
export class FirebaseErrorHandler implements ErrorHandler {
    private auth = inject(Auth);

    handleError(error: unknown): void {
        const err = error as any;
        const code = err?.code ?? err?.rejection?.code;
        const message = String(err?.message ?? err?.rejection?.message ?? '');
        const isPermission =
            code === 'permission-denied' ||
            code === 'missing-or-insufficient-permissions' ||
            message.toLowerCase().includes('missing or insufficient permissions');

        if (isPermission && !this.auth.currentUser) {
            return;
        }

        console.error(error);
    }
}
