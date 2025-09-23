import coffeelierLogo from "@/assets/coffeelier-logo.png";
import { cn } from "@/lib/utils";

interface CoffeelierLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "h-8",
  md: "h-12",
  lg: "h-16",
  xl: "h-24",
};

export const CoffeelierLogo = ({ className, size = "md" }: CoffeelierLogoProps) => {
  return (
    <img
      src={coffeelierLogo}
      alt="Coffeelier - Gestão de Confeitaria"
      className={cn("object-contain", sizeClasses[size], className)}
    />
  );
};