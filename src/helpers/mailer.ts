import nodemailer from 'nodemailer';
import environment from '../environment';

interface CorreoParams {
  para: string;
  asunto: string;
  html: string;
}

function crearTransporte() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: environment.SMTP_USER,
      pass: environment.SMTP_PASS,
    },
  });
}

export async function enviarCorreo({ para, asunto, html }: CorreoParams) {
  const transporter = crearTransporte();
  await transporter.sendMail({
    from: `"Auto Car Remaind" <${environment.SMTP_USER}>`,
    to: para,
    subject: asunto,
    html,
  });
}

export function plantillaBienvenida(nombre: string, link: string): string {
  return `
  <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; border: 1px solid #D3DCE9; border-radius: 16px; overflow: hidden;">
    <div style="background-color: #1D4ED8; padding: 28px 24px; text-align: center;">
      <div style="display: inline-block; background-color: #FFFFFF; color: #1D4ED8; font-weight: 900; font-size: 22px; border-radius: 14px; padding: 10px 18px;">AC</div>
      <h1 style="color: #FFFFFF; font-size: 22px; margin: 14px 0 0;">¡Bienvenido a Auto Car Remaind, ${nombre}!</h1>
    </div>
    <div style="padding: 24px;">
      <p style="color: #334155; font-size: 14px; line-height: 1.6;">
        Tu cuenta fue creada exitosamente. Solo falta un paso: activa tu cuenta
        tocando el siguiente botón:
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${link}" style="display: inline-block; background-color: #1D4ED8; color: #FFFFFF; font-weight: bold; font-size: 15px; text-decoration: none; border-radius: 12px; padding: 14px 28px;">
          Activar mi cuenta
        </a>
      </div>
      <p style="color: #64748B; font-size: 12px; line-height: 1.6;">
        Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
        <a href="${link}" style="color: #1D4ED8;">${link}</a>
      </p>
    </div>
    <div style="background-color: #F1F5F9; padding: 14px 24px; text-align: center;">
      <p style="color: #94A3B8; font-size: 11px; margin: 0;">
        Si no creaste esta cuenta, ignora este correo.
      </p>
    </div>
  </div>`;
}

export async function enviarBienvenidaConActivacion(nombre: string, email: string, link: string) {
  await enviarCorreo({
    para: email,
    asunto: 'Activa tu cuenta de Auto Car Remaind',
    html: plantillaBienvenida(nombre, link),
  });
}
