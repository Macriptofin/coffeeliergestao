// Leitor de extrato OFX (SGML/XML) — Nubank, InfinityPay/CloudWalk e afins.
// Extrai as transações (STMTTRN) e o cabeçalho (conta, período, saldo).
// Tolerante a OFX sem tags de fechamento (SGML) e a charsets cp1252/latin1.

export interface OfxTransaction {
  fitid: string;
  posted_date: string;   // YYYY-MM-DD
  amount: number;        // assinado: >0 entrada, <0 saída
  counterparty: string;  // NAME (InfinityPay) ou contraparte extraída do MEMO (Nubank)
  description: string;   // MEMO completo
  raw_type: string;      // TRNTYPE (CREDIT/DEBIT/...)
}

export interface OfxStatement {
  bank_id: string;
  account_id: string;
  org: string;
  period_start: string | null;
  period_end: string | null;
  balance: number | null;
  transactions: OfxTransaction[];
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, 'i'));
  return m ? m[1].trim() : '';
}

function ofxDate(s: string): string | null {
  const m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// Nubank põe tudo no MEMO: "Transferência recebida pelo Pix - NOME - doc - banco ..."
// ou "Compra no débito - ESTABELECIMENTO". Extrai a contraparte pro casamento de regras.
export function counterpartyFromMemo(memo: string): string {
  const pix = memo.match(/Pix - (.+?) - /);
  if (pix) return pix[1].trim();
  const parts = memo.split(' - ');
  if (parts.length >= 2) return parts.slice(1).join(' - ').trim();
  return memo.trim();
}

export function parseOfx(raw: string): OfxStatement {
  const blocks = raw.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi) || [];
  const transactions: OfxTransaction[] = blocks.map((b) => {
    const name = tag(b, 'NAME');
    const memo = tag(b, 'MEMO');
    const amount = parseFloat(tag(b, 'TRNAMT').replace(',', '.'));
    return {
      fitid: tag(b, 'FITID'),
      posted_date: ofxDate(tag(b, 'DTPOSTED')) || '',
      amount: isNaN(amount) ? 0 : amount,
      // InfinityPay: NAME = contraparte, MEMO = natureza ("Recebido"/"Enviado"/"Coffeelier").
      // Nubank: NAME vazio, MEMO carrega tudo.
      counterparty: name ? name : counterpartyFromMemo(memo),
      description: memo || name,
      raw_type: tag(b, 'TRNTYPE'),
    };
  }).filter(t => t.fitid && t.posted_date);

  const bal = parseFloat(tag(raw, 'BALAMT').replace(',', '.'));
  return {
    bank_id: tag(raw, 'BANKID'),
    account_id: tag(raw, 'ACCTID'),
    org: tag(raw, 'ORG'),
    period_start: ofxDate(tag(raw, 'DTSTART')),
    period_end: ofxDate(tag(raw, 'DTEND')),
    balance: isNaN(bal) ? null : bal,
    transactions,
  };
}

// Lê o arquivo: alguns emissores declaram CHARSET:1252 no cabeçalho mas gravam
// UTF-8 (InfinityPay). Tenta UTF-8 estrito primeiro; só cai pra cp1252 se falhar.
export async function readOfxFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('windows-1252').decode(buf);
  }
}
