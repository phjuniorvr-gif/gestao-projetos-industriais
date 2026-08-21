import { Select } from '../ui';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: (string | FilterOption)[];
  className?: string;
}

export function FilterSelect({ label, value, onChange, options, className }: FilterSelectProps) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={className}>
      <option value="">{`${label}: Todos`}</option>
      {options.map((option) => {
        const { value: optionValue, label: optionLabel } =
          typeof option === 'string' ? { value: option, label: option } : option;
        return (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        );
      })}
    </Select>
  );
}
