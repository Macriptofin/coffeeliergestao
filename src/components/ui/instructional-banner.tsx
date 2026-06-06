import { useState } from "react";
import { Info, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface InstructionalBannerProps {
  title: string;
  description: string[];
  onManualClick?: () => void;
  className?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export const InstructionalBanner = ({
  title,
  description,
  onManualClick,
  className = "",
  collapsible = false,
  defaultCollapsed = false,
}: InstructionalBannerProps) => {
  const [open, setOpen] = useState(!defaultCollapsed);

  return (
    <Alert className={`bg-primary/3 border-primary/8 py-3 ${className}`}>
      <div className="flex items-start justify-between w-full">
        <div className="flex items-start space-x-2 flex-1 min-w-0">
          <Info className="h-4 w-4 text-primary/70 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-medium text-foreground">{title}</h3>
            {open && (
              <AlertDescription className="text-muted-foreground text-xs leading-relaxed mt-1">
                {description.map((line, index) => (
                  <div key={index} className={index > 0 ? "mt-1" : ""}>
                    {line}
                  </div>
                ))}
              </AlertDescription>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
          {onManualClick && open && (
            <Button
              variant="outline"
              size="sm"
              onClick={onManualClick}
              className="h-7 px-2 text-xs border-primary/20 text-primary hover:bg-primary/5"
            >
              <BookOpen className="h-3 w-3 mr-1" />
              Manual
            </Button>
          )}
          {collapsible && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(v => !v)}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              aria-label={open ? "Recolher" : "Expandir"}
            >
              {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
      </div>
    </Alert>
  );
};