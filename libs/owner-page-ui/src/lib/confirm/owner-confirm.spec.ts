import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { OwnerConfirmService } from './owner-confirm.service';
import type { OwnerConfirmOptions } from './owner-confirm.types';

describe('OwnerConfirmService', () => {
  let service: OwnerConfirmService;

  beforeAll(() => {
    // jsdom has no scrollTo; the modal's scroll-lock teardown calls it.
    jest.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  });

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ThemeService] });
    service = TestBed.inject(OwnerConfirmService);
  });

  afterEach(() => {
    document.body
      .querySelectorAll('ot-owner-confirm-dialog')
      .forEach((n) => n.remove());
  });

  const base: OwnerConfirmOptions = {
    level: 'plain',
    title: 'Pause imports',
    body: 'Imports stop until resumed.',
    confirmLabel: 'Pause',
  };

  function open(options: OwnerConfirmOptions) {
    const promise = service.confirm(options);
    TestBed.inject(ApplicationRef).tick();
    return promise;
  }

  const q = <T extends HTMLElement>(sel: string) =>
    document.body.querySelector(`ot-owner-confirm-dialog ${sel}`) as T | null;
  const confirmButton = () =>
    q<HTMLButtonElement>('.owner-confirm__button--confirm');
  const cancelButton = () =>
    q<HTMLButtonElement>(
      '.owner-confirm__button:not(.owner-confirm__button--confirm)'
    );

  function typeInto(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
    el.value = value;
    el.dispatchEvent(new Event('input'));
    TestBed.inject(ApplicationRef).tick();
  }

  it('is a labelled dialog with the title, body and both buttons', () => {
    void open(base);
    const dialog = q<HTMLElement>('.modal-dialog');
    expect(dialog?.getAttribute('role')).toBe('dialog');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-label')).toBe('Pause imports');
    expect(q('.modal-title')?.textContent).toContain('Pause imports');
    expect(q('.owner-confirm__body')?.textContent).toContain('Imports stop');
    expect(cancelButton()?.textContent).toContain('Cancel');
    expect(confirmButton()?.textContent).toContain('Pause');
  });

  it('plain confirms in one click', async () => {
    const result = open(base);
    expect(confirmButton()?.disabled).toBe(false);
    confirmButton()?.click();
    await expect(result).resolves.toEqual({ confirmed: true });
    expect(q('.modal-dialog')).toBeNull();
  });

  it('Cancel resolves not confirmed and removes the dialog', async () => {
    const result = open(base);
    cancelButton()?.click();
    await expect(result).resolves.toEqual({ confirmed: false });
    expect(document.body.querySelector('ot-owner-confirm-dialog')).toBeNull();
  });

  it('Esc cancels', async () => {
    const result = open({ ...base, level: 'reason' });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await expect(result).resolves.toEqual({ confirmed: false });
  });

  describe('reason level', () => {
    const opts: OwnerConfirmOptions = { ...base, level: 'reason' };

    it('keeps confirm disabled until a non-blank reason is given', () => {
      void open(opts);
      expect(confirmButton()?.disabled).toBe(true);
      typeInto(
        q<HTMLTextAreaElement>('textarea') as HTMLTextAreaElement,
        '   '
      );
      expect(confirmButton()?.disabled).toBe(true);
      typeInto(
        q<HTMLTextAreaElement>('textarea') as HTMLTextAreaElement,
        'Abuse report 42'
      );
      expect(confirmButton()?.disabled).toBe(false);
    });

    it('returns the trimmed reason', async () => {
      const result = open(opts);
      typeInto(
        q<HTMLTextAreaElement>('textarea') as HTMLTextAreaElement,
        '  Abuse report 42 '
      );
      confirmButton()?.click();
      await expect(result).resolves.toEqual({
        confirmed: true,
        reason: 'Abuse report 42',
      });
    });

    it('does not confirm while the button is disabled', async () => {
      const result = open(opts);
      confirmButton()?.click();
      expect(
        document.body.querySelector('ot-owner-confirm-dialog')
      ).not.toBeNull();
      cancelButton()?.click();
      await expect(result).resolves.toEqual({ confirmed: false });
    });
  });

  describe('typed level', () => {
    const opts: OwnerConfirmOptions = {
      ...base,
      level: 'typed',
      typedPhrase: 'DELETE 12 USERS',
      destructive: true,
    };

    it('shows the phrase and keeps confirm disabled until it matches exactly', () => {
      void open(opts);
      expect(q('.owner-confirm__label')?.textContent).toContain(
        'DELETE 12 USERS'
      );
      const input = q<HTMLInputElement>('input') as HTMLInputElement;
      expect(confirmButton()?.disabled).toBe(true);
      typeInto(input, 'delete 12 users');
      expect(confirmButton()?.disabled).toBe(true);
      typeInto(input, 'DELETE 12 USERS ');
      expect(confirmButton()?.disabled).toBe(true);
      typeInto(input, 'DELETE 12 USERS');
      expect(confirmButton()?.disabled).toBe(false);
    });

    it('marks destructive confirms and resolves without a reason', async () => {
      const result = open(opts);
      expect(confirmButton()?.classList).toContain(
        'owner-confirm__button--danger'
      );
      typeInto(
        q<HTMLInputElement>('input') as HTMLInputElement,
        'DELETE 12 USERS'
      );
      confirmButton()?.click();
      await expect(result).resolves.toEqual({ confirmed: true });
    });

    it('rejects a typed confirmation with no phrase', async () => {
      await expect(
        service.confirm({ ...base, level: 'typed' })
      ).rejects.toThrow('typedPhrase');
    });
  });
});
