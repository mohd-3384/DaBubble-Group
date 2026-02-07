import { Injectable } from '@angular/core';

/**
 * Service for calculating modal positions
 */
@Injectable()
export class ModalPositionHelper {
    /**
     * Calculates modal position from button element
     * @param el - Button element
     * @param which - Modal type
     * @returns Position object
     */
    positionModalFrom(
        el: HTMLElement,
        which: 'members' | 'add'
    ): { top: number; left: number } {
        const rect = el.getBoundingClientRect();
        const offset = 10;

        const viewportW = this.getViewportWidth();
        const panelWidth = which === 'members' ? 360 : 480;

        const left = Math.min(
            viewportW - panelWidth - 16,
            Math.max(16, rect.right - panelWidth)
        );

        const top = rect.bottom + offset;

        return { top, left };
    }

    /**
     * Calculates popover position with viewport handling
     * @param rect - Button rect
     * @param popW - Popover width
     * @param estimatedH - Estimated height
     * @returns Position object
     */
    calculatePopoverPosition(
        rect: DOMRect,
        popW: number,
        estimatedH: number
    ): { top: number; left: number } {
        const offset = 8;
        const viewportW = this.getViewportWidth();
        const viewportH = this.getViewportHeight();

        let top = rect.bottom + offset - 4;
        let left = rect.left;

        left = Math.min(left, viewportW - popW - 16);
        left = Math.max(16, left);

        if (top + estimatedH > viewportH - 10) {
            top = rect.top - estimatedH - offset;
            top = Math.max(10, top);
        }

        return { top, left };
    }

    /**
     * Gets viewport width
     * @returns Viewport width
     */
    private getViewportWidth(): number {
        return window.innerWidth || document.documentElement.clientWidth;
    }

    /**
     * Gets viewport height
     * @returns Viewport height
     */
    private getViewportHeight(): number {
        return window.innerHeight || document.documentElement.clientHeight;
    }
}
