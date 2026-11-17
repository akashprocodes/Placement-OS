import io
import zlib
import zipfile
import base64
import pytest
from httpx import AsyncClient

from app.models.resume import Resume
from app.services.resume_service import (
    extract_resume_content,
    validate_resume_upload,
    create_resume_from_payload,
)


def make_synthetic_pdf(text_streams: list[str], compress: bool = False) -> bytes:
    """Helper to generate a structurally valid minimal PDF 1.4 in-memory without external libraries."""
    header = b"%PDF-1.4\n"
    combined_stream_text = " ".join(f"({t}) Tj" for t in text_streams)
    stream_content = f"BT /F1 12 Tf 72 712 Td {combined_stream_text} ET"

    if compress:
        comp_stream = zlib.compress(stream_content.encode("latin-1"))
        obj4 = (
            f"4 0 obj\n<< /Filter /FlateDecode /Length {len(comp_stream)} >>\nstream\n".encode("latin-1")
            + comp_stream
            + b"\nendstream\nendobj\n"
        )
    else:
        obj4 = f"4 0 obj\n<< /Length {len(stream_content)} >>\nstream\n{stream_content}\nendstream\nendobj\n".encode("latin-1")

    obj1 = b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    obj2 = b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
    obj3 = b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n"
    obj5 = b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"

    offsets = [
        0,
        len(header),
        len(header) + len(obj1),
        len(header) + len(obj1) + len(obj2),
        len(header) + len(obj1) + len(obj2) + len(obj3),
        len(header) + len(obj1) + len(obj2) + len(obj3) + len(obj4),
    ]
    xref_off = offsets[-1] + len(obj5)
    xref = f"xref\n0 6\n0000000000 65535 f \n" + "".join(f"{off:010d} 00000 n \n" for off in offsets[1:])
    trailer = f"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref_off}\n%%EOF\n"

    return header + obj1 + obj2 + obj3 + obj4 + obj5 + xref.encode("latin-1") + trailer.encode("latin-1")


def make_synthetic_image_only_pdf() -> bytes:
    """Helper to generate a structurally valid PDF containing 1 page but zero text operators (scanned PDF)."""
    header = b"%PDF-1.4\n"
    obj1 = b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    obj2 = b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
    obj3 = b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n"
    obj4 = b"4 0 obj\n<< /Length 0 >>\nstream\n\nendstream\nendobj\n"

    offsets = [
        0,
        len(header),
        len(header) + len(obj1),
        len(header) + len(obj1) + len(obj2),
        len(header) + len(obj1) + len(obj2) + len(obj3),
    ]
    xref_off = offsets[-1] + len(obj4)
    xref = f"xref\n0 5\n0000000000 65535 f \n" + "".join(f"{off:010d} 00000 n \n" for off in offsets[1:])
    trailer = f"trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n{xref_off}\n%%EOF\n"

    return header + obj1 + obj2 + obj3 + obj4 + xref.encode("latin-1") + trailer.encode("latin-1")


def make_synthetic_docx(paragraphs: list[str]) -> bytes:
    """Helper to generate a structurally valid DOCX ZIP package with WordprocessingML paragraphs."""
    bio = io.BytesIO()
    with zipfile.ZipFile(bio, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="xml" ContentType="application/xml"/>'
            "</Types>",
        )
        body_xml = "".join(f"<w:p><w:r><w:t>{p}</w:t></w:r></w:p>" for p in paragraphs)
        doc_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            f"<w:body>{body_xml}</w:body>"
            "</w:document>"
        )
        zf.writestr("word/document.xml", doc_xml)
    return bio.getvalue()


async def get_auth_token(client: AsyncClient, email: str, password: str = "testpass123") -> str:
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


