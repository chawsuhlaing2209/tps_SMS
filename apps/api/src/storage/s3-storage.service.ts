import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CreateBucketCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";

@Injectable()
export class S3StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>("S3_ENDPOINT");
    this.bucket = this.config.get<string>("S3_BUCKET") ?? "sms-local";
    this.client = new S3Client({
      region: this.config.get<string>("S3_REGION") ?? "us-east-1",
      endpoint,
      forcePathStyle: Boolean(endpoint?.includes("localhost")),
      credentials: {
        accessKeyId: this.config.get<string>("S3_ACCESS_KEY_ID") ?? "minio",
        secretAccessKey: this.config.get<string>("S3_SECRET_ACCESS_KEY") ?? "minio-password"
      }
    });
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType
        })
      );
    } catch (error) {
      // Fresh dev/self-hosted environments start without the bucket — create
      // it once and retry rather than failing every upload with a 500.
      if (!isNoSuchBucket(error)) {
        throw error;
      }
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket })).catch((createError) => {
        if (!isBucketAlreadyOwned(createError)) {
          throw createError;
        }
      });
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType
        })
      );
    }
  }

  async getObject(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key
      })
    );
    const bytes = await response.Body?.transformToByteArray();
    if (!bytes) {
      throw new Error(`Object not found: ${key}`);
    }
    return Buffer.from(bytes);
  }

  async getObjectIfExists(key: string): Promise<Buffer | null> {
    try {
      return await this.getObject(key);
    } catch {
      return null;
    }
  }
}

function isNoSuchBucket(error: unknown): boolean {
  return (error as { name?: string; Code?: string })?.name === "NoSuchBucket" ||
    (error as { Code?: string })?.Code === "NoSuchBucket";
}

function isBucketAlreadyOwned(error: unknown): boolean {
  const name = (error as { name?: string })?.name;
  return name === "BucketAlreadyOwnedByYou" || name === "BucketAlreadyExists";
}
