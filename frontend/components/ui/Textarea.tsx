import { TextareaHTMLAttributes, forwardRef } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className = '', ...props }, ref) => {
    const base =
      'w-full px-[14px] py-[10px] bg-[#FDFBF5] border rounded text-[14px] font-normal text-ink-800 ' +
      'placeholder:text-ink-400 outline-none transition-shadow resize-y ' +
      'focus:border-primary-600 focus:shadow-focus ' +
      'disabled:bg-surface-subtle disabled:text-ink-400 disabled:cursor-not-allowed';
    const borderCls = error ? 'border-danger' : 'border-border-strong';

    return (
      <textarea
        ref={ref}
        className={`${base} ${borderCls} ${className}`.trim()}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