# ─── 1. PDF Verification Tests ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_uncompressed_pdf_genuine_extraction(client: AsyncClient):
    token = await get_auth_token(client, "pdf_uncomp@test.com")
    marker1 = "MARKER_UNCOMP_SENIOR_LEAD"
    marker2 = "MARKER_EXPERIENCE_DISTRIBUTED_SYSTEMS"

    pdf_bytes = make_synthetic_pdf([marker1, marker2, "Proficient in Python, FastAPI, and Docker"], compress=False)
    b64_content = base64.b64encode(pdf_bytes).decode("ascii")

    res = await client.post(
        "/api/v1/interviews/resumes",
        json={
            "filename": "candidate_resume.pdf",
            "file_type": "application/pdf",
            "content_base64": b64_content,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["filename"] == "candidate_resume.pdf"
    assert "Python" in data["skills"]
    assert "FastAPI" in data["skills"]
    assert "Docker" in data["skills"]


@pytest.mark.asyncio
async def test_compressed_flatedecode_pdf_genuine_extraction(client: AsyncClient):
    token = await get_auth_token(client, "pdf_comp@test.com")
    marker = "MARKER_FLATEDECODE_REACT_SPECIALIST"

    pdf_bytes = make_synthetic_pdf([marker, "Experienced with React, TypeScript, and Next.js"], compress=True)
    b64_content = base64.b64encode(pdf_bytes).decode("ascii")

    res = await client.post(
        "/api/v1/interviews/resumes",
        json={
            "filename": "compressed_resume.pdf",
            "file_type": "application/pdf",
            "content_base64": b64_content,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert "React" in data["skills"]
    assert "TypeScript" in data["skills"]


@pytest.mark.asyncio
async def test_image_only_pdf_safely_marked_without_false_success(client: AsyncClient):
    token = await get_auth_token(client, "pdf_img@test.com")

    scanned_pdf_bytes = make_synthetic_image_only_pdf()
    b64_content = base64.b64encode(scanned_pdf_bytes).decode("ascii")

    res = await client.post(
        "/api/v1/interviews/resumes",
        json={
            "filename": "scanned_doc.pdf",
            "file_type": "application/pdf",
            "content_base64": b64_content,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    data = res.json()
    # Confirms it is NOT falsely marked successful
    assert data["skills"] is None
    assert "OCR is required" in (data["experience_summary"] or "")


# ─── 2. DOCX Verification Tests ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_docx_genuine_extraction_multiple_sections(client: AsyncClient):
    token = await get_auth_token(client, "docx_valid@test.com")
    marker = "MARKER_DOCX_PROJECT_ENTERPRISE_PORTAL"

    docx_bytes = make_synthetic_docx([
        "Jordan Lee - Lead Backend Architect",
        marker,
        "Core skills: PostgreSQL, Redis, Kubernetes, AWS",
        "Developed scalable ingestion pipelines with 99.99% availability."
    ])
    b64_content = base64.b64encode(docx_bytes).decode("ascii")

    res = await client.post(
        "/api/v1/interviews/resumes",
        json={
            "filename": "portfolio.docx",
            "file_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "content_base64": b64_content,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert "PostgreSQL" in data["skills"]
    assert "Redis" in data["skills"]
    assert "Kubernetes" in data["skills"]


@pytest.mark.asyncio
async def test_docx_malformed_archive_rejected(client: AsyncClient):
    token = await get_auth_token(client, "docx_corrupt@test.com")

    # Corrupted ZIP header
    corrupt_bytes = b"PK\x03\x04\x00\x00corrupted_payload_that_is_not_valid_zip"
    b64_content = base64.b64encode(corrupt_bytes).decode("ascii")

    res = await client.post(
        "/api/v1/interviews/resumes",
        json={
            "filename": "corrupted.docx",
            "file_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "content_base64": b64_content,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 400
    assert "corrupted" in res.json()["detail"].lower() or "invalid" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_docx_missing_document_xml_rejected(client: AsyncClient):
    token = await get_auth_token(client, "docx_no_xml@test.com")

    # Valid ZIP but missing word/document.xml
    bio = io.BytesIO()
    with zipfile.ZipFile(bio, "w") as zf:
        zf.writestr("unrelated.txt", "some content")
    zip_bytes = bio.getvalue()
    b64_content = base64.b64encode(zip_bytes).decode("ascii")

    res = await client.post(
        "/api/v1/interviews/resumes",
        json={
            "filename": "incomplete.docx",
            "content_base64": b64_content,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 400
    assert "word/document.xml" in res.json()["detail"]


# ─── 3. TXT Encoding & Punctuation Tests ─────────────────────────────────────

@pytest.mark.asyncio
async def test_txt_unicode_and_special_characters(client: AsyncClient):
    token = await get_auth_token(client, "txt_unicode@test.com")

    unicode_content = """
    Renée Dupont — Ingénieur Logiciel Sénior (München / Zürich)
    Spécialiste: Python, Django, REST, GraphQL.
    Empreinte: © 2026 Tous droits réservés.
    """

    res = await client.post(
        "/api/v1/interviews/resumes",
        json={
            "filename": "cv_unicode.txt",
            "file_type": "text/plain",
            "raw_text": unicode_content,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert "Python" in data["skills"]
    assert "Django" in data["skills"]
    assert "GraphQL" in data["skills"]


@pytest.mark.asyncio
async def test_binary_executable_disguised_as_txt_rejected(client: AsyncClient):
    token = await get_auth_token(client, "txt_evil@test.com")

    # Binary payload containing null bytes disguised as text
    binary_bytes = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00fake_executable_string"
    b64_content = base64.b64encode(binary_bytes).decode("ascii")

    res = await client.post(
        "/api/v1/interviews/resumes",
        json={
            "filename": "fake_resume.txt",
            "file_type": "text/plain",
            "content_base64": b64_content,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 400
    assert "binary data" in res.json()["detail"].lower()


# ─── 4. Magic Byte & Extension Security Tests ────────────────────────────────

@pytest.mark.asyncio
async def test_magic_byte_mismatch_pdf_rejected(client: AsyncClient):
    token = await get_auth_token(client, "pdf_bad_magic@test.com")

    # Text content labeled as .pdf without %PDF- magic bytes
    fake_pdf_bytes = b"This is just plain text disguised as a PDF file."
    b64_content = base64.b64encode(fake_pdf_bytes).decode("ascii")

    res = await client.post(
        "/api/v1/interviews/resumes",
        json={
            "filename": "trojan.pdf",
            "file_type": "application/pdf",
            "content_base64": b64_content,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 400
    assert "missing pdf header signature" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_magic_byte_mismatch_docx_rejected(client: AsyncClient):
    token = await get_auth_token(client, "docx_bad_magic@test.com")

    # Plain text labeled as .docx without PK magic bytes
    fake_docx_bytes = b"Not a real docx file content at all."
    b64_content = base64.b64encode(fake_docx_bytes).decode("ascii")

    res = await client.post(
        "/api/v1/interviews/resumes",
        json={
            "filename": "fake.docx",
            "file_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "content_base64": b64_content,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 400
    assert "invalid zip archive header" in res.json()["detail"].lower()


# ─── 5. Limits, Bounds & Session Validation Tests ────────────────────────────

@pytest.mark.asyncio
async def test_oversized_resume_rejected_before_processing(client: AsyncClient):
    token = await get_auth_token(client, "oversized@test.com")

    # 5 MB + 10 bytes
    large_text = "A" * (5 * 1024 * 1024 + 10)

    res = await client.post(
        "/api/v1/interviews/resumes",
        json={
            "filename": "huge.txt",
            "raw_text": large_text,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 413
    assert "maximum allowed size" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_interview_session_rejects_empty_or_scanned_resume(client: AsyncClient):
    token = await get_auth_token(client, "session_empty_resume@test.com")

    # 1. Upload an image-only / scanned PDF (0 extractable text)
    scanned_pdf = make_synthetic_image_only_pdf()
    b64_scanned = base64.b64encode(scanned_pdf).decode("ascii")
    up_res = await client.post(
        "/api/v1/interviews/resumes",
        json={
            "filename": "scanned.pdf",
            "content_base64": b64_scanned,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert up_res.status_code == 201
    scanned_resume_id = up_res.json()["id"]

    # 2. Attempt to create a resume-based interview with the scanned resume -> 400 Bad Request
    sess_res = await client.post(
        "/api/v1/interviews",
        json={
            "interview_type": "resume_based",
            "target_role": "Platform Engineer",
            "selected_stages": ["technical"],
            "resume_id": scanned_resume_id,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert sess_res.status_code == 400
    assert "no extractable text" in sess_res.json()["detail"].lower()

    # 3. Attempt to create a resume-based interview with no resume selected -> 400 Bad Request
    no_resume_res = await client.post(
        "/api/v1/interviews",
        json={
            "interview_type": "resume_based",
            "target_role": "Platform Engineer",
            "selected_stages": ["technical"],
            "resume_id": None,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert no_resume_res.status_code == 400
    assert "valid resume must be selected" in no_resume_res.json()["detail"].lower()

