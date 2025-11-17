import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Factory, User, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CostSourceBadgeProps {
  costSource: 'purchase' | 'production' | 'manual' | null;
  manualPrice?: boolean;
}

export const CostSourceBadge = ({ costSource, manualPrice }: CostSourceBadgeProps) => {
  const getSourceConfig = () => {
    switch (costSource) {
      case 'purchase':
        return {
          icon: ShoppingCart,
          label: 'Compra',
          variant: 'default' as const,
          description: 'Preço calculado por média ponderada das notas fiscais',
          className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
        };
      case 'production':
        return {
          icon: Factory,
          label: 'Produção',
          variant: 'secondary' as const,
          description: 'Custo calculado automaticamente pela composição da ficha técnica',
          className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
        };
      case 'manual':
        return {
          icon: User,
          label: 'Manual',
          variant: 'outline' as const,
          description: 'Preço definido manualmente pelo usuário',
          className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
        };
      default:
        return {
          icon: HelpCircle,
          label: 'Indefinido',
          variant: 'outline' as const,
          description: 'Origem do custo não definida',
          className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
        };
    }
  };

  const config = getSourceConfig();
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={config.variant} className={`${config.className} gap-1 cursor-help`}>
            <Icon className="h-3 w-3" />
            {config.label}
            {manualPrice && costSource !== 'manual' && (
              <span className="text-xs opacity-75">(ajustado)</span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{config.description}</p>
          {manualPrice && costSource !== 'manual' && (
            <p className="text-xs text-muted-foreground mt-1">
              Preço foi ajustado manualmente
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
