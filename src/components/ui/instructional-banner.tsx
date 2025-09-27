import { Info, BookOpen } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface InstructionalBannerProps {
  title: string;
  description: string[];
  onManualClick?: () => void;
  className?: string;
}

export const InstructionalBanner = ({ 
  title, 
  description, 
  onManualClick,
  className = "" 
}: InstructionalBannerProps) => {
  return (
    <Alert className={`bg-primary/3 border-primary/8 py-3 ${className}`}>
      <div className="flex items-start justify-between w-full">
        <div className="flex items-start space-x-2 flex-1">
          <Info className="h-4 w-4 text-primary/70 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-xs font-medium text-foreground mb-1">{title}</h3>
            <AlertDescription className="text-muted-foreground text-xs leading-relaxed">
              {description.map((line, index) => (
                <div key={index} className={index > 0 ? "mt-1" : ""}>
                  {line}
                </div>
              ))}
            </AlertDescription>
          </div>
        </div>
        
        {onManualClick && (
          <Button
            variant="outline"
            size="sm"
            onClick={onManualClick}
            className="ml-3 h-7 px-2 text-xs border-primary/20 text-primary hover:bg-primary/5 flex-shrink-0"
          >
            <BookOpen className="h-3 w-3 mr-1" />
            📘 Manual Completo
          </Button>
        )}
      </div>
    </Alert>
  );
};