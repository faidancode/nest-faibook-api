import { createPool } from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { and, eq } from 'drizzle-orm';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { randomUUID } from 'crypto';
import * as schema from '../infra/drizzle/schema';

const USER_ID = '19dd58cb-56fb-4c0e-85bd-9765735d6159';

type AddressSeed = {
  label: string;
  recipientName: string;
  recipientPhone: string;
  street: string;
  subdistrict: string;
  district: string;
  city: string;
  province: string;
  postalCode: string;
  isPrimary?: boolean;
};

const addressSeeds: AddressSeed[] = [
  {
    label: 'Rumah Utama',
    recipientName: 'Budi Santoso',
    recipientPhone: '08120001111',
    street: 'Jl. Melati No. 12',
    subdistrict: 'Kembangan',
    district: 'Kembangan',
    city: 'Jakarta Barat',
    province: 'DKI Jakarta',
    postalCode: '11610',
    isPrimary: true,
  },
  {
    label: 'Kantor Pusat',
    recipientName: 'Budi Santoso',
    recipientPhone: '08120002222',
    street: 'Jl. Jend. Sudirman Kav. 45',
    subdistrict: 'Karet',
    district: 'Setiabudi',
    city: 'Jakarta Selatan',
    province: 'DKI Jakarta',
    postalCode: '12930',
  },
  {
    label: 'Gudang Timur',
    recipientName: 'Sari Wijaya',
    recipientPhone: '08120003333',
    street: 'Jl. Raya Cakung No. 7',
    subdistrict: 'Cakung Barat',
    district: 'Cakung',
    city: 'Jakarta Timur',
    province: 'DKI Jakarta',
    postalCode: '13910',
  },
  {
    label: 'Gudang Serpong',
    recipientName: 'Rudi Hartono',
    recipientPhone: '08120004444',
    street: 'Jl. Raya Serpong KM 8',
    subdistrict: 'Serpong',
    district: 'Serpong',
    city: 'Tangerang Selatan',
    province: 'Banten',
    postalCode: '15310',
  },
  {
    label: 'Rumah Orang Tua',
    recipientName: 'Sinta Lestari',
    recipientPhone: '08120005555',
    street: 'Jl. Diponegoro No. 18',
    subdistrict: 'Menteng',
    district: 'Menteng',
    city: 'Jakarta Pusat',
    province: 'DKI Jakarta',
    postalCode: '10310',
  },
  {
    label: 'Apartemen Sudirman',
    recipientName: 'Andien Prameswari',
    recipientPhone: '08120006666',
    street: 'Jl. Prof. Dr. Satrio No. 5',
    subdistrict: 'Kuningan',
    district: 'Setiabudi',
    city: 'Jakarta Selatan',
    province: 'DKI Jakarta',
    postalCode: '12940',
  },
  {
    label: 'Villa Puncak',
    recipientName: 'Rafi Haidar',
    recipientPhone: '08120007777',
    street: 'Jl. Raya Puncak KM 87',
    subdistrict: 'Cisarua',
    district: 'Cisarua',
    city: 'Bogor',
    province: 'Jawa Barat',
    postalCode: '16750',
  },
  {
    label: 'Rumah Bandung',
    recipientName: 'Maya Pratiwi',
    recipientPhone: '08120008888',
    street: 'Jl. Riau No. 21',
    subdistrict: 'Cicendo',
    district: 'Bandung Wetan',
    city: 'Bandung',
    province: 'Jawa Barat',
    postalCode: '40115',
  },
  {
    label: 'Workshop Ciracas',
    recipientName: 'Farhan Yusuf',
    recipientPhone: '08120009999',
    street: 'Jl. Raya Bogor KM 26',
    subdistrict: 'Ciracas',
    district: 'Ciracas',
    city: 'Jakarta Timur',
    province: 'DKI Jakarta',
    postalCode: '13740',
  },
  {
    label: 'Outlet Bekasi',
    recipientName: 'Lala Putri',
    recipientPhone: '08120001010',
    street: 'Jl. Ahmad Yani No. 10',
    subdistrict: 'Bekasi Selatan',
    district: 'Bekasi Selatan',
    city: 'Bekasi',
    province: 'Jawa Barat',
    postalCode: '17144',
  },
  {
    label: 'Outlet Depok',
    recipientName: 'Yoga Mahendra',
    recipientPhone: '08120001112',
    street: 'Jl. Margonda Raya No. 103',
    subdistrict: 'Pancoran Mas',
    district: 'Pancoran Mas',
    city: 'Depok',
    province: 'Jawa Barat',
    postalCode: '16431',
  },
  {
    label: 'Rumah Surabaya',
    recipientName: 'Ika Puspita',
    recipientPhone: '08120001234',
    street: 'Jl. Darmo Kali No. 27',
    subdistrict: 'Wonokromo',
    district: 'Wonokromo',
    city: 'Surabaya',
    province: 'Jawa Timur',
    postalCode: '60241',
  },
  {
    label: 'Rumah Bali',
    recipientName: 'Anwar Ridwan',
    recipientPhone: '08120001345',
    street: 'Jl. Bypass Ngurah Rai No. 88',
    subdistrict: 'Kuta',
    district: 'Kuta',
    city: 'Badung',
    province: 'Bali',
    postalCode: '80361',
  },
  {
    label: 'Cabang Medan',
    recipientName: 'Tania Gunawan',
    recipientPhone: '08120001456',
    street: 'Jl. Gatot Subroto No. 15',
    subdistrict: 'Medan Petisah',
    district: 'Medan Petisah',
    city: 'Medan',
    province: 'Sumatera Utara',
    postalCode: '20111',
  },
  {
    label: 'Cabang Makassar',
    recipientName: 'Nando Ramadhan',
    recipientPhone: '08120001567',
    street: 'Jl. Pettarani No. 2',
    subdistrict: 'Panakkukang',
    district: 'Panakkukang',
    city: 'Makassar',
    province: 'Sulawesi Selatan',
    postalCode: '90222',
  },
];

function ensureEnvLoaded() {
  const cwd = process.cwd();
  loadEnv({ path: resolve(cwd, '.env.local') });
  loadEnv({ path: resolve(cwd, '.env') });
}

async function main() {
  ensureEnvLoaded();
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER as string;
  const password = process.env.DB_PASSWORD as string;
  const database = process.env.DB_NAME || 'bookstore';

  if (!user) {
    throw new Error('DB_USER is required');
  }

  const pool = await createPool({ host, user, password, database });
  const db = drizzle(pool, { schema, mode: 'default' });

  try {
    let inserted = 0;
    for (const seed of addressSeeds) {
      const existing = await db.query.addresses.findFirst({
        where: and(
          eq(schema.addresses.userId, USER_ID),
          eq(schema.addresses.label, seed.label),
        ),
      });

      if (existing) {
        continue;
      }

      await db.insert(schema.addresses).values({
        id: randomUUID(),
        userId: USER_ID,
        label: seed.label,
        recipientName: seed.recipientName,
        recipientPhone: seed.recipientPhone,
        street: seed.street,
        subdistrict: seed.subdistrict,
        district: seed.district,
        city: seed.city,
        province: seed.province,
        postalCode: seed.postalCode,
        isPrimary: seed.isPrimary ?? false,
      });

      inserted += 1;
    }

    console.log(`Addresses seeding done. Inserted: ${inserted}.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
