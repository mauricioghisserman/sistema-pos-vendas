import { Resend } from "resend";

function getResend() { return new Resend(process.env.RESEND_API_KEY); }
const FROM = process.env.RESEND_FROM ?? "Pilar <noreply@soupilar.com.br>";
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://pos-vendas.onrender.com";

export async function enviarMagicLink({
  email,
  nome,
  processoToken,
  magicToken,
}: {
  email: string;
  nome: string;
  processoToken: string;
  magicToken: string;
}) {
  const link = `${BASE_URL}/portal?processo=${processoToken}&magic=${magicToken}`;

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: "Seu acesso ao portal Pilar",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#111">
        <p style="font-size:18px;font-weight:600;margin:0 0 8px">Olá, ${nome}</p>
        <p style="color:#555;margin:0 0 24px">Clique no botão abaixo para acessar o portal de documentação da Pilar. O link é válido por <strong>1 hora</strong>.</p>
        <a href="${link}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500">
          Acessar portal
        </a>
        <p style="color:#999;font-size:12px;margin-top:32px">Se não solicitou este acesso, ignore este email.</p>
      </div>
    `,
  });
}

export async function enviarEmailPendencia({
  email, nome, processoTitulo, processoToken, pendenciaTitulo, pendenciaDescricao, tipo,
}: {
  email: string; nome: string; processoTitulo: string; processoToken: string;
  pendenciaTitulo: string; pendenciaDescricao: string | null; tipo: string;
}) {
  const link = `${BASE_URL}/portal?processo=${processoToken}`;
  const tipoLabel: Record<string, string> = {
    documento: "envio de documento", esclarecimento: "esclarecimento", informacao: "informação",
  };

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Nova pendência — ${processoTitulo}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#111">
        <p style="font-size:18px;font-weight:600;margin:0 0 8px">Olá, ${nome}</p>
        <p style="color:#555;margin:0 0 4px">
          Uma nova pendência de <strong>${tipoLabel[tipo] ?? tipo}</strong> foi criada no processo <strong>${processoTitulo}</strong>:
        </p>
        <div style="background:#f5f5f5;border-radius:8px;padding:12px 16px;margin:16px 0">
          <p style="font-weight:600;margin:0 0 4px">${pendenciaTitulo}</p>
          ${pendenciaDescricao ? `<p style="color:#555;margin:0;font-size:14px">${pendenciaDescricao}</p>` : ""}
        </div>
        <a href="${link}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500">
          Acessar portal
        </a>
        <p style="color:#999;font-size:12px;margin-top:32px">Ao clicar, você precisará confirmar seu email para entrar.</p>
      </div>
    `,
  });
}

export async function enviarEmailInicio({
  email,
  nome,
  processoTitulo,
  processoToken,
  prazo,
}: {
  email: string;
  nome: string;
  processoTitulo: string;
  processoToken: string;
  prazo: string | null;
}) {
  const link = `${BASE_URL}/portal?processo=${processoToken}`;
  const prazoTexto = prazo
    ? new Date(prazo + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Documentação necessária — ${processoTitulo}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#111">
        <p style="font-size:18px;font-weight:600;margin:0 0 8px">Olá, ${nome}</p>
        <p style="color:#555;margin:0 0 8px">
          Você tem documentos a entregar referentes ao processo <strong>${processoTitulo}</strong>.
        </p>
        ${prazoTexto ? `<p style="color:#555;margin:0 0 24px">Prazo de entrega: <strong>${prazoTexto}</strong></p>` : "<br>"}
        <a href="${link}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500">
          Acessar portal de documentação
        </a>
        <p style="color:#999;font-size:12px;margin-top:32px">Ao clicar, você precisará confirmar seu email para entrar.</p>
      </div>
    `,
  });
}
