"""PDF text extraction for the test console. Runs entirely client-side (in
the Streamlit process) so uploading a PDF never changes the backend's JSON
contract — extracted text is fed into the exact same fields a tester would
otherwise paste in by hand.
"""

from pypdf import PdfReader
from pypdf.errors import PdfReadError


class PdfExtractionError(Exception):
    """Raised when a PDF can't be read or yields no extractable text."""


def extract_pdf_text(uploaded_file) -> str:
    """uploaded_file is a Streamlit UploadedFile (file-like, seekable)."""
    try:
        reader = PdfReader(uploaded_file)
    except PdfReadError as exc:
        raise PdfExtractionError(f"Couldn't read this PDF: {exc}") from exc

    if reader.is_encrypted:
        raise PdfExtractionError("This PDF is password-protected — remove the password and re-upload.")

    pages_text = []
    for page in reader.pages:
        text = (page.extract_text() or "").strip()
        if text:
            pages_text.append(text)

    combined = "\n\n".join(pages_text)
    if not combined.strip():
        raise PdfExtractionError(
            "No selectable text found in this PDF — it may be a scanned image "
            "without an OCR text layer. Try pasting the text directly instead."
        )
    return combined
