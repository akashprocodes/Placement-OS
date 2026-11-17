import uuid
import os
import re
from typing import Optional, List, Tuple
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.resume import Resume

import io
import zipfile
import xml.etree.ElementTree as ET
import pypdf

MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
    "application/octet-stream",
}

COMMON_TECH_SKILLS = [
    "Python", "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "FastAPI",
    "Django", "Flask", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Docker",
    "Kubernetes", "AWS", "GCP", "Azure", "Git", "GraphQL", "REST", "CI/CD",
    "C++", "Java", "Go", "Rust", "HTML", "CSS", "Tailwind"
]


def validate_resume_upload(
    filename: str,
    content_type: str,
    file_size: int,
    file_bytes: Optional[bytes] = None,
) -> None:
    """Validate resume file size, extension, and binary signatures before processing."""
    if not filename or not filename.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume filename must not be empty."
        )

    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file extension '{ext}'. Only .pdf, .docx, and .txt files are accepted."
        )

    if file_size > MAX_RESUME_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="File exceeds maximum allowed size of 5 MB."
        )

    if file_size <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty."
        )

    # Magic byte and format integrity validation when bytes are available
    if file_bytes is not None:
        if ext == ".pdf":
            # PDF specifications require %PDF- header in the first 1024 bytes
            if b"%PDF-" not in file_bytes[:1024]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File content does not match PDF format (missing PDF header signature)."
                )

        elif ext == ".docx":
            # DOCX is a zip package starting with standard PK magic bytes
            if not (file_bytes.startswith(b"PK\x03\x04") or file_bytes.startswith(b"PK\x05\x06") or file_bytes.startswith(b"PK\x07\x08")):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File content does not match DOCX format (invalid ZIP archive header)."
                )
            try:
                with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
                    if "word/document.xml" not in zf.namelist():
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="File content does not match DOCX format (missing word/document.xml)."
                        )
            except zipfile.BadZipFile:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File content does not match DOCX format (corrupted ZIP archive)."
                )

        elif ext == ".txt":
            # Text files must not contain binary null bytes indicating an executable or binary payload
            if b"\x00" in file_bytes[:8192]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File content contains binary data and is not a valid text file."
                )


