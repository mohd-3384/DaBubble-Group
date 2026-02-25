import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ChannelJoinNoticeService {
  private noticeSubject = new Subject<void>();
  notice$ = this.noticeSubject.asObservable();

  trigger(): void {
    this.noticeSubject.next();
  }
}
