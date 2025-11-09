import * as React from 'react';

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

type CommandProps = React.HTMLAttributes<HTMLDivElement>;

export const Command = React.forwardRef<HTMLDivElement, CommandProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  )
);
Command.displayName = 'Command';

type CommandInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  onValueChange?: (value: string) => void;
};

export const CommandInput = React.forwardRef<HTMLInputElement, CommandInputProps>(
  ({ className, onValueChange, onChange, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#F9C300] focus:outline-none focus:ring-1 focus:ring-[#F9C300]',
        className
      )}
      {...props}
      onChange={(event) => {
        onValueChange?.(event.target.value);
        onChange?.(event);
      }}
    />
  )
);
CommandInput.displayName = 'CommandInput';

type CommandListProps = React.HTMLAttributes<HTMLDivElement>;

export const CommandList = React.forwardRef<HTMLDivElement, CommandListProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col', className)}
      {...props}
    />
  )
);
CommandList.displayName = 'CommandList';

type CommandItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string;
  onSelect?: (value: string) => void;
};

export const CommandItem = React.forwardRef<HTMLButtonElement, CommandItemProps>(
  ({ className, children, value, onSelect, type, ...props }, ref) => (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn('w-full text-left text-sm', className)}
      onClick={() => onSelect?.(value)}
      {...props}
    >
      {children}
    </button>
  )
);
CommandItem.displayName = 'CommandItem';

export default Command;
