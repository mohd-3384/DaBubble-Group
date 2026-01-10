import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-privacypolicy',
  standalone: true,
  imports: [CommonModule],
  providers: [DatePipe],
  templateUrl: './privacypolicy.component.html',
  styleUrl: './privacypolicy.component.scss',
})
export class PrivacypolicyComponent {

  @ViewChild('contentEl') contentEl!: ElementRef<HTMLElement>;

  today = new Date();

  constructor(private router: Router) { }

  goBack() {
    history.length > 1 ? history.back() : this.router.navigateByUrl('/');
  }

  scrollTo(id: string, ev?: Event) {
    ev?.preventDefault();
    ev?.stopPropagation();

    const container = this.contentEl?.nativeElement;
    if (!container) return;

    const target = container.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (!target) return;

    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
