import oliva from "@/assets/brand/coffeelier-oliva.png";
import creme from "@/assets/brand/coffeelier-creme.png";
import cafe from "@/assets/brand/coffeelier-cafe.png";
import caramelo from "@/assets/brand/coffeelier-caramelo.png";
import mocca from "@/assets/brand/coffeelier-mocca.png";
import { cn } from "@/lib/utils";

type Tone = "oliva" | "creme" | "cafe" | "caramelo" | "mocca";

interface CoffeelierLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  /** Cor do wordmark conforme a paleta da marca. 'creme' p/ fundos escuros. */
  tone?: Tone;
}

const sizeClasses = {
  sm: "h-8",
  md: "h-12",
  lg: "h-16",
  xl: "h-24",
};

const toneSrc: Record<Tone, string> = { oliva, creme, cafe, caramelo, mocca };

export const CoffeelierLogo = ({ className, size = "md", tone = "oliva" }: CoffeelierLogoProps) => {
  return (
    <img
      src={toneSrc[tone]}
      alt="Coffeelier"
      className={cn("object-contain", sizeClasses[size], className)}
    />
  );
};
