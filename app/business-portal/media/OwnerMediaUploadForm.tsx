'use client'

import { FormEvent, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TENANT_ID } from '@/lib/constants'

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MENU_TYPES = new Set([...IMAGE_TYPES, 'application/pdf'])
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_MENU_BYTES = 12 * 1024 * 1024

type MediaType = 'logo' | 'cover' | 'gallery' | 'menu'

type Props = {
  businessId: string
  canGallery: boolean
  canMenu: boolean
  defaultType: MediaType
}

function extensionFor(file: File) {
  if (file.type === 'application/pdf') return 'pdf'
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

function friendlyInsertError(message: string, mediaType: MediaType) {
  const lower = message.toLowerCase()
  if (lower.includes('row-level security') || lower.includes('violates')) {
    if (mediaType === 'logo' || mediaType === 'cover') {
      return `A ${mediaType} may already be awaiting review. Remove the pending upload or wait for staff review before submitting another.`
    }
    return 'This upload is not allowed by the current plan, media allowance, or approval state.'
  }
  return 'The file uploaded, but the pending media record could not be created. The temporary file was removed; please try again.'
}

export function OwnerMediaUploadForm({ businessId, canGallery, canMenu, defaultType }: Props) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setSuccess('')

    const form = event.currentTarget
    const fd = new FormData(form)
    const rawType = String(fd.get('media_type') || defaultType)
    const mediaType = rawType as MediaType
    const file = fd.get('file')
    const altText = String(fd.get('alt_text') || '').trim()
    const caption = String(fd.get('caption') || '').trim()

    try {
      if (!['logo', 'cover', 'gallery', 'menu'].includes(mediaType)) throw new Error('Choose a valid media type.')
      if (!(file instanceof File) || !file.size) throw new Error('Choose a file to upload.')
      if (mediaType === 'gallery' && !canGallery) throw new Error('Showcase photos require a Featured or Pro plan.')
      if (mediaType === 'menu' && !canMenu) throw new Error('Restaurant menu uploads require an eligible restaurant plan.')

      if (mediaType === 'menu') {
        if (!MENU_TYPES.has(file.type)) throw new Error('Menus must be a PDF, JPEG, PNG or WebP file.')
        if (file.size > MAX_MENU_BYTES) throw new Error('Menu files must be 12 MB or smaller.')
      } else {
        if (!IMAGE_TYPES.has(file.type)) throw new Error('Use a JPEG, PNG or WebP image.')
        if (file.size > MAX_IMAGE_BYTES) throw new Error('Images must be 8 MB or smaller.')
      }

      const supabase = createClient()
      const { data: userData, error: userError } = await supabase.auth.getUser()
      const user = userData.user
      if (userError || !user) throw new Error('Your session expired. Sign in again before uploading media.')

      const path = `${businessId}/${crypto.randomUUID()}.${extensionFor(file)}`
      const { error: uploadError } = await supabase.storage.from('business-media').upload(path, file, {
        contentType: file.type,
        upsert: false,
      })
      if (uploadError) {
        const message = String(uploadError.message || '').toLowerCase()
        if (message.includes('maximum') || message.includes('too large') || message.includes('payload')) {
          throw new Error(mediaType === 'menu' ? 'Menu files must be 12 MB or smaller.' : 'Images must be 8 MB or smaller.')
        }
        throw new Error('The file could not be uploaded. Please try again.')
      }

      const { error: insertError } = await supabase.from('business_media').insert({
        tenant_id: TENANT_ID,
        business_id: businessId,
        storage_path: path,
        media_type: mediaType,
        mime_type: file.type,
        original_filename: file.name || null,
        alt_text: altText || null,
        caption: caption || null,
        sort_order: 0,
        status: 'pending',
        approval_status: 'pending',
        submitted_by: user.id,
      })

      if (insertError) {
        await supabase.storage.from('business-media').remove([path])
        throw new Error(friendlyInsertError(String(insertError.message || ''), mediaType))
      }

      formRef.current?.reset()
      setSuccess(`${mediaType === 'cover' ? 'Cover image' : mediaType === 'logo' ? 'Logo' : mediaType === 'menu' ? 'Menu' : 'Showcase photo'} uploaded successfully and sent for staff review.`)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to upload media. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return <form ref={formRef} onSubmit={submit} className="form-card">
    {error && <div className="notice warn" role="alert"><strong>Upload failed:</strong> {error}</div>}
    {success && <div className="notice success" role="status">{success}</div>}
    <div className="form-grid">
      <label>Media Type<select name="media_type" defaultValue={defaultType} disabled={busy}><option value="logo">Logo</option><option value="cover">Cover Image</option>{canGallery && <option value="gallery">Showcase Photo</option>}{canMenu && <option value="menu">Restaurant Menu</option>}</select></label>
      <label>File<input type="file" name="file" accept={canMenu ? 'image/jpeg,image/png,image/webp,application/pdf' : 'image/jpeg,image/png,image/webp'} required disabled={busy} /></label>
      <label>Alt Text<input name="alt_text" placeholder="Describe the image for accessibility" disabled={busy} /></label>
      <label>Caption<input name="caption" placeholder="Optional customer-facing caption" disabled={busy} /></label>
    </div>
    <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Uploading…' : 'Upload for Review'}</button>
    <p className="small muted">Uploads go directly to protected storage, then enter staff review. Photos: JPEG, PNG or WebP · maximum 8 MB. Restaurant menus: PDF, JPEG, PNG or WebP · maximum 12 MB. Uploading never publishes automatically.</p>
  </form>
}
