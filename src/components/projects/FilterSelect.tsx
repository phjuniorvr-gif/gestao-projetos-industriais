import { Select } from '../ui';

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}

export function FilterSelect({ label, value, onChange, options }: FilterSelectProps) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">{`${label}: Todos`}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </Select>
  );
}
