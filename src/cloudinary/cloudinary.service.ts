import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as streamifier from 'streamifier';
import type { Env } from '../config/env.schema';

@Injectable()
export class CloudinaryService {
  constructor(private readonly configService: ConfigService<Env, true>) {
    cloudinary.config({
      cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME', {
        infer: true,
      }),
      api_key: this.configService.get('CLOUDINARY_API_KEY', {
        infer: true,
      }),
      api_secret: this.configService.get('CLOUDINARY_API_SECRET', {
        infer: true,
      }),
    });
  }

  async uploadImage(file: Express.Multer.File, folder: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        },
        (error, result: UploadApiResponse) => {
          if (error) {
            return reject(
              new Error(
                error instanceof Error
                  ? error.message
                  : typeof error === 'object'
                    ? JSON.stringify(error)
                    : String(error),
              ),
            );
          }
          resolve(result?.secure_url || '');
        },
      );
      const stream = streamifier.createReadStream(file.buffer);
      stream.pipe(uploadStream);
    });
  }
}
