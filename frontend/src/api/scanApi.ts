import axios from 'axios'
import type {
  ImageDetectionResult,
  ScanRequest,
  ScanResult,
  ValidationResult,
} from '../types/scan'

const api = axios.create({ baseURL: '' })

export async function generateScan(req: ScanRequest): Promise<ScanResult> {
  const { data } = await api.post<ScanResult>('/api/scan/generate', req)
  return data
}

export async function validateScan(req: ScanRequest): Promise<ValidationResult> {
  const { data } = await api.post<ValidationResult>('/api/scan/validate', req)
  return data
}

export async function detectImage(
  file: File,
  widthUm: number,
  heightUm: number,
): Promise<ImageDetectionResult> {
  const form = new FormData()
  form.append('file', file)
  form.append('width_um', String(widthUm))
  form.append('height_um', String(heightUm))
  const { data } = await api.post<ImageDetectionResult>('/api/image/detect', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}
