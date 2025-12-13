import { Button, Html, Text } from '@react-email/components';
import * as React from 'react';

interface ResetPasswordEmailProps {
  userName: string;
  resetLink: string;
}

export default function ResetPasswordEmail({ userName, resetLink }: ResetPasswordEmailProps) {
  return (
    <Html>
      <Text>Hai, {userName}!</Text>
      <Text>Anda meminta reset kata sandi. Klik tombol di bawah untuk melanjutkan:</Text>
      <Button href={resetLink} style={{ padding: '10px 20px', backgroundColor: '#007bff', color: '#fff', borderRadius: '5px' }}>
        Reset Kata Sandi
      </Button>
      <Text>Jika Anda tidak meminta reset ini, abaikan email ini.</Text>
    </Html>
  );
}