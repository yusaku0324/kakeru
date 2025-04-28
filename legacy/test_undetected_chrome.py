"""
Test script for undetected_chromedriver to verify it works in the environment
"""
import os
import sys
import time
import logging
import tempfile
import uuid
import random
import shutil
import psutil

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def kill_chrome_processes():
    """Kill all Chrome processes"""
    logger.info("Killing all Chrome processes...")
    
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            if 'chrome' in proc.info['name'].lower() or (proc.info['cmdline'] and any('chrome' in cmd.lower() for cmd in proc.info['cmdline'])):
                logger.info(f"Killing Chrome process: {proc.info['pid']} - {proc.info['name']}")
                proc.kill()
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess) as e:
            logger.warning(f"Error killing process: {e}")
    
    time.sleep(3)  # Wait for processes to terminate

def clean_chrome_profiles():
    """Clean up Chrome profile directories"""
    logger.info("Cleaning up Chrome profile directories...")
    
    temp_dirs = [d for d in os.listdir(tempfile.gettempdir()) if d.startswith("chrome_profile_")]
    for temp_dir in temp_dirs:
        full_path = os.path.join(tempfile.gettempdir(), temp_dir)
        try:
            if os.path.exists(full_path):
                shutil.rmtree(full_path)
                logger.info(f"Removed existing Chrome profile directory: {full_path}")
        except Exception as e:
            logger.warning(f"Error removing directory {full_path}: {e}")

def main():
    """Test undetected_chromedriver"""
    try:
        kill_chrome_processes()
        
        clean_chrome_profiles()
        
        random_suffix = f"{uuid.uuid4().hex}_{random.randint(10000, 99999)}"
        temp_dir = os.path.join(tempfile.gettempdir(), f"chrome_profile_{random_suffix}")
        
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        
        os.makedirs(temp_dir, exist_ok=True)
        logger.info(f"Created fresh Chrome profile directory: {temp_dir}")
        
        try:
            import undetected_chromedriver as uc
            logger.info("Successfully imported undetected_chromedriver")
        except ImportError:
            logger.error("Failed to import undetected_chromedriver. Installing...")
            os.system("pip install undetected-chromedriver")
            import undetected_chromedriver as uc
            logger.info("Successfully installed and imported undetected_chromedriver")
        
        options = uc.ChromeOptions()
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        
        logger.info("Creating undetected_chromedriver instance...")
        driver = uc.Chrome(options=options, user_data_dir=temp_dir)
        
        logger.info("Navigating to google.com...")
        driver.get("https://www.google.com")
        time.sleep(3)
        
        screenshot_path = "undetected_chrome_test.png"
        driver.save_screenshot(screenshot_path)
        logger.info(f"Saved screenshot to {screenshot_path}")
        
        driver.quit()
        logger.info("Test completed successfully!")
        return 0
    
    except Exception as e:
        logger.error(f"Error in test script: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return 1

if __name__ == "__main__":
    sys.exit(main())
