# Document Upload SOP
**Version:** 2.0 (BLAST FINAL)
**Reference:** gemini.md Rule 7

## Goal
Securely upload and retrieve coach documents (Aadhaar, PAN, certificates) via Supabase Storage.

## Storage Configuration

| Setting | Value |
|---|---|
| Bucket name | `coach-documents` |
| Access type | Private (not public) |
| Max file size | 5MB |
| Allowed MIME types | `application/pdf`, `image/jpeg`, `image/png` |
| URL type | Signed URLs only (time-limited) |

## File Path Convention

```
coach-documents/
  {coach_id}/
    aadhaar.{ext}         # Aadhaar ID document
    pan.{ext}             # PAN card
    certificates/
      cert_{index}.{ext}  # Coaching certificates
```

## Upload Process

```
1. Validate file (MIME type + size) BEFORE uploading
2. Authenticate user (must be logged in admin)
3. Upload to: coach-documents/{coach_id}/{document_type}.{ext}
4. On success: update coaches table with storage path
   - Aadhaar → coaches.document_aadhaar_url
   - PAN → coaches.document_pan_url
   - Certificate → append to coaches.document_certificates (JSONB array)
5. Return success message
```

## Download / View Process

```
1. Authenticate user
2. Generate signed URL (expires in 60 minutes)
3. Return signed URL to browser for direct download
4. NEVER expose raw bucket paths publicly
```

## Validation Rules

```python
ALLOWED_MIME_TYPES = {"application/pdf", "image/jpeg", "image/png"}
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5MB

def validate_document(file_bytes: bytes, mime_type: str) -> None:
    if mime_type not in ALLOWED_MIME_TYPES:
        raise ValueError(f"Invalid file type: {mime_type}. Allowed: PDF, JPG, PNG")
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise ValueError(f"File too large: {len(file_bytes)} bytes. Max: 5MB")
```

## Security Rules

- RLS enforces authenticated access (anonymous requests denied)
- Signed URLs expire after 60 minutes (not permanent links)
- File paths include coach_id to scope access
- Never serve documents at public URLs

## Error Handling

| Error | Response |
|---|---|
| Invalid file type | "Only PDF, JPG, PNG files allowed" |
| File too large | "File must be under 5MB" |
| Upload failed | Log error, show "Upload failed. Please retry." |
| Download failed | Log error, show "Document unavailable. Please re-upload." |

## No Enforcement Policy (Phase 1)

- Can add coach WITHOUT documents
- Can process payroll WITHOUT documents
- Simply show `⚠️ Documents Missing` badge on coach profile
- No blocking behavior
