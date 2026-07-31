"""Tests our own extraction/error-handling logic in pdf_utils by mocking
PdfReader — pypdf's own internal PDF parsing is pypdf's test suite's job,
not ours; hand-crafting binary PDF fixtures here would just be fragile.
"""

from unittest.mock import Mock, patch

import pytest

from pdf_utils import PdfExtractionError, extract_pdf_text


def _fake_page(text: str) -> Mock:
    page = Mock()
    page.extract_text.return_value = text
    return page


def test_extracts_and_joins_multiple_pages():
    reader = Mock(is_encrypted=False, pages=[_fake_page("Page one text."), _fake_page("Page two text.")])
    with patch("pdf_utils.PdfReader", return_value=reader):
        result = extract_pdf_text(object())
    assert "Page one text." in result
    assert "Page two text." in result


def test_skips_blank_pages():
    reader = Mock(is_encrypted=False, pages=[_fake_page(""), _fake_page("Only real content.")])
    with patch("pdf_utils.PdfReader", return_value=reader):
        result = extract_pdf_text(object())
    assert result.strip() == "Only real content."


def test_raises_on_scanned_pdf_with_no_text():
    reader = Mock(is_encrypted=False, pages=[_fake_page(""), _fake_page(None)])
    with patch("pdf_utils.PdfReader", return_value=reader):
        with pytest.raises(PdfExtractionError, match="No selectable text"):
            extract_pdf_text(object())


def test_raises_clear_error_on_encrypted_pdf():
    reader = Mock(is_encrypted=True, pages=[])
    with patch("pdf_utils.PdfReader", return_value=reader):
        with pytest.raises(PdfExtractionError, match="password-protected"):
            extract_pdf_text(object())


def test_raises_clear_error_on_unreadable_pdf():
    from pypdf.errors import PdfReadError

    with patch("pdf_utils.PdfReader", side_effect=PdfReadError("bad xref")):
        with pytest.raises(PdfExtractionError, match="Couldn't read"):
            extract_pdf_text(object())