def extract_resume_content(
    file_bytes: bytes,
    filename: str,
    content_type: str,
) -> Tuple[Optional[str], Optional[List[str]], Optional[str]]:
    """
    Safely extract plain text and detect core competencies using genuine parsers.
    Handles uncompressed PDF, compressed FlateDecode PDF, image-only/scanned PDF,
    structured DOCX (WordprocessingML), and multi-encoding plain text.
    """
    ext = os.path.splitext(filename)[1].lower()
    extracted_text: Optional[str] = None
    summary: Optional[str] = None

    if ext == ".txt":
        raw_str = None
        for enc in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
            try:
                raw_str = file_bytes.decode(enc)
                break
            except (UnicodeDecodeError, LookupError):
                continue

        if raw_str is not None:
            cleaned = raw_str.strip()
            cleaned = re.sub(r"[ \t]+", " ", cleaned)
            cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
            extracted_text = cleaned[:50000] if len(cleaned) > 0 else None
        else:
            extracted_text = None
            summary = "Unable to decode text file with supported encodings."

    elif ext == ".pdf":
        try:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            if reader.is_encrypted:
                try:
                    decrypted = reader.decrypt("")
                    if decrypted == 0:
                        return None, None, "Encrypted or password-protected PDF cannot be processed without password."
                except Exception:
                    return None, None, "Encrypted or password-protected PDF cannot be processed."

            pages_text: List[str] = []
            for page in reader.pages:
                p_text = page.extract_text() or ""
                p_cleaned = p_text.strip()
                if p_cleaned:
                    pages_text.append(p_cleaned)

            if pages_text:
                combined = "\n\n".join(pages_text).strip()
                combined = re.sub(r"[ \t]+", " ", combined)
                combined = re.sub(r"\n{3,}", "\n\n", combined)
                extracted_text = combined[:50000] if len(combined) > 0 else None
            else:
                # Page exists but 0 extractable text: Scanned or image-only PDF
                extracted_text = None
                summary = "Scanned or image-only PDF detected (no machine-readable text found). OCR is required."
        except Exception:
            extracted_text = None
            summary = "Failed to parse PDF document structure."

    elif ext == ".docx":
        try:
            with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
                if "word/document.xml" not in zf.namelist():
                    extracted_text = None
                    summary = "DOCX archive missing main document body."
                else:
                    xml_data = zf.read("word/document.xml")
                    tree = ET.fromstring(xml_data)
                    paragraphs: List[str] = []
                    for p in tree.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"):
                        texts = [t.text for t in p.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t") if t.text]
                        if texts:
                            p_str = "".join(texts).strip()
                            if p_str:
                                paragraphs.append(p_str)

                    if paragraphs:
                        combined = "\n\n".join(paragraphs).strip()
                        combined = re.sub(r"[ \t]+", " ", combined)
                        combined = re.sub(r"\n{3,}", "\n\n", combined)
                        extracted_text = combined[:50000] if len(combined) > 0 else None
                    else:
                        extracted_text = None
                        summary = "DOCX contains no extractable text in body paragraphs."
        except Exception:
            extracted_text = None
            summary = "Failed to parse DOCX document structure."

    # Detect skills from text if extractable content is present
    detected_skills: List[str] = []
    if extracted_text and extracted_text.strip():
        upper_text = extracted_text.lower()
        for skill in COMMON_TECH_SKILLS:
            if re.search(r"\b" + re.escape(skill.lower()) + r"\b", upper_text):
                detected_skills.append(skill)

        if detected_skills:
            summary = f"Detected competencies: {', '.join(detected_skills[:8])}"
        elif not summary:
            summary = f"Extracted {len(extracted_text)} characters of text."
    elif not summary:
        summary = "No machine-readable text could be extracted from this document."

    return extracted_text, detected_skills or None, summary


async def save_uploaded_resume(
    db: AsyncSession,
    user_id: uuid.UUID,
    filename: str,
    content_type: str,
    file_bytes: bytes
) -> Resume:
    """Validate, parse, and persist a resume record for the authenticated user."""
    file_size = len(file_bytes)
    validate_resume_upload(filename, content_type, file_size, file_bytes=file_bytes)

    extracted_text, skills, summary = extract_resume_content(file_bytes, filename, content_type)

    resume = Resume(
        id=uuid.uuid4(),
        user_id=user_id,
        filename=filename,
        file_size_bytes=file_size,
        file_type=content_type,
        extracted_text=extracted_text,
        skills=skills,
        experience_summary=summary,
    )
    db.add(resume)
    await db.commit()
    await db.refresh(resume)
    return resume


async def create_resume_from_payload(
    db: AsyncSession,
    user_id: uuid.UUID,
    filename: str,
    file_type: str,
    raw_text: Optional[str] = None,
    content_base64: Optional[str] = None,
) -> Resume:
    """Create and persist a resume record from JSON upload payload."""
    import base64
    if content_base64:
        try:
            file_bytes = base64.b64decode(content_base64)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid base64 encoding in content_base64."
            )
    elif raw_text:
        file_bytes = raw_text.encode("utf-8")
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either raw_text or content_base64 must be provided."
        )

    return await save_uploaded_resume(
        db=db,
        user_id=user_id,
        filename=filename,
        content_type=file_type,
        file_bytes=file_bytes,
    )


async def list_user_resumes(db: AsyncSession, user_id: uuid.UUID) -> List[Resume]:
    """Retrieve all resumes owned by the authenticated user."""
    stmt = select(Resume).where(Resume.user_id == user_id).order_by(Resume.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_user_resume_by_id(db: AsyncSession, user_id: uuid.UUID, resume_id: uuid.UUID) -> Optional[Resume]:
    """Retrieve a single resume with strict user ownership enforcement."""
    stmt = select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
