import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';

/**
 * Component for displaying privacy policy with table of contents and smooth scrolling
 */
@Component({
  selector: 'app-privacypolicy',
  standalone: true,
  imports: [CommonModule],
  providers: [DatePipe],
  templateUrl: './privacypolicy.component.html',
  styleUrl: './privacypolicy.component.scss',
})
export class PrivacypolicyComponent {
  /**
   * Reference to the scrollable content container element
   */
  @ViewChild('contentEl') contentEl!: ElementRef<HTMLElement>;

  /**
   * Current date for displaying last updated date
   */
  today = new Date();

  /**
   * Creates an instance of PrivacypolicyComponent
   * @param router - Angular router service for navigation
   */
  constructor(private router: Router) { }

  /**
   * Navigates back to the previous page in browser history, or to home page if no history exists
   */
  goBack() {
    history.length > 1 ? history.back() : this.router.navigateByUrl('/');
  }

  /**
   * Scrolls smoothly to a section with the given ID within the content container
   * @param id - The ID of the target section to scroll to
   * @param ev - Optional event to prevent default behavior
   */
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
