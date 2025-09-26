import { useState, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Material {
  id: string;
  name: string;
  code: string;
  category: string;
  usage_unit: string;
}

interface MaterialSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const MaterialSelect = ({ 
  value, 
  onValueChange, 
  placeholder = "Selecione um material...",
  className 
}: MaterialSelectProps) => {
  const [open, setOpen] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("materials")
        .select("id, name, code, category, usage_unit")
        .order("name");

      if (error) throw error;
      setMaterials(data || []);
    } catch (error) {
      console.error("Error loading materials:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar materiais",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedMaterial = materials.find(material => material.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between", className)}
        >
          {selectedMaterial
            ? `${selectedMaterial.code} - ${selectedMaterial.name}`
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command>
          <CommandInput placeholder="Buscar material..." />
          <CommandList>
            <CommandEmpty>
              {loading ? "Carregando..." : "Nenhum material encontrado."}
            </CommandEmpty>
            <CommandGroup>
              {materials.map((material) => (
                <CommandItem
                  key={material.id}
                  value={`${material.code} ${material.name}`}
                  onSelect={() => {
                    onValueChange(material.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === material.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <div className="font-medium">
                      {material.code} - {material.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {material.category} • {material.usage_unit}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};