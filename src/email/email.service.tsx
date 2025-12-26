// src/email/email.service.ts

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Resend } from 'resend';
import { render } from '@react-email/render'; // Import fungsi render
import * as React from 'react';
import { ConfigService } from '@nestjs/config'; // Untuk mengambil API Key
import ResetPasswordEmail from './ResetPasswordEmail';
import ConfirmationEmail from './ConfirmationEmail';

@Injectable()
export class EmailService {
  private resend: Resend;
  private readonly fromEmail: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'RESEND_API_KEY is not configured.',
      );
    }
    this.resend = new Resend(apiKey);
    // Ganti dengan email pengirim terverifikasi Anda
    this.fromEmail = 'noreply@faidancode.web.id';
  }

  // Metode untuk mengirim Email Reset Password
  async sendResetPasswordEmail(
    to: string,
    resetLink: string,
    userName: string,
  ) {
    // 1. RENDERING: Render Komponen React Email ke HTML string
    const emailHtml = await render(
      <ResetPasswordEmail userName={userName} resetLink={resetLink} />,
      {
        pretty: true, // Output HTML yang mudah dibaca
      },
    );

    // 2. PENGIRIMAN: Panggil Resend API
    try {
      const { data, error } = await this.resend.emails.send({
        from: `Faibook <${this.fromEmail}>`,
        to: [to],
        subject: 'Reset Your Password',
        html: emailHtml, // Gunakan HTML yang sudah di-render
        // Optional: tambahkan headers untuk dev mode
        // headers: { 'X-Resend-Development-Mode': 'true' }
      });

      if (error) {
        throw new InternalServerErrorException(error.message);
      }

      console.log('Reset Password Email sent successfully:', data);
      return true;
    } catch (e) {
      console.error('Failed to send email via Resend:', e);
      // Lemparkan error yang sesuai untuk NestJS
      throw new InternalServerErrorException(
        'Failed to send reset password email.',
      );
    }
  }

  // Tambahkan metode untuk Konfirmasi Email di sini...
  async sendEmailConfirmationLink(
    to: string,
    userName: string,
    type: 'Web' | 'Mobile',
    confirmLink?: string,
  ) {
    // 1. RENDERING: Render Komponen React Email ke HTML string
    const emailHtml = await render(
      <ConfirmationEmail
        userName={userName}
        type={type}
        confirmLink={confirmLink}
      />,
      {
        pretty: true, // Output HTML yang mudah dibaca
      },
    );

    // 2. PENGIRIMAN: Panggil Resend API
    try {
      const { data, error } = await this.resend.emails.send({
        from: `Faibook <${this.fromEmail}>`,
        to: [to],
        subject: 'Reset Your Password',
        html: emailHtml, // Gunakan HTML yang sudah di-render
        // Optional: tambahkan headers untuk dev mode
        // headers: { 'X-Resend-Development-Mode': 'true' }
      });

      if (error) {
        throw new InternalServerErrorException(error.message);
      }

      console.log('Reset Password Email sent successfully:', data);
      return true;
    } catch (e) {
      console.error('Failed to send email via Resend:', e);
      // Lemparkan error yang sesuai untuk NestJS
      throw new InternalServerErrorException(
        'Failed to send reset password email.',
      );
    }
  }

  async sendEmailConfirmationPin(
    to: string,
    type: 'Web' | 'Mobile',
    userName: string,
    confirmPin?: string,
  ) {
    // 1. RENDERING: Render Komponen React Email ke HTML string
    const emailHtml = await render(
      <ConfirmationEmail
        userName={userName}
        type={type}
        confirmPin={confirmPin}
      />,
      {
        pretty: true, // Output HTML yang mudah dibaca
      },
    );

    // 2. PENGIRIMAN: Panggil Resend API
    try {
      const { data, error } = await this.resend.emails.send({
        from: `Faibook <${this.fromEmail}>`,
        to: [to],
        subject: 'Confirm Your Account',
        html: emailHtml, // Gunakan HTML yang sudah di-render
        // Optional: tambahkan headers untuk dev mode
        // headers: { 'X-Resend-Development-Mode': 'true' }
      });

      if (error) {
        throw new InternalServerErrorException(error.message);
      }

      console.log('Confirmation Email sent successfully:', data);
      return true;
    } catch (e) {
      console.error('Failed to send email via Resend:', e);
      // Lemparkan error yang sesuai untuk NestJS
      throw new InternalServerErrorException(
        'Failed to send confirmation email.',
      );
    }
  }
}
