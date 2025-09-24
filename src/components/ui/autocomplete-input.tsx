import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Check, AlertTriangle } from "lucide-react";

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (item: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  id?: string;
  required?: boolean;
  originalValue?: string; // quando em edição, valor original para suprimir alerta
}

export const AutocompleteInput = ({
  value,
  onChange,
  onSelect,
  suggestions,
  placeholder,
  className,
  id,
  required,
  originalValue,
}: AutocompleteInputProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (value.length > 0) {
      const filtered = suggestions.filter(suggestion =>
        suggestion.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
      setIsOpen(filtered.length > 0);
    } else {
      setFilteredSuggestions([]);
      setIsOpen(false);
    }
    setHighlightedIndex(-1);
  }, [value, suggestions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion);
    onSelect?.(suggestion);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSuggestionClick(filteredSuggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const handleBlur = () => {
    // Delay to allow click events on suggestions
    setTimeout(() => setIsOpen(false), 150);
  };

  const isOriginal = (originalValue ?? '').trim().toLowerCase() === value.trim().toLowerCase();
  const isDuplicateRaw = suggestions.some(s => s.toLowerCase() === value.toLowerCase());
  const showDuplicate = !isOriginal && isDuplicateRaw;

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={() => value.length > 0 && !isOriginal && setIsOpen(filteredSuggestions.length > 0)}
          placeholder={placeholder}
            className={cn(
              className,
              showDuplicate && value.length > 0 && "border-amber-300 focus:border-amber-500"
            )}
          required={required}
        />
        {showDuplicate && value.length > 0 && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
        )}
      </div>
      
      {isOpen && filteredSuggestions.length > 0 && (
        <ul
          ref={listRef}
          className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-md border border-border bg-card shadow-lg"
        >
          {filteredSuggestions.map((suggestion, index) => {
            const isExactMatch = suggestion.toLowerCase() === value.toLowerCase();
            const isHighlighted = index === highlightedIndex;
            
            return (
              <li
                key={suggestion}
                className={cn(
                  "flex items-center justify-between px-3 py-2 text-sm cursor-pointer transition-colors",
                  isHighlighted && "bg-accent",
                  isExactMatch && !isOriginal && "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
                )}
                onClick={() => handleSuggestionClick(suggestion)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <span className="flex-1">{suggestion}</span>
                {isExactMatch && !isOriginal && (
                  <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3" />
                    <span className="text-xs font-medium">Já existe</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};