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
    <Alert className={`bg-green-50 border-green-200 ${className}`}>
      <div className="flex items-start justify-between w-full">
        <div className="flex items-start space-x-3 flex-1">
          <Info className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">{title}</h3>
            <AlertDescription className="text-gray-700 text-sm leading-relaxed">
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
            className="ml-4 border-green-300 text-green-700 hover:bg-green-100 flex-shrink-0"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            📘 Manual Completo
          </Button>
        )}
      </div>
    </Alert>
  );
};