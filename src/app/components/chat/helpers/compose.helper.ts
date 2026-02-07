import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SuggestItem, Vm } from '../../../interfaces/allInterfaces.interface';

/**
 * Service for compose mode functionality
 */
@Injectable()
export class ComposeHelper {
  /**
   * Handles "To:" input change
   * @param value - Input value
   * @param toInput$ - Input subject
   * @returns New state
   */
  onToInput(
    value: string,
    toInput$: BehaviorSubject<string>
  ): {
    to: string;
    suggestOpen: boolean;
    composeTarget: SuggestItem | null;
  } {
    toInput$.next(value);

    return {
      to: value,
      suggestOpen: true,
      composeTarget: null,
    };
  }

  /**
   * Handles keyboard navigation in suggestions
   * @param event - Keyboard event
   * @param list - Suggestion list
   * @param suggestIndex - Current index
   * @param suggestOpen - Suggest panel state
   * @returns New state or null if no change
   */
  onToKeydown(
    event: KeyboardEvent,
    list: SuggestItem[] | null | undefined,
    suggestIndex: number,
    suggestOpen: boolean
  ): { suggestIndex: number; suggestOpen?: boolean; pickSuggestion?: SuggestItem } | null {
    if (!suggestOpen || !list || list.length === 0) return null;

    const max = list.length - 1;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      return { suggestIndex: Math.min(max, suggestIndex + 1) };
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      return { suggestIndex: Math.max(0, suggestIndex - 1) };
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (suggestIndex >= 0 && suggestIndex <= max) {
        return { suggestIndex, pickSuggestion: list[suggestIndex] };
      }
    }

    if (event.key === 'Escape') {
      return { suggestIndex, suggestOpen: false };
    }

    return null;
  }

  /**
   * Picks a suggestion
   * @param suggestion - Selected suggestion
   * @param toInput$ - Input subject
   * @returns New state
   */
  pickSuggestion(
    suggestion: SuggestItem,
    toInput$: BehaviorSubject<string>
  ): {
    to: string;
    suggestOpen: boolean;
    suggestIndex: number;
    composeTarget: SuggestItem;
  } {
    toInput$.next(suggestion.value);
    return {
      to: suggestion.value,
      suggestOpen: false,
      suggestIndex: -1,
      composeTarget: suggestion,
    };
  }

  /**
   * Handles suggestion click
   * @param event - Mouse event
   * @param suggestion - Selected suggestion
   * @param toInput$ - Input subject
   * @returns New state
   */
  onSuggestionClick(
    event: MouseEvent,
    suggestion: SuggestItem,
    toInput$: BehaviorSubject<string>
  ): {
    to: string;
    suggestOpen: boolean;
    suggestIndex: number;
    composeTarget: SuggestItem;
  } {
    event.stopPropagation();
    return this.pickSuggestion(suggestion, toInput$);
  }

  /**
   * Handles "To:" field blur
   * @returns New state after delay
   */
  onToBlur(): { suggestOpen: boolean; suggestIndex: number } {
    return { suggestOpen: false, suggestIndex: -1 };
  }

  /**
   * Generates compose placeholder text
   * @param vm - View model
   * @returns Placeholder string
   */
  composePlaceholder(vm: Vm): string {
    const who = vm.title || '';
    return `Nachricht an ${who}`;
  }

  /**
   * Opens "To:" field with @ prefix and focuses input
   * @param toInput$ - Input subject
   * @param toInputEl - Input element reference
   * @returns New state
   */
  openToSuggestWithAt(
    toInput$: BehaviorSubject<string>,
    toInputEl?: HTMLInputElement
  ): {
    to: string;
    suggestOpen: boolean;
    suggestIndex: number;
    composeTarget: SuggestItem | null;
  } {
    toInput$.next('@');
    setTimeout(() => {
      toInputEl?.focus();
    });
    return {
      to: '@',
      suggestOpen: true,
      suggestIndex: -1,
      composeTarget: null,
    };
  }
}
