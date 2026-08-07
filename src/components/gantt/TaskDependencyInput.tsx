import { useState } from 'react';
import { Input } from '../ui';
import type { Task } from '../../types';
import { formatPredecessors, parsePredecessors, validateTaskDependencies } from '../../utils';
import type { DependencyValidation } from '../../utils';

interface TaskDependencyInputProps {
  value: number[];
  allTasks: Task[];
  taskRowNumber: number;
  onChange: (numbers: number[], validation: DependencyValidation) => void;
}

export function TaskDependencyInput({ value, allTasks, taskRowNumber, onChange }: TaskDependencyInputProps) {
  const [text, setText] = useState(formatPredecessors(value));
  const [errors, setErrors] = useState<string[]>([]);

  function handleBlur() {
    const numbers = parsePredecessors(text);
    const candidateTasks = allTasks.map((t) =>
      t.rowNumber === taskRowNumber ? { ...t, predecessorRowNumbers: numbers } : t,
    );
    const validation = validateTaskDependencies(taskRowNumber, candidateTasks);
    setErrors(validation.errors);
    onChange(numbers, validation);
  }

  return (
    <div className="space-y-1">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        placeholder="Ex: 4, 7"
        className="w-full"
      />
      {errors.map((error) => (
        <p key={error} className="text-xs text-status-delayed">
          {error}
        </p>
      ))}
    </div>
  );
}
