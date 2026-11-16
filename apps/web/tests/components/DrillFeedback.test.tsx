import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DrillFeedback } from '@/components/DrillFeedback';

const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('DrillFeedback when the answer is correct', () => {
  it('should show a Benar status and no Lanjut button', () => {
    render(<DrillFeedback correct answer={<span lang="ja">ね</span>} onContinue={vi.fn<() => void>()} />);

    const status = screen.queryByRole('status');
    expect(status).not.toBeNull();
    expect(status?.textContent).toContain('Benar');
    expect(status?.textContent).not.toContain('Belum tepat');
    expect(screen.queryByRole('button', { name: 'Lanjut' })).toBeNull();
  });

  it('should call onContinue exactly once at 800 ms and never before', () => {
    const onContinue = vi.fn<() => void>();
    render(<DrillFeedback correct answer={<span lang="ja">ね</span>} onContinue={onContinue} />);

    advance(799);
    expect(onContinue).toHaveBeenCalledTimes(0);

    advance(1);
    expect(onContinue).toHaveBeenCalledTimes(1);

    advance(5000);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('should never call onContinue of a feedback unmounted before 800 ms while a mounted one still continues', () => {
    const unmountedContinue = vi.fn<() => void>();
    const mountedContinue = vi.fn<() => void>();
    const unmounted = render(
      <DrillFeedback correct answer={<span lang="ja">ね</span>} onContinue={unmountedContinue} />,
    );
    render(<DrillFeedback correct answer={<span lang="ja">れ</span>} onContinue={mountedContinue} />);

    advance(400);
    unmounted.unmount();
    advance(5000);

    expect(mountedContinue).toHaveBeenCalledTimes(1);
    expect(unmountedContinue).toHaveBeenCalledTimes(0);
  });
});

describe('DrillFeedback when the answer is wrong', () => {
  it('should show a Belum tepat status', () => {
    render(
      <DrillFeedback correct={false} answer={<span lang="ja">ね</span>} onContinue={vi.fn<() => void>()} />,
    );

    const status = screen.queryByRole('status');
    expect(status).not.toBeNull();
    expect(status?.textContent).toContain('Belum tepat');
    expect(status?.textContent).not.toContain('Benar');
  });

  it('should show Jawaban yang benar: followed by the answer node inside the component', () => {
    const { container } = render(
      <DrillFeedback correct={false} answer={<span lang="ja">ね</span>} onContinue={vi.fn<() => void>()} />,
    );

    const text = container.textContent;
    expect(text).toContain('Jawaban yang benar:');
    expect(text.indexOf('ね')).toBeGreaterThan(text.indexOf('Jawaban yang benar:'));
    const answer = container.querySelector('span[lang="ja"]');
    expect(answer?.textContent).toBe('ね');
  });

  it('should focus the Lanjut button on mount so Enter continues', () => {
    render(
      <DrillFeedback correct={false} answer={<span lang="ja">ね</span>} onContinue={vi.fn<() => void>()} />,
    );

    const button = screen.queryByRole('button', { name: 'Lanjut' });
    expect(button).not.toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('should call onContinue exactly once when Lanjut is clicked twice', () => {
    const onContinue = vi.fn<() => void>();
    render(<DrillFeedback correct={false} answer={<span lang="ja">ね</span>} onContinue={onContinue} />);

    const button = screen.queryByRole('button', { name: 'Lanjut' });
    expect(button).not.toBeNull();
    if (button === null) return;

    fireEvent.click(button);
    expect(onContinue).toHaveBeenCalledTimes(1);

    fireEvent.click(button);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('should not call onContinue by itself after 5 s and wait for Lanjut', () => {
    const onContinue = vi.fn<() => void>();
    render(<DrillFeedback correct={false} answer={<span lang="ja">ね</span>} onContinue={onContinue} />);

    expect(screen.queryByRole('button', { name: 'Lanjut' })).not.toBeNull();

    advance(5000);
    expect(onContinue).toHaveBeenCalledTimes(0);
  });
});
