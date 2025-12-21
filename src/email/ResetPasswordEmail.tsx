import {
  Button,
  Html,
  Text,
  Img,
  Container,
  Section,
} from '@react-email/components'; 
import * as React from 'react';

interface ResetPasswordEmailProps {
  userName: string;
  resetLink: string;
}

export default function ResetPasswordEmail({
  userName,
  resetLink,
}: ResetPasswordEmailProps) {
  return (
    <Html>
      <Container
        style={{
          maxWidth: '520px',
          margin: '0 auto',
          padding: '24px',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
        }}
      >
        {/* Logo */}
        <Section style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Img
            src="https://res.cloudinary.com/dersjymlc/image/upload/v1766327297/logo-faibook-small_pajwet.png"
            alt="Your App Logo"
            width="120"
            style={{ margin: '0 auto' }}
            className="rounded"
          />
        </Section>

        <Text style={{ fontSize: '16px' }}>Hi {userName},</Text>

        <Text style={{ fontSize: '14px', lineHeight: '1.6' }}>
          We received a request to reset your password. Click the button below
          to set a new password.
        </Text>

        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button
            href={resetLink}
            style={{
              backgroundColor: '#2563eb', // blue-600
              color: '#ffffff',
              padding: '12px 20px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Reset Password
          </Button>
        </Section>

        <Text style={{ fontSize: '13px', lineHeight: '1.6' }}>
          This link will expire in 30 minutes for security reasons.
        </Text>

        <Text style={{ fontSize: '13px', color: '#6b7280' }}>
          If you did not request a password reset, you can safely ignore this
          email. Your password will not be changed.
        </Text>

        <Text style={{ fontSize: '12px', color: '#9ca3af', marginTop: '32px' }}>
          © {new Date().getFullYear()} Your App Name. All rights reserved.
        </Text>
      </Container>
    </Html>
  );
}
