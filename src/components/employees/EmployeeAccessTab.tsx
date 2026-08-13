import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { KeyRound, UserPlus, Link2, Unlink } from "lucide-react";
import { UserForm } from "@/components/users/UserForm";
import {
  useUnlinkedUsers,
  useLinkedUserForEmployee,
  useLinkEmployeeUser,
  useUnlinkEmployeeUser,
  useEmployeeLinkStatus,
} from "@/hooks/useEmployeeUserLink";

interface EmployeeAccessTabProps {
  employeeId: string;
  employeeName: string;
  employeeEmail: string | null;
  linkedUserId: string | null;
  onLinked: () => void;
}

export function EmployeeAccessTab({
  employeeId,
  employeeName,
  employeeEmail,
  linkedUserId,
  onLinked,
}: EmployeeAccessTabProps) {
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const { data: currentLinkedUserId, refetch: refetchLinkStatus } = useEmployeeLinkStatus(
    employeeId,
    linkedUserId
  );
  const { data: linkedUser, isPending: loadingLinked } = useLinkedUserForEmployee(currentLinkedUserId);
  const { data: unlinkedUsers = [], isPending: loadingUnlinked } = useUnlinkedUsers(!currentLinkedUserId);
  const linkMutation = useLinkEmployeeUser();
  const unlinkMutation = useUnlinkEmployeeUser();

  if (showCreateUser) {
    return (
      <UserForm
        initialData={{ fullName: employeeName, email: employeeEmail || "" }}
        employeeId={employeeId}
        onCancel={() => setShowCreateUser(false)}
        onSuccess={() => {
          setShowCreateUser(false);
          refetchLinkStatus();
          onLinked();
        }}
      />
    );
  }

  if (currentLinkedUserId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Acesso ao Sistema
          </CardTitle>
          <CardDescription>Este funcionário tem uma conta de login vinculada</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingLinked ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : linkedUser ? (
            <div className="flex items-center justify-between p-4 bg-accent rounded-lg">
              <div>
                <p className="font-medium">
                  {linkedUser.display_name || linkedUser.full_name || linkedUser.email}
                </p>
                <p className="text-sm text-muted-foreground">{linkedUser.email}</p>
              </div>
              <Badge variant="outline">Vinculado</Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Conta vinculada não encontrada.</p>
          )}
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link to="/config#usuarios">Editar Acesso →</Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" className="text-destructive hover:text-destructive">
                  <Unlink className="h-4 w-4 mr-2" />
                  Desvincular
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Desvincular acesso?</AlertDialogTitle>
                  <AlertDialogDescription>
                    A conta de usuário não será excluída, apenas deixa de estar associada a este funcionário.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      unlinkMutation.mutate(employeeId, {
                        onSuccess: () => { refetchLinkStatus(); onLinked(); },
                      })
                    }
                  >
                    Desvincular
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          Acesso ao Sistema
        </CardTitle>
        <CardDescription>
          Este funcionário ainda não tem conta de login. Nem todo funcionário precisa de acesso ao sistema.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button type="button" onClick={() => setShowCreateUser(true)} className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Criar Acesso ao Sistema
        </Button>

        <p className="text-sm text-muted-foreground">ou vincular a uma conta já existente:</p>

        <div className="flex gap-3 items-end">
          <div className="flex-1 space-y-2">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder={loadingUnlinked ? "Carregando..." : "Selecione um usuário"} />
              </SelectTrigger>
              <SelectContent>
                {unlinkedUsers.map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    {u.display_name || u.full_name || u.email} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!selectedUserId || linkMutation.isPending}
            onClick={() =>
              linkMutation.mutate(
                { employeeId, userId: selectedUserId },
                { onSuccess: () => { setSelectedUserId(""); refetchLinkStatus(); onLinked(); } }
              )
            }
          >
            <Link2 className="h-4 w-4 mr-2" />
            Vincular
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
