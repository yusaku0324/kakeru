"""
Test script to create test media files for X posting
"""
import os
import sys
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def create_test_png(filename, width=1, height=1):
    """Create a minimal valid PNG file for testing"""
    png_header = b'\x89PNG\r\n\x1a\n'
    ihdr_chunk = b'\x00\x00\x00\r'  # Length of IHDR chunk data
    ihdr_chunk += b'IHDR'
    ihdr_chunk += width.to_bytes(4, byteorder='big')
    ihdr_chunk += height.to_bytes(4, byteorder='big')
    ihdr_chunk += b'\x08\x06\x00\x00\x00'  # 8-bit RGB with alpha, no compression, no filter, no interlace
    ihdr_crc = b'\x1f\x15\xc4\x89'  # CRC for the IHDR chunk
    
    idat_chunk = b'\x00\x00\x00\x0b'  # Length of IDAT chunk data
    idat_chunk += b'IDATx\x9cc\x00\x01\x00\x00\x05\x00\x01'
    idat_crc = b'\r\n-\xb4'  # CRC for the IDAT chunk
    
    iend_chunk = b'\x00\x00\x00\x00'  # Length of IEND chunk data
    iend_chunk += b'IEND'
    iend_crc = b'\xaeB`\x82'  # CRC for the IEND chunk
    
    png_data = png_header + ihdr_chunk + ihdr_crc + idat_chunk + idat_crc + iend_chunk + iend_crc
    
    with open(filename, 'wb') as f:
        f.write(png_data)
    
    logger.info(f"Created test PNG file: {filename}")

def main():
    """Create test media files for X posting"""
    try:
        os.makedirs('test_images', exist_ok=True)
        
        for i in range(1, 5):
            create_test_png(f'test_images/question_{i}.png')
        
        logger.info("Successfully created all test media files")
        return 0
    
    except Exception as e:
        logger.error(f"Error creating test media files: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return 1

if __name__ == "__main__":
    sys.exit(main())
