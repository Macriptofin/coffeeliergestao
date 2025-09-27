import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface HelpTooltipProps {
  content: string;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export const HelpTooltip = ({ content, side = "top", className = "" }: HelpTooltipProps) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center justify-center w-4 h-4 ml-1 text-muted-foreground hover:text-primary transition-colors ${className}`}
            aria-label="Ajuda"
          >
            <Info className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          <p className="text-sm">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};