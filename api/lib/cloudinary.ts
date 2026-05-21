import { v2 as cloudinary } from 'cloudinary'

export function initCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
  })
  return cloudinary
}

// Upload base64 image, returns secure URL
export async function uploadBase64Image(
  base64Data: string,
  folder: string = 'picdiary'
): Promise<string> {
  const cld = initCloudinary()
  const dataUri = base64Data.startsWith('data:')
    ? base64Data
    : `data:image/png;base64,${base64Data}`

  const result = await cld.uploader.upload(dataUri, {
    folder,
    transformation: [
      { quality: 'auto:good' },
      { fetch_format: 'auto' },
    ],
  })
  return result.secure_url
}

// Upload from URL
export async function uploadFromUrl(url: string, folder: string = 'picdiary'): Promise<string> {
  const cld = initCloudinary()
  const result = await cld.uploader.upload(url, {
    folder,
    transformation: [{ quality: 'auto:good' }],
  })
  return result.secure_url
}

// Delete image by public_id extracted from URL
export async function deleteImage(url: string): Promise<void> {
  const cld = initCloudinary()
  // Extract public_id from URL: .../picdiary/abc123.jpg -> picdiary/abc123
  const match = url.match(/\/([^/]+\/[^/]+)\.[a-z]+$/)
  if (match) {
    await cld.uploader.destroy(match[1])
  }
}
