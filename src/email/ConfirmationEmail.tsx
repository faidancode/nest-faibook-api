import {
  Button,
  Html,
  Text,
  Img,
  Container,
  Section,
} from '@react-email/components';
import * as React from 'react';

interface ConfirmationEmailProps {
  userName: string;
  type: 'Web' | 'Mobile';
  confirmLink?: string;
  confirmPin?: string;
}

export default function ConfirmationEmail({
  userName,
  type,
  confirmLink,
  confirmPin,
}: ConfirmationEmailProps) {
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
          />
        </Section>

        <Text style={{ fontSize: '16px' }}>Hi {userName},</Text>

        <Text style={{ fontSize: '14px', lineHeight: '1.6' }}>
          Please confirm your email address to complete your registration.
        </Text>

        {/* WEB → Link */}
        {type === 'Web' && confirmLink && (
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button
              href={confirmLink}
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                padding: '12px 20px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Confirm Email
            </Button>
          </Section>
        )}

        {/* MOBILE → PIN */}
        {type === 'Mobile' && confirmPin && (
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Text style={{ fontSize: '14px', marginBottom: '8px' }}>
              Enter this verification code in the app:
            </Text>
            <Text
              style={{
                fontSize: '28px',
                fontWeight: 700,
                letterSpacing: '6px',
              }}
            >
              {confirmPin}
            </Text>
          </Section>
        )}

        <Text style={{ fontSize: '13px', lineHeight: '1.6' }}>
          This confirmation will expire in 60 minutes for security reasons.
        </Text>

        <Text style={{ fontSize: '13px', color: '#6b7280' }}>
          If you did not create an account, you can safely ignore this email.
        </Text>

        <Text style={{ fontSize: '12px', color: '#9ca3af', marginTop: '32px' }}>
          © {new Date().getFullYear()} Your App Name. All rights reserved.
        </Text>
      </Container>
    </Html>
  );
}
