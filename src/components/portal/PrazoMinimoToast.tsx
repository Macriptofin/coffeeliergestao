import { toast } from 'sonner';
import { MessageCircle, Mail } from 'lucide-react';

interface ContactOpts {
  whatsappUrl: string;
  contactEmail: string;
}

// Mensagens de prazo mínimo (create_portal_order / request_proposal_change) sempre
// trazem "antecedência" no texto — usado pra decidir quando oferecer contato direto.
export const isPrazoMinimoMessage = (message: string) => message.includes('antecedência');

// Bloqueio de prazo mínimo não é só um erro pra engolir — o cliente pode ter um caso
// real de exceção (evento de última hora). Em vez de só travar, já oferece o canal
// pra negociar direto com a equipe, sem precisar sair procurando contato em outro lugar.
export function showPrazoMinimoToast(message: string, { whatsappUrl, contactEmail }: ContactOpts) {
  toast.custom((t) => (
    <div className="bg-card border border-border rounded-xl shadow-soft p-4 max-w-sm w-full">
      <p className="text-sm font-medium text-foreground">{message}</p>
      <p className="text-xs text-muted-foreground mt-1.5">Precisa de uma exceção? Fale direto com a gente:</p>
      <div className="flex gap-2 mt-3">
        {whatsappUrl && (
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={() => toast.dismiss(t)}
             className="inline-flex items-center gap-1.5 text-xs font-medium bg-[#25D366]/15 text-[#128C7E] px-3 py-1.5 rounded-lg hover:bg-[#25D366]/25">
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </a>
        )}
        {contactEmail && (
          <a href={`mailto:${contactEmail}`} onClick={() => toast.dismiss(t)}
             className="inline-flex items-center gap-1.5 text-xs font-medium bg-muted text-foreground px-3 py-1.5 rounded-lg hover:bg-muted/70">
            <Mail className="h-3.5 w-3.5" /> E-mail
          </a>
        )}
      </div>
    </div>
  ), { duration: 20000 });
}
