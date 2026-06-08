/**
 * Servicio de envío de emails mediante Resend (API HTTP).
 * Se usa Resend en lugar de SMTP (nodemailer) porque Render bloquea
 * conexiones SMTP salientes, provocando timeout.
 */
import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private resend: Resend;

  constructor() {
    // La API key de Resend se configura como variable de entorno en Render
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  /**
   * Envía un email de activación con un enlace que contiene el token UUID.
   * Al pulsar el enlace, se activa la cuenta del usuario en GET /users/activate/:token.
   */
  async sendActivationEmail(to: string, nombre: string, token: string) {
    // Construir URL de activación (HOST_API apunta a la URL de Render en producción)
    const activationUrl = `${process.env.HOST_API || 'http://localhost:3000/api/v1'}/users/activate/${token}`;

    const textBody = `Hola ${nombre},\n\nGracias por registrarte. Para activar tu cuenta, abre este enlace:\n\n${activationUrl}\n\nSi no has creado esta cuenta, ignora este correo.`;

    await this.resend.emails.send({
      from: 'Martos Arregla <onboarding@resend.dev>',
      replyTo: 'onboarding@resend.dev',
      to: [to],
      subject: 'Activa tu cuenta — Martos Arregla',
      text: textBody,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #FAF7F2; border-radius: 16px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #2C5F7C, #4A8BAD); padding: 32px 24px; text-align: center;">
            <h1 style="color: #fff; margin: 0; font-size: 22px;">Martos Arregla</h1>
          </div>
          <div style="padding: 32px 24px;">
            <p style="font-size: 16px; color: #1A1A1A;">Hola <strong>${nombre}</strong>,</p>
            <p style="font-size: 15px; color: #6B6B6B; line-height: 1.6;">
              Gracias por registrarte. Para activar tu cuenta, pulsa el siguiente botón:
            </p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${activationUrl}"
                 style="background: #2C5F7C; color: #fff; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
                Activar mi cuenta
              </a>
            </div>
            <p style="font-size: 13px; color: #9E9E9E; line-height: 1.5;">
              Si no has creado esta cuenta, ignora este correo.
            </p>
          </div>
          <div style="background: #F0EDE6; padding: 16px 24px; text-align: center;">
            <p style="font-size: 12px; color: #9E9E9E; margin: 0;">Ayuntamiento de Martos — Plataforma de incidencias</p>
          </div>
        </div>
      `,
    });
  }

  /**
   * Envía un email con un enlace para resetear la contraseña.
   * El enlace abre una página HTML del backend con un formulario.
   */
  async sendResetPasswordEmail(to: string, nombre: string, token: string) {
    const resetUrl = `${process.env.HOST_API || 'http://localhost:3000/api/v1'}/users/reset-password/${token}`;

    const textBody = `Hola ${nombre},\n\nHas solicitado restablecer tu contraseña. Abre este enlace para continuar:\n\n${resetUrl}\n\nEste enlace caduca en 1 hora. Si no lo has solicitado, ignora este correo.`;

    await this.resend.emails.send({
      from: 'Martos Arregla <onboarding@resend.dev>',
      replyTo: 'onboarding@resend.dev',
      to: [to],
      subject: 'Restablecer contraseña — Martos Arregla',
      text: textBody,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #FAF7F2; border-radius: 16px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #2C5F7C, #4A8BAD); padding: 32px 24px; text-align: center;">
            <h1 style="color: #fff; margin: 0; font-size: 22px;">Martos Arregla</h1>
          </div>
          <div style="padding: 32px 24px;">
            <p style="font-size: 16px; color: #1A1A1A;">Hola <strong>${nombre}</strong>,</p>
            <p style="font-size: 15px; color: #6B6B6B; line-height: 1.6;">
              Has solicitado restablecer tu contraseña. Pulsa el siguiente botón para crear una nueva:
            </p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${resetUrl}"
                 style="background: #2C5F7C; color: #fff; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
                Restablecer contraseña
              </a>
            </div>
            <p style="font-size: 13px; color: #9E9E9E; line-height: 1.5;">
              Este enlace caduca en 1 hora. Si no has solicitado el cambio, ignora este correo.
            </p>
          </div>
          <div style="background: #F0EDE6; padding: 16px 24px; text-align: center;">
            <p style="font-size: 12px; color: #9E9E9E; margin: 0;">Ayuntamiento de Martos — Plataforma de incidencias</p>
          </div>
        </div>
      `,
    });
  }
}
