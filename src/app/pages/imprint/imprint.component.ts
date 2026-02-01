import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

/**
 * Component for displaying legal imprint information
 */
@Component({
  selector: 'app-imprint',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './imprint.component.html',
  styleUrls: ['./imprint.component.scss'],
})
export class ImprintComponent {
  /**
   * Creates an instance of ImprintComponent
   * @param router - Angular router service for navigation
   */
  constructor(private router: Router) { }

  /**
   * Navigates back to the previous page in browser history, or to home page if no history exists
   */
  goBack() {
    history.length > 1 ? history.back() : this.router.navigateByUrl('/');
  }
}
