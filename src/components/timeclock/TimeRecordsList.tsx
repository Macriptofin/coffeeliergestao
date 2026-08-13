import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CalendarIcon, Clock, Trash2, MapPin } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTimeClock } from "@/hooks/useTimeClock";
import { useUserRole } from "@/hooks/useUserRole";

export const TimeRecordsList = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);

  const { records, isLoading, deleteRecord } = useTimeClock(selectedDate);
  const { isAdmin } = useUserRole();

  const getRecordTypeLabel = (type: string) => {
    switch (type) {
      case "entry":
        return "Entrada";
      case "exit":
        return "Saída";
      case "lunch_start":
        return "Início Almoço";
      case "lunch_end":
        return "Fim Almoço";
      default:
        return type;
    }
  };

  const getRecordTypeBadge = (type: string) => {
    switch (type) {
      case "entry":
        return "default";
      case "exit":
        return "secondary";
      case "lunch_start":
        return "outline";
      case "lunch_end":
        return "outline";
      default:
        return "default";
    }
  };

  const handleDeleteClick = (recordId: string) => {
    setRecordToDelete(recordId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (recordToDelete) {
      await deleteRecord(recordToDelete);
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Registros de Ponto</CardTitle>
                <CardDescription>
                  Visualize os registros do dia selecionado
                </CardDescription>
              </div>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {format(selectedDate, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando registros...
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum registro encontrado para esta data.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Observações</TableHead>
                    {isAdmin() && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {record.employees?.full_name}
                      </TableCell>
                      <TableCell>{record.employees?.employee_number}</TableCell>
                      <TableCell>
                        {record.record_time.substring(0, 5)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRecordTypeBadge(record.record_type) as any}>
                          {getRecordTypeLabel(record.record_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {record.location_lat && record.location_lng ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              window.open(
                                `https://www.google.com/maps?q=${record.location_lat},${record.location_lng}`,
                                "_blank"
                              );
                            }}
                          >
                            <MapPin className="h-4 w-4 mr-1" />
                            Ver no mapa
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {record.notes || "-"}
                      </TableCell>
                      {isAdmin() && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(record.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este registro de ponto? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
