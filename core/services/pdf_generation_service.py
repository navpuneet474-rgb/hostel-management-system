"""
PDF Generation Service for Digital Passes
Handles creation of professional PDF passes for approved leave requests using HTML templates.
"""

import os
import logging
import base64
from datetime import datetime
from typing import Optional, Tuple
from io import BytesIO

try:
    import qrcode
    from qrcode.image.styledpil import StyledPilImage
    QR_CODE_AVAILABLE = True
except ImportError:
    QR_CODE_AVAILABLE = False

try:
    from weasyprint import HTML, CSS
    from weasyprint.text.fonts import FontConfiguration
    WEASYPRINT_AVAILABLE = True
except ImportError:
    WEASYPRINT_AVAILABLE = False

from django.conf import settings
from django.utils import timezone
from django.template.loader import render_to_string
from django.http import HttpResponse
from ..models import DigitalPass, Student

logger = logging.getLogger(__name__)


class PDFGenerationService:
    """Service for generating professional PDF passes using HTML templates"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        if not WEASYPRINT_AVAILABLE:
            self.logger.warning("WeasyPrint not available. PDF generation will use fallback method.")
    
    def generate_pass_pdf(self, digital_pass: DigitalPass) -> Tuple[bool, Optional[str], Optional[bytes]]:
        """
        Generate PDF for a digital pass using HTML template
        
        Args:
            digital_pass: DigitalPass instance to generate PDF for
            
        Returns:
            Tuple of (success, file_path, pdf_bytes)
        """
        try:
            # Generate QR code data
            qr_code_data = self._generate_qr_code(digital_pass)
            
            # Prepare context for template
            context = {
                'digital_pass': digital_pass,
                'student': digital_pass.student,
                'qr_code_data': qr_code_data,
                'hostel_name': getattr(settings, 'HOSTEL_NAME', 'Student Hostel'),
                'now': timezone.now(),
            }
            
            # Render HTML template
            try:
                html_content = render_to_string('passes/digital_pass_template.html', context)
            except Exception as e:
                self.logger.error(f"Error rendering template: {e}")
                return False, None, None
            
            # Generate PDF from HTML template using WeasyPrint
            pdf_bytes = None
            if WEASYPRINT_AVAILABLE:
                try:
                    pdf_bytes = self._generate_pdf_with_weasyprint(html_content)
                    if pdf_bytes:
                        self.logger.info(f"PDF generated successfully with WeasyPrint for pass {digital_pass.pass_number}")
                except Exception as e:
                    self.logger.error(f"WeasyPrint generation failed: {e}")
            
            # If WeasyPrint fails, use HTML as fallback (browser will render it)
            if not pdf_bytes:
                self.logger.warning(f"WeasyPrint PDF generation failed for pass {digital_pass.pass_number}, using HTML fallback")
                # Store HTML content as bytes for serving
                pdf_bytes = html_content.encode('utf-8')
                self.logger.info(f"HTML fallback prepared ({len(pdf_bytes)} bytes)")
            
            if not pdf_bytes:
                self.logger.error(f"No PDF bytes generated for pass {digital_pass.pass_number}")
                return False, None, None
            
            # Save to file system
            try:
                file_path = self._save_pdf_to_file(digital_pass, pdf_bytes)
            except Exception as e:
                self.logger.error(f"Error saving PDF to file: {e}")
                return False, None, None
            
            # Update digital pass record
            try:
                digital_pass.pdf_generated = True
                digital_pass.pdf_path = file_path
                digital_pass.save()
            except Exception as e:
                self.logger.error(f"Error saving digital pass record: {e}")
                # Even if we can't save the flag, we have the PDF
                return True, file_path, pdf_bytes
            
            self.logger.info(f"PDF generated successfully for pass {digital_pass.pass_number}")
            return True, file_path, pdf_bytes
            
        except Exception as e:
            self.logger.error(f"Error generating PDF for pass {digital_pass.pass_number}: {e}")
            import traceback
            self.logger.error(traceback.format_exc())
            return False, None, None
    
    def _generate_qr_code(self, digital_pass: DigitalPass) -> Optional[str]:
        """Generate QR code for the digital pass"""
        if not QR_CODE_AVAILABLE:
            return None
        
        try:
            # QR code data with improved formatting - pipe-delimited for better compatibility
            qr_data = f"PASS:{digital_pass.pass_number}|NAME:{digital_pass.student.name}|ID:{digital_pass.student.student_id}|ROOM:{digital_pass.student.room_number},{digital_pass.student.block}|CODE:{digital_pass.verification_code}|FROM:{digital_pass.from_date.strftime('%d/%m/%Y')}|TO:{digital_pass.to_date.strftime('%d/%m/%Y')}"
            
            # Create QR code with auto-adjustment
            qr = qrcode.QRCode(
                version=None,  # Auto-detect appropriate version
                error_correction=qrcode.constants.ERROR_CORRECT_M,
                box_size=10,
                border=4,
            )
            qr.add_data(qr_data)
            qr.make(fit=True)
            
            # Create QR code image
            qr_img = qr.make_image(fill_color="black", back_color="white")
            
            # Convert to base64 for embedding in HTML
            buffer = BytesIO()
            qr_img.save(buffer, format='PNG')
            qr_code_base64 = base64.b64encode(buffer.getvalue()).decode()
            buffer.close()
            
            return qr_code_base64
            
        except Exception as e:
            self.logger.error(f"Error generating QR code: {e}")
            return None
    
    def _generate_pdf_with_weasyprint(self, html_content: str) -> Optional[bytes]:
        """Generate PDF using WeasyPrint - template already has styling"""
        try:
            from weasyprint import HTML
            from io import BytesIO
            
            pdf_buffer = BytesIO()
            
            # Try with newer pydyf API first (version 0.11.0+)
            try:
                HTML(string=html_content).write_pdf(pdf_buffer)
            except TypeError as te:
                # If we get the TypeError about PDF.__init__, it's a version mismatch
                # Fall back to HTML-only approach
                self.logger.warning(f"WeasyPrint/pydyf version incompatibility detected: {te}")
                self.logger.info("Falling back to HTML template serving")
                return None
            
            pdf_bytes = pdf_buffer.getvalue()
            pdf_buffer.close()
            
            if pdf_bytes and len(pdf_bytes) > 0:
                self.logger.info(f"PDF generated successfully ({len(pdf_bytes)} bytes)")
                return pdf_bytes
            else:
                self.logger.error("WeasyPrint produced empty PDF")
                return None
        except Exception as e:
            self.logger.error(f"Error generating PDF: {e}")
            import traceback
            self.logger.error(traceback.format_exc())
            return None
    
    def _generate_pdf_with_reportlab(self, digital_pass: DigitalPass) -> Tuple[bool, Optional[str], Optional[bytes]]:
        """Fallback PDF generation using ReportLab (original method)"""
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.lib.colors import HexColor
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.enums import TA_CENTER, TA_LEFT
        
        try:
            # Create PDF in memory
            buffer = BytesIO()
            doc = SimpleDocTemplate(
                buffer,
                pagesize=A4,
                rightMargin=72,
                leftMargin=72,
                topMargin=72,
                bottomMargin=72
            )
            
            # Setup styles
            styles = getSampleStyleSheet()
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=24,
                spaceAfter=30,
                alignment=TA_CENTER,
                textColor=HexColor('#1f2937'),
                fontName='Helvetica-Bold'
            )
            
            # Build PDF content
            story = []
            
            # Header
            title = Paragraph("HOSTEL LEAVE PASS", title_style)
            story.append(title)
            story.append(Spacer(1, 20))
            
            # Pass info
            pass_info = f"<b>Pass Number:</b> {digital_pass.pass_number}"
            if digital_pass.verification_code:
                pass_info += f" | <b>Verification Code:</b> {digital_pass.verification_code}"
            
            story.append(Paragraph(pass_info, styles['Heading2']))
            story.append(Spacer(1, 20))
            
            # Student information
            student = digital_pass.student
            student_data = [
                ['Name:', student.name],
                ['Student ID:', student.student_id],
                ['Room:', f"{student.room_number}, Block {student.block}"],
                ['Leave From:', digital_pass.from_date.strftime('%d %B %Y')],
                ['Return On:', digital_pass.to_date.strftime('%d %B %Y')],
                ['Duration:', f"{digital_pass.total_days} day{'s' if digital_pass.total_days > 1 else ''}"],
                ['Reason:', digital_pass.reason],
                ['Status:', digital_pass.get_status_display()],
            ]
            
            table = Table(student_data, colWidths=[2*inch, 4*inch])
            table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 12),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ]))
            
            story.append(table)
            story.append(Spacer(1, 30))
            
            # Footer
            footer_text = f"""
            Generated on: {timezone.now().strftime('%d %B %Y at %I:%M %p')}<br/>
            This is a computer-generated document. No signature required.
            """
            story.append(Paragraph(footer_text, styles['Normal']))
            
            # Build PDF
            doc.build(story)
            
            # Get PDF bytes
            pdf_bytes = buffer.getvalue()
            buffer.close()
            
            # Save to file system
            file_path = self._save_pdf_to_file(digital_pass, pdf_bytes)
            
            # Update digital pass record
            digital_pass.pdf_generated = True
            digital_pass.pdf_path = file_path
            digital_pass.save()
            
            return True, file_path, pdf_bytes
            
        except Exception as e:
            self.logger.error(f"Error generating PDF with ReportLab: {e}")
            return False, None, None
    
    def _save_pdf_to_file(self, digital_pass: DigitalPass, pdf_bytes: bytes) -> str:
        """Save PDF bytes to file system"""
        # Create passes directory if it doesn't exist
        passes_dir = os.path.join(settings.MEDIA_ROOT, 'passes')
        os.makedirs(passes_dir, exist_ok=True)
        
        # Detect if this is HTML or PDF based on content
        is_html = pdf_bytes.startswith(b'<!DOCTYPE html') or pdf_bytes.startswith(b'<html')
        
        # Generate filename with appropriate extension
        if is_html:
            filename = f"pass_{digital_pass.pass_number}_{digital_pass.student.student_id}.html"
        else:
            filename = f"pass_{digital_pass.pass_number}_{digital_pass.student.student_id}.pdf"
        
        file_path = os.path.join(passes_dir, filename)
        
        # Write to file
        with open(file_path, 'wb') as f:
            f.write(pdf_bytes)
        
        # Return relative path for database storage
        return os.path.join('passes', filename)
    
    def generate_pass_html(self, digital_pass: DigitalPass) -> str:
        """Generate HTML version of the pass for preview"""
        try:
            # Generate QR code data
            qr_code_data = self._generate_qr_code(digital_pass)
            
            # Prepare context for template
            context = {
                'digital_pass': digital_pass,
                'student': digital_pass.student,
                'qr_code_data': qr_code_data,
                'hostel_name': getattr(settings, 'HOSTEL_NAME', 'Student Hostel'),
                'now': timezone.now(),
            }
            
            # Render HTML template
            html_content = render_to_string('passes/digital_pass_template.html', context)
            return html_content
            
        except Exception as e:
            self.logger.error(f"Error generating HTML for pass {digital_pass.pass_number}: {e}")
            return f"<html><body><h1>Error generating pass</h1><p>{str(e)}</p></body></html>"
    
    def get_pdf_file_path(self, digital_pass: DigitalPass) -> Optional[str]:
        """Get full file path for a digital pass PDF"""
        if not digital_pass.pdf_path:
            return None
        
        return os.path.join(settings.MEDIA_ROOT, digital_pass.pdf_path)
    
    def pdf_exists(self, digital_pass: DigitalPass) -> bool:
        """Check if PDF file exists on disk"""
        if not digital_pass.pdf_path:
            return False
        
        file_path = self.get_pdf_file_path(digital_pass)
        return file_path and os.path.exists(file_path)


# Global service instance
pdf_generation_service = PDFGenerationService()